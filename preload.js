const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
	getPaths: () => ipcRenderer.invoke('get-paths'),
	setMinimizeToTray: (value) => ipcRenderer.invoke('set-minimize-to-tray', value),
	selectAudio: () => ipcRenderer.invoke('select-audio'),
	selectImage: () => ipcRenderer.invoke('select-image'),
	copyFile: (src, dest) => ipcRenderer.invoke('copy-file', src, dest),
	createDir: (dir) => ipcRenderer.invoke('create-dir', dir),
	basename: (p) => ipcRenderer.invoke('basename', p),
	writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
	fsExistsSync: (filePath) => ipcRenderer.invoke('fs-exists-sync', filePath),
	fsReadFileSync: (filePath) => ipcRenderer.invoke('fs-read-file-sync', filePath),
	deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
	toFileUrl: (p) => ipcRenderer.invoke('to-file-url', p),
	downloadFile: (url, dest, name, configPath) => ipcRenderer.invoke('download-file', url, dest, name, configPath),

	// listener for play sound requests from http api
	onPlaySoundRequest: (callback) => {
		ipcRenderer.on('play-sound-request', (event, soundIndex) => callback(soundIndex))
	},

	onStopAllSoundsRequest: (callback) => {
		ipcRenderer.on('stop-all-request', () => callback())
	},

	// listener for download progress
	onDownloadProgress: (callback) => {
		ipcRenderer.on('download-progress', (event, progress) => callback(progress))
	}
})