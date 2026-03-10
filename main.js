const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { pathToFileURL } = require('url')
const { spawn } = require('child_process')

let mainWindow
let tray
let minimizeToTray = false
let localServer = null
const SERVER_PORT = 3939

// paths
const userDataPath = path.join(app.getPath('userData'), 'chirpboard-data')
const audioDir = path.join(userDataPath, 'sounds')
const imageDir = path.join(userDataPath, 'images')
const configPath = path.join(userDataPath, 'sounds.json')
const settingsPath = path.join(userDataPath, 'settings.json')

// ensure directories and config exist
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true })
if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true })
if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify([]))

// create main window
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		icon: path.join(__dirname, 'icon.ico'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false
		}
	})
	mainWindow.loadFile('index.html')
	mainWindow.setMenuBarVisibility(false)
	mainWindow.on('close', (event) => {
		if (minimizeToTray) {
			event.preventDefault()
			mainWindow.hide()
		}
	})
}

// create tray icon
function createTray() {
	const iconPath = path.join(__dirname, 'icon.ico')
	const icon = nativeImage.createFromPath(iconPath)
	tray = new Tray(icon)
	const contextMenu = Menu.buildFromTemplate([
		{ label: 'Show Chirpboard', click: () => mainWindow.show() },
		{ label: 'Quit', click: () => { minimizeToTray = false; app.quit() } }
	])
	tray.setToolTip('Chirpboard')
	tray.setContextMenu(contextMenu)
	tray.on('click', () => mainWindow.show())
}

app.whenReady().then(() => {
	createWindow()
	createTray()
	startLocalServer()
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', () => { stopLocalServer(); if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => stopLocalServer())

// start local http server
function startLocalServer() {
	localServer = http.createServer((req, res) => {
		res.setHeader('Access-Control-Allow-Origin', '*')
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
		if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }
		
		if (req.url === '/sounds' && req.method === 'GET') {
			try {
				const sounds = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
				const soundsWithImages = sounds.map(sound => {
					const copy = { ...sound }
					if (sound.image && fs.existsSync(sound.image)) {
						const ext = path.extname(sound.image).substring(1)
						copy.imageBase64 = `data:image/${ext};base64,${fs.readFileSync(sound.image).toString('base64')}`
					}
					return copy
				})
				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify(soundsWithImages))
			} catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })) }
			return
		}
		
		if (req.url === '/sounds/names' && req.method === 'GET') {
			try {
				const sounds = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify(sounds.map(s => s.name)))
			} catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })) }
			return
		}
		
		if (req.url === '/play' && req.method === 'POST') {
			let body = ''
			req.on('data', chunk => body += chunk.toString())
			req.on('end', () => {
				try {
					const { index, name } = JSON.parse(body)
					const sounds = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
					let soundIndex = -1
					if (typeof index === 'number') soundIndex = index
					else if (name) soundIndex = sounds.findIndex(s => s.name.toLowerCase() === name.toLowerCase())
					if (soundIndex === -1 || soundIndex >= sounds.length) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'sound not found' })); return }
					if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('play-sound-request', soundIndex)
					res.writeHead(200, { 'Content-Type': 'application/json' })
					res.end(JSON.stringify({ success: true, soundIndex, soundName: sounds[soundIndex].name }))
				} catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })) }
			})
			return
		}
		
		if (req.url === '/stop' && req.method === 'POST') {
			if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('stop-all-request')
			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true }))
			return
		}
		
		res.writeHead(404, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'not found' }))
	})
	localServer.listen(SERVER_PORT, '127.0.0.1', () => console.log(`local server running at http://127.0.0.1:${SERVER_PORT}`))
	localServer.on('error', err => console.error('server error:', err))
}

function stopLocalServer() {
	if (localServer) { localServer.close(); localServer = null }
}

// ipc handlers
ipcMain.handle('get-paths', () => ({ userDataPath, audioDir, imageDir, configPath, settingsPath }))
ipcMain.handle('set-minimize-to-tray', (_, value) => minimizeToTray = value)
ipcMain.handle('select-audio', async () => {
	const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }] })
	return res.canceled ? { canceled: true } : { canceled: false, file: res.filePaths[0] }
})
ipcMain.handle('select-image', async () => {
	const res = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif'] }] })
	return res.canceled ? { canceled: true } : { canceled: false, file: res.filePaths[0] }
})
ipcMain.handle('copy-file', (_, src, dest) => fs.copyFileSync(src, dest))
ipcMain.handle('create-dir', (_, dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir) })
ipcMain.handle('basename', (_, p) => path.basename(p))
ipcMain.handle('write-file', (_, filePath, content) => fs.writeFileSync(filePath, content))
ipcMain.handle('fs-exists-sync', (_, filePath) => fs.existsSync(filePath))
ipcMain.handle('fs-read-file-sync', (_, filePath) => fs.readFileSync(filePath, 'utf-8'))
ipcMain.handle('delete-file', (_, filePath) => {
	if (fs.existsSync(filePath)) {
		const stat = fs.lstatSync(filePath)
		if (stat.isDirectory()) fs.rmdirSync(filePath, { recursive: true })
		else fs.unlinkSync(filePath)
	}
})
ipcMain.handle('to-file-url', (_, p) => pathToFileURL(p).href)

// handle a download request and save it as mp3
ipcMain.handle('download-file', async (event, url, destDir, name, configPath) => {
	if (!url || !destDir || !name || !configPath) {
		throw new Error('missing arguments')
	}

	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true })
	}

	const safeName = name.replace(/[^\w\-]+/g, '_')
	const finalPath = path.join(destDir, `${safeName}.mp3`)

	await new Promise((resolve, reject) => {
		const ytdlp = spawn('yt-dlp', [
			'-x',
			'--audio-format',
			'mp3',
			'--newline',
			'-o',
			finalPath,
			url
		])

		let outputBuffer = ''

		ytdlp.stdout.on('data', (data) => {
			outputBuffer += data.toString()
			const lines = outputBuffer.split('\n')
			outputBuffer = lines.pop() // Keep incomplete line in buffer

			lines.forEach(line => {
				// Parse download progress
				const downloadMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/)
				if (downloadMatch) {
					const percent = parseFloat(downloadMatch[1])
					event.sender.send('download-progress', {
						percent: percent,
						status: 'Downloading...'
					})
				}

				// Parse conversion progress
				if (line.includes('[ExtractAudio]')) {
					event.sender.send('download-progress', {
						percent: 95,
						status: 'Converting to MP3...'
					})
				}
			})
		})

		ytdlp.stderr.on('data', (data) => {
			console.log('yt-dlp stderr:', data.toString())
		})

		ytdlp.on('error', reject)

		ytdlp.on('close', code => {
			if (code === 0) {
				event.sender.send('download-progress', {
					percent: 100,
					status: 'Complete!'
				})
				resolve()
			} else {
				reject(new Error(`yt-dlp exited ${code}`))
			}
		})
	})

	let sounds = []
	if (fs.existsSync(configPath)) {
		sounds = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
	}

	sounds.push({
		name: name,
		file: finalPath,
		image: '',
		volume: 1,
		loop: false,
		hotkey: null
	})

	fs.writeFileSync(configPath, JSON.stringify(sounds, null, 2))

	return finalPath
})