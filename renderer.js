// dom elements
const buttonGrid = document.getElementById('buttonGrid')
const searchInput = document.getElementById('search')
const volumeSlider = document.getElementById('volume')
const addSoundBtn = document.getElementById('addSoundBtn')
const stopAllBtn = document.getElementById('stopAllBtn')
const settingsBtn = document.getElementById('settingsBtn')
const soundModal = document.getElementById('soundModal')
const soundNameInput = document.getElementById('soundName')
const soundUrlInput = document.getElementById('soundUrl')
const cancelAddBtn = document.getElementById('cancelAdd')
const saveAddBtn = document.getElementById('saveAdd')
const imageDrop = document.getElementById('imageDrop')
const selectAudioBtn = document.getElementById('selectAudioBtn')
const selectedAudioSpan = document.getElementById('selectedAudio')

// settings modal
const settingsModal = document.getElementById('settingsModal')
const inputDeviceSelect = document.getElementById('inputDeviceSelect')
const outputDeviceSelect = document.getElementById('outputDeviceSelect')
const virtualMicSelect = document.getElementById('virtualMicSelect')
const minimizeToTrayCheck = document.getElementById('minimizeToTray')
const settingsCloseBtn = document.getElementById('settingsClose')

// sound options modal
const soundOptionsModal = document.getElementById('soundOptionsModal')
const optionsPlayBtn = document.getElementById('optionsPlay')
const optionsPinnedToggle = document.getElementById('optionsPinned')
const optionsLoopToggle = document.getElementById('optionsLoop')
const optionsSoundVolume = document.getElementById('optionsSoundVolume')
const optionsVolumeValue = document.getElementById('optionsVolumeValue')
const optionsEditBtn = document.getElementById('optionsEdit')
const optionsTrimBtn = document.getElementById('optionsTrim')
const optionsDeleteBtn = document.getElementById('optionsDelete')
const optionsHotkeyBtn = document.getElementById('optionsHotkey')
const optionsCloseBtn = document.getElementById('optionsClose')

// trim modal
const trimModal = document.getElementById('trimModal')
const trimAudio = document.getElementById('trimAudio')
const waveformCanvas = document.getElementById('waveformCanvas')
const trimHandleStart = document.getElementById('trimHandleStart')
const trimHandleEnd = document.getElementById('trimHandleEnd')
const trimSelection = document.getElementById('trimSelection')
const trimStartDisplay = document.getElementById('trimStartDisplay')
const trimEndDisplay = document.getElementById('trimEndDisplay')
const trimDuration = document.getElementById('trimDuration')
const trimPlayPreview = document.getElementById('trimPlayPreview')
const trimCancel = document.getElementById('trimCancel')
const trimSave = document.getElementById('trimSave')

// download modal
const downloadModal = document.getElementById('downloadModal')
const downloadStatus = document.getElementById('downloadStatus')
const downloadProgress = document.getElementById('downloadProgress')
const downloadPercent = document.getElementById('downloadPercent')

// trim playhead
const trimPlayhead = document.getElementById('trimPlayhead')
const trimCurrentTime = document.getElementById('trimCurrentTime')

let trimAudioBuffer = null
let trimStartTime = 0
let trimEndTime = 0
let isDraggingTrim = false
let dragTarget = null
let playheadInterval = null

// edit modal
const editModal = document.getElementById('editModal')
const editNameInput = document.getElementById('editName')
const editImageDrop = document.getElementById('editImageDrop')
const editSelectImageBtn = document.getElementById('editSelectImage')
const editCancelBtn = document.getElementById('editCancel')
const editSaveBtn = document.getElementById('editSave')

let globalVolume = parseFloat(volumeSlider.value)
let sounds = []
let selectedAudioPath = null
let selectedImagePath = null
let editingImagePath = null
let AUDIO_DIR, IMAGE_DIR, CONFIG_PATH, SETTINGS_PATH
let currentlyPlaying = []
let currentSoundIndex = null
let loopingAudios = new Map()
let recordingHotkey = false

// audio context and nodes
let audioContext = null
let micStream = null
let micSource = null

// separate destinations
let headphonesDestination = null  // where user hears sounds only
let virtualMicDestination = null  // where mic + sounds go for other apps

// audio elements for device selection
let headphonesAudioElement = null
let virtualMicAudioElement = null

let settings = {
	inputDevice: 'default',
	outputDevice: 'default',
	virtualMicDevice: 'default',
	minimizeToTray: false
}

// init appdata paths
async function init_paths() {
	const paths = await window.electronAPI.getPaths()
	USER_DATA_DIR = paths.userDataPath
	AUDIO_DIR = paths.audioDir
	IMAGE_DIR = paths.imageDir
	CONFIG_PATH = paths.configPath
	SETTINGS_PATH = paths.settingsPath
	await window.electronAPI.createDir(AUDIO_DIR)
	await window.electronAPI.createDir(IMAGE_DIR)
}

// init audio context and routing
async function init_audio() {
	audioContext = new (window.AudioContext || window.webkitAudioContext)()

	// create destinations
	headphonesDestination = audioContext.createMediaStreamDestination()
	virtualMicDestination = audioContext.createMediaStreamDestination()

	// create audio elements for sink selection
	headphonesAudioElement = new Audio()
	headphonesAudioElement.srcObject = headphonesDestination.stream
	headphonesAudioElement.play().catch(e => console.warn('headphones audio element play failed:', e))

	virtualMicAudioElement = new Audio()
	virtualMicAudioElement.srcObject = virtualMicDestination.stream
	virtualMicAudioElement.play().catch(e => console.warn('virtual mic audio element play failed:', e))

	// set output devices
	await set_output_devices()

	// get microphone access
	try {
		await connect_microphone()
		console.log('microphone connected')
	} catch (e) {
		console.warn('could not access microphone:', e)
	}
}

// connect microphone to virtual mic destination only
async function connect_microphone() {
	if (micSource) {
		micSource.disconnect()
		micSource = null
	}
	if (micStream) {
		micStream.getTracks().forEach(track => track.stop())
		micStream = null
	}

	const constraints = settings.inputDevice !== 'default'
		? { audio: { deviceId: { exact: settings.inputDevice } } }
		: { audio: true }

	micStream = await navigator.mediaDevices.getUserMedia(constraints)
	micSource = audioContext.createMediaStreamSource(micStream)

	// mic goes ONLY to virtual mic destination (not to headphones)
	micSource.connect(virtualMicDestination)
}

// set output devices
async function set_output_devices() {
	if (!headphonesAudioElement.setSinkId) {
		console.warn('browser does not support setSinkId')
		return
	}

	try {
		const headphonesId = settings.outputDevice === 'default' ? '' : settings.outputDevice
		await headphonesAudioElement.setSinkId(headphonesId)
		console.log('headphones set to:', settings.outputDevice)
	} catch (e) {
		console.error('failed to set headphones device:', e)
	}

	try {
		const virtualMicId = settings.virtualMicDevice === 'default' ? '' : settings.virtualMicDevice
		await virtualMicAudioElement.setSinkId(virtualMicId)
		console.log('virtual mic set to:', settings.virtualMicDevice)
	} catch (e) {
		console.error('failed to set virtual mic device:', e)
	}
}

// load settings
async function load_settings() {
	if (await window.electronAPI.fsExistsSync(SETTINGS_PATH)) {
		const data = await window.electronAPI.fsReadFileSync(SETTINGS_PATH)
		settings = { ...settings, ...JSON.parse(data) }
	}
	minimizeToTrayCheck.checked = settings.minimizeToTray
	await window.electronAPI.setMinimizeToTray(settings.minimizeToTray)
}

// save settings
function save_settings() {
	window.electronAPI.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}

// populate audio devices
async function populate_audio_devices() {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices()

		// clear existing options
		inputDeviceSelect.innerHTML = '<option value="default">System Default</option>'
		outputDeviceSelect.innerHTML = '<option value="default">System Default</option>'
		virtualMicSelect.innerHTML = '<option value="default">System Default</option>'

		// add audio input devices
		devices.filter(d => d.kind === 'audioinput').forEach(device => {
			const option = document.createElement('option')
			option.value = device.deviceId
			option.textContent = device.label || `Microphone ${device.deviceId.substring(0, 8)}`
			inputDeviceSelect.appendChild(option)
		})

		// add audio output devices (for both headphones and virtual mic)
		devices.filter(d => d.kind === 'audiooutput').forEach(device => {
			const optionOutput = document.createElement('option')
			optionOutput.value = device.deviceId
			optionOutput.textContent = device.label || `Output ${device.deviceId.substring(0, 8)}`
			outputDeviceSelect.appendChild(optionOutput)

			const optionVirtual = document.createElement('option')
			optionVirtual.value = device.deviceId
			optionVirtual.textContent = device.label || `Output ${device.deviceId.substring(0, 8)}`
			virtualMicSelect.appendChild(optionVirtual)
		})

		// set selected values
		inputDeviceSelect.value = settings.inputDevice || 'default'
		outputDeviceSelect.value = settings.outputDevice || 'default'
		virtualMicSelect.value = settings.virtualMicDevice || 'default'

		console.log('audio devices populated')
	} catch (error) {
		console.error('error getting audio devices:', error)
	}
}

// load sounds
async function load_sounds() {
	if (await window.electronAPI.fsExistsSync(CONFIG_PATH)) {
		const data = await window.electronAPI.fsReadFileSync(CONFIG_PATH)
		sounds = JSON.parse(data)
	}
	sounds = sounds.map(s => ({
		...s,
		volume: s.volume ?? 1,
		loop: s.loop ?? false,
		hotkey: s.hotkey ?? null,
		pinned: s.pinned ?? false,
		trimStart: s.trimStart ?? 0,
		trimEnd: s.trimEnd ?? null
	}))
	// Sort: pinned sounds first, then by original order
	sounds.sort((a, b) => {
		if (a.pinned && !b.pinned) return -1
		if (!a.pinned && b.pinned) return 1
		return 0
	})
	render_sounds()
}

// save config
function save_sounds() {
	window.electronAPI.writeFile(CONFIG_PATH, JSON.stringify(sounds, null, 2))
}

// play sound
async function play_sound(index) {
	const s = sounds[index]
	if (!audioContext) await init_audio()

	// fetch audio data
	const audioUrl = await window.electronAPI.toFileUrl(s.file)
	const response = await fetch(audioUrl)
	const arrayBuffer = await response.arrayBuffer()
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

	// create source
	const source = audioContext.createBufferSource()
	source.buffer = audioBuffer
	source.loop = s.loop ?? false
	
	// Apply trim settings
	const trimStart = s.trimStart ?? 0
	const trimEnd = s.trimEnd ?? audioBuffer.duration
	const offset = trimStart
	const duration = trimEnd - trimStart

	// create gain node for volume
	const gainNode = audioContext.createGain()
	gainNode.gain.value = globalVolume * (s.volume ?? 1)

	// connect source to gain
	source.connect(gainNode)

	// connect to BOTH destinations
	gainNode.connect(headphonesDestination)  // user hears it
	gainNode.connect(virtualMicDestination)  // other apps hear it (mixed with mic)

	// track the source
	const audioObj = { source, gainNode, buffer: audioBuffer, index }
	currentlyPlaying.push(audioObj)
	if (s.loop) {
		loopingAudios.set(index, audioObj)
	}

	// Start with trim offset and duration
	if (s.loop) {
		source.start(0, offset)
	} else {
		source.start(0, offset, duration)
	}
	
	source.onended = () => {
		currentlyPlaying = currentlyPlaying.filter(a => a !== audioObj)
		if (!s.loop) {
			loopingAudios.delete(index)
		}
	}
}

// stop looping sound
function stop_loop(index) {
	if (loopingAudios.has(index)) {
		const audioObj = loopingAudios.get(index)
		audioObj.source.stop()
		currentlyPlaying = currentlyPlaying.filter(a => a !== audioObj)
		loopingAudios.delete(index)
	}
}

// render buttons
async function render_sounds() {
	buttonGrid.innerHTML = ''
	for (let i = 0; i < sounds.length; i++) {
		const s = sounds[i]
		const btn = document.createElement('button')
		btn.classList.add('sound-btn')
		if (s.pinned) {
			btn.classList.add('pinned')
		}
		btn.textContent = s.name
		if (s.hotkey) {
			const hotkeySpan = document.createElement('span')
			hotkeySpan.classList.add('hotkey-badge')
			hotkeySpan.textContent = s.hotkey
			btn.appendChild(hotkeySpan)
		}
		if (s.image) {
			const imgUrl = await window.electronAPI.toFileUrl(s.image)
			btn.style.backgroundImage = `url("${imgUrl}")`
			btn.style.backgroundSize = 'cover'
			btn.style.backgroundPosition = 'center'
			btn.style.color = '#fff'
			btn.style.textShadow = '0 0 6px black'
		}
		btn.onclick = () => play_sound(i)
		btn.oncontextmenu = (e) => {
			e.preventDefault()
			show_sound_options(i)
		}
		buttonGrid.appendChild(btn)
	}
}

// show sound options
function show_sound_options(index) {
	currentSoundIndex = index
	const s = sounds[index]
	optionsPinnedToggle.checked = s.pinned ?? false
	optionsLoopToggle.checked = s.loop ?? false
	optionsSoundVolume.value = (s.volume ?? 1) * 100
	optionsVolumeValue.textContent = Math.round((s.volume ?? 1) * 100) + '%'
	optionsHotkeyBtn.textContent = s.hotkey ? `Hotkey: ${s.hotkey}` : 'Assign Hotkey'
	soundOptionsModal.style.display = 'flex'
}

// sound options - play
optionsPlayBtn.onclick = () => {
	if (currentSoundIndex !== null) {
		play_sound(currentSoundIndex)
	}
}

// sound options - pinned toggle
optionsPinnedToggle.onchange = () => {
	if (currentSoundIndex !== null) {
		sounds[currentSoundIndex].pinned = optionsPinnedToggle.checked
		save_sounds()
		render_sounds()
	}
}

// sound options - loop toggle
optionsLoopToggle.onchange = () => {
	if (currentSoundIndex !== null) {
		sounds[currentSoundIndex].loop = optionsLoopToggle.checked
		save_sounds()
		if (!optionsLoopToggle.checked) {
			stop_loop(currentSoundIndex)
		}
	}
}

// sound options - volume
optionsSoundVolume.oninput = () => {
	const vol = parseFloat(optionsSoundVolume.value) / 100
	optionsVolumeValue.textContent = Math.round(vol * 100) + '%'
	if (currentSoundIndex !== null) {
		sounds[currentSoundIndex].volume = vol
		save_sounds()
	}
}

// sound options - edit
optionsEditBtn.onclick = () => {
	if (currentSoundIndex !== null) {
		soundOptionsModal.style.display = 'none'
		show_edit_modal(currentSoundIndex)
	}
}

// sound options - trim
optionsTrimBtn.onclick = async () => {
	if (currentSoundIndex !== null) {
		soundOptionsModal.style.display = 'none'
		await show_trim_modal(currentSoundIndex)
	}
}

// show trim modal
async function show_trim_modal(index) {
	const s = sounds[index]
	const audioUrl = await window.electronAPI.toFileUrl(s.file)
	
	// Load audio buffer
	const response = await fetch(audioUrl)
	const arrayBuffer = await response.arrayBuffer()
	if (!audioContext) await init_audio()
	trimAudioBuffer = await audioContext.decodeAudioData(arrayBuffer)
	
	// Set for preview playback
	trimAudio.src = audioUrl
	
	// Initialize trim times
	trimStartTime = s.trimStart ?? 0
	trimEndTime = s.trimEnd ?? trimAudioBuffer.duration
	
	// Show modal first so canvas dimensions are available
	trimModal.style.display = 'flex'
	
	// Draw waveform after modal is visible
	setTimeout(() => {
		draw_waveform()
		update_trim_ui()
	}, 10)
}

// sound options - delete
optionsDeleteBtn.onclick = async () => {
	if (currentSoundIndex !== null) {
		const s = sounds[currentSoundIndex]
		stop_loop(currentSoundIndex)
		try {
			if (await window.electronAPI.fsExistsSync(s.file)) {
				await window.electronAPI.deleteFile(s.file)
			}
			if (s.image && await window.electronAPI.fsExistsSync(s.image)) {
				await window.electronAPI.deleteFile(s.image)
			}
		} catch (e) {
			console.error('error deleting files:', e)
		}
		sounds.splice(currentSoundIndex, 1)
		save_sounds()
		render_sounds()
		soundOptionsModal.style.display = 'none'
	}
}

// sound options - hotkey
optionsHotkeyBtn.onclick = () => {
	if (recordingHotkey) return
	recordingHotkey = true
	optionsHotkeyBtn.textContent = 'Press a key...'
	optionsHotkeyBtn.style.backgroundColor = '#e04a4a'
	const handleKeyPress = (e) => {
		e.preventDefault()
		
		// ESC to remove hotkey
		if (e.key === 'Escape') {
			if (currentSoundIndex !== null) {
				sounds[currentSoundIndex].hotkey = null
				save_sounds()
				optionsHotkeyBtn.textContent = 'Assign Hotkey'
				optionsHotkeyBtn.style.backgroundColor = ''
			}
			recordingHotkey = false
			window.removeEventListener('keydown', handleKeyPress)
			render_sounds()
			return
		}
		
		const key = e.key.toUpperCase()
		const modifiers = []
		if (e.ctrlKey) modifiers.push('Ctrl')
		if (e.altKey) modifiers.push('Alt')
		if (e.shiftKey) modifiers.push('Shift')
		const hotkeyStr = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key
		if (currentSoundIndex !== null) {
			sounds.forEach(s => {
				if (s.hotkey === hotkeyStr) s.hotkey = null
			})
			sounds[currentSoundIndex].hotkey = hotkeyStr
			save_sounds()
			optionsHotkeyBtn.textContent = `Hotkey: ${hotkeyStr}`
			optionsHotkeyBtn.style.backgroundColor = ''
		}
		recordingHotkey = false
		window.removeEventListener('keydown', handleKeyPress)
		render_sounds()
	}
	window.addEventListener('keydown', handleKeyPress)
}

// sound options - close
optionsCloseBtn.onclick = () => {
	soundOptionsModal.style.display = 'none'
	currentSoundIndex = null
}

// edit modal
function show_edit_modal(index) {
	currentSoundIndex = index
	const s = sounds[index]
	editNameInput.value = s.name
	editingImagePath = null
	if (s.image) {
		window.electronAPI.toFileUrl(s.image).then(url => {
			editImageDrop.style.backgroundImage = `url("${url}")`
		})
	} else {
		editImageDrop.style.backgroundImage = ''
	}
	editModal.style.display = 'flex'
}

editSelectImageBtn.onclick = async () => {
	const res = await window.electronAPI.selectImage()
	if (!res.canceled) {
		editingImagePath = res.file
		const url = await window.electronAPI.toFileUrl(res.file)
		editImageDrop.style.backgroundImage = `url("${url}")`
	}
}
editImageDrop.onclick = editSelectImageBtn.onclick

editImageDrop.ondragover = (e) => {
	e.preventDefault()
	e.stopPropagation()
	editImageDrop.classList.add('dragging')
}

editImageDrop.ondragleave = (e) => {
	e.preventDefault()
	e.stopPropagation()
	editImageDrop.classList.remove('dragging')
}

editImageDrop.ondrop = async (e) => {
	e.preventDefault()
	e.stopPropagation()
	editImageDrop.classList.remove('dragging')
	
	const file = e.dataTransfer.files[0]
	if (!file || !file.type.startsWith('image/')) {
		alert('Please drop an image file')
		return
	}
	
	editingImagePath = file.path
	const url = URL.createObjectURL(file)
	editImageDrop.style.backgroundImage = `url("${url}")`
}

editCancelBtn.onclick = () => {
	editModal.style.display = 'none'
	editingImagePath = null
}

editSaveBtn.onclick = async () => {
	if (currentSoundIndex !== null) {
		const s = sounds[currentSoundIndex]
		s.name = editNameInput.value.trim() || s.name
		if (editingImagePath) {
			if (s.image && await window.electronAPI.fsExistsSync(s.image)) {
				await window.electronAPI.deleteFile(s.image)
			}
			const imageDest = `${IMAGE_DIR}/${await window.electronAPI.basename(editingImagePath)}`
			await window.electronAPI.copyFile(editingImagePath, imageDest)
			s.image = imageDest
		}
		save_sounds()
		render_sounds()
		editModal.style.display = 'none'
		editingImagePath = null
	}
}

// settings modal
settingsBtn.onclick = async () => {
	await populate_audio_devices()
	settingsModal.style.display = 'flex'
}

inputDeviceSelect.onchange = async () => {
	settings.inputDevice = inputDeviceSelect.value
	save_settings()
	await connect_microphone()
}

outputDeviceSelect.onchange = async () => {
	settings.outputDevice = outputDeviceSelect.value
	save_settings()
	await set_output_devices()
}

virtualMicSelect.onchange = async () => {
	settings.virtualMicDevice = virtualMicSelect.value
	save_settings()
	await set_output_devices()
}

minimizeToTrayCheck.onchange = async () => {
	settings.minimizeToTray = minimizeToTrayCheck.checked
	save_settings()
	await window.electronAPI.setMinimizeToTray(settings.minimizeToTray)
}

settingsCloseBtn.onclick = () => {
	settingsModal.style.display = 'none'
}

// search
searchInput.oninput = () => {
	const q = searchInput.value.toLowerCase()
	document.querySelectorAll('.sound-btn').forEach(btn => {
		btn.style.display = btn.textContent.toLowerCase().includes(q) ? 'block' : 'none'
	})
}

// volume
volumeSlider.oninput = () => {
	globalVolume = parseFloat(volumeSlider.value)
}

// stop all
stopAllBtn.onclick = () => {
	currentlyPlaying.forEach(a => {
		if (a.source) a.source.stop()
	})
	currentlyPlaying = []
	loopingAudios.clear()
}

// modal
addSoundBtn.onclick = () => soundModal.style.display = 'flex'
cancelAddBtn.onclick = reset_modal

// select audio
selectAudioBtn.onclick = async () => {
	const res = await window.electronAPI.selectAudio()
	if (!res.canceled) {
		selectedAudioPath = res.file
		selectedAudioSpan.textContent = await window.electronAPI.basename(res.file)
	}
}

window.electronAPI.onPlaySoundRequest(async (soundIndex) => {
	await play_sound(soundIndex)
})

window.electronAPI.onStopAllSoundsRequest(() => {
	currentlyPlaying.forEach(a => {
		if (a.source) a.source.stop()
	})
	currentlyPlaying = []
	loopingAudios.clear()
})

// Add sound modal - image drag and drop
imageDrop.onclick = async () => {
	const res = await window.electronAPI.selectImage()
	if (!res.canceled) {
		selectedImagePath = res.file
		const url = await window.electronAPI.toFileUrl(res.file)
		imageDrop.style.backgroundImage = `url("${url}")`
	}
}

imageDrop.ondragover = (e) => {
	e.preventDefault()
	e.stopPropagation()
	imageDrop.classList.add('dragging')
}

imageDrop.ondragleave = (e) => {
	e.preventDefault()
	e.stopPropagation()
	imageDrop.classList.remove('dragging')
}

imageDrop.ondrop = async (e) => {
	e.preventDefault()
	e.stopPropagation()
	imageDrop.classList.remove('dragging')
	
	const file = e.dataTransfer.files[0]
	if (!file || !file.type.startsWith('image/')) {
		alert('Please drop an image file')
		return
	}
	
	selectedImagePath = file.path
	const url = URL.createObjectURL(file)
	imageDrop.style.backgroundImage = `url("${url}")`
}

// fake progress system to prevent perceived freezing
let fakeProgressInterval = null
let currentFakeProgress = 0
let lastRealProgress = 0

function startFakeProgress() {
	currentFakeProgress = 0
	lastRealProgress = 0
	
	if (fakeProgressInterval) {
		clearInterval(fakeProgressInterval)
	}
	
	// Slowly increment fake progress when no real progress is coming
	fakeProgressInterval = setInterval(() => {
		if (currentFakeProgress < 90) {
			// Slow down as we approach 90%
			const increment = Math.max(0.1, (90 - currentFakeProgress) / 100)
			currentFakeProgress = Math.min(90, currentFakeProgress + increment)
			
			// Only update if no real progress has come in recently
			if (currentFakeProgress > lastRealProgress) {
				downloadProgress.style.width = currentFakeProgress + '%'
				downloadPercent.textContent = Math.round(currentFakeProgress) + '%'
			}
		}
	}, 200)
}

function stopFakeProgress() {
	if (fakeProgressInterval) {
		clearInterval(fakeProgressInterval)
		fakeProgressInterval = null
	}
}

// listen for download progress updates
window.electronAPI.onDownloadProgress((progress) => {
	lastRealProgress = progress.percent
	currentFakeProgress = progress.percent
	downloadProgress.style.width = progress.percent + '%'
	downloadPercent.textContent = Math.round(progress.percent) + '%'
	downloadStatus.textContent = progress.status
	
	// Stop fake progress when download completes
	if (progress.percent >= 100) {
		stopFakeProgress()
	}
})

// clean youtube URL to remove extra parameters
function clean_youtube_url(url) {
	try {
		const urlObj = new URL(url)
		// Check if it's a YouTube URL
		if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
			// Keep only the video ID parameter
			const videoId = urlObj.searchParams.get('v')
			if (videoId) {
				return `https://www.youtube.com/watch?v=${videoId}`
			}
			// Handle youtu.be short links
			if (urlObj.hostname.includes('youtu.be')) {
				const videoId = urlObj.pathname.slice(1).split('?')[0]
				return `https://www.youtube.com/watch?v=${videoId}`
			}
		}
		return url // Return original if not YouTube or can't parse
	} catch (e) {
		return url // Return original if URL parsing fails
	}
}

// save
saveAddBtn.onclick = async () => {
	const name = soundNameInput.value.trim()
	let url = soundUrlInput.value.trim()
	if (!name || (!selectedAudioPath && !url)) return
	
	let audioDest
	if (selectedAudioPath) {
		audioDest = `${AUDIO_DIR}/${await window.electronAPI.basename(selectedAudioPath)}`
		await window.electronAPI.copyFile(selectedAudioPath, audioDest)
	} else {
		// Clean YouTube URL
		url = clean_youtube_url(url)
		
		// Show download modal
		downloadModal.style.display = 'flex'
		downloadStatus.textContent = 'Starting download...'
		downloadProgress.style.width = '0%'
		downloadPercent.textContent = '0%'
		
		// Start fake progress to show activity
		startFakeProgress()
		
		const safeName = name.replace(/[^\w\-]+/g, '_')
		audioDest = `${AUDIO_DIR}/${safeName}.mp3`
		
		try {
			await window.electronAPI.downloadFile(url, AUDIO_DIR, name, CONFIG_PATH)
			stopFakeProgress()
			downloadModal.style.display = 'none'
		} catch (error) {
			stopFakeProgress()
			downloadModal.style.display = 'none'
			alert('Download failed: ' + error.message)
			return
		}
	}
	
	let imageDest = ''
	if (selectedImagePath) {
		imageDest = `${IMAGE_DIR}/${await window.electronAPI.basename(selectedImagePath)}`
		await window.electronAPI.copyFile(selectedImagePath, imageDest)
	}
	
	sounds.push({ name, file: audioDest, image: imageDest, volume: 1, loop: false, hotkey: null, pinned: false, trimStart: 0, trimEnd: null })
	save_sounds()
	render_sounds()
	reset_modal()
	
	// Show trim modal for newly added sound
	const newIndex = sounds.length - 1
	await show_trim_modal(newIndex)
}

// reset modal
function reset_modal() {
	soundModal.style.display = 'none'
	soundNameInput.value = ''
	soundUrlInput.value = ''
	selectedAudioPath = null
	selectedImagePath = null
	imageDrop.style.backgroundImage = ''
	selectedAudioSpan.textContent = 'no file selected'
}

// draw waveform
function draw_waveform() {
	if (!trimAudioBuffer) return
	
	const canvas = waveformCanvas
	const ctx = canvas.getContext('2d')
	const dpr = window.devicePixelRatio || 1
	
	// Set canvas size
	const rect = canvas.getBoundingClientRect()
	canvas.width = rect.width * dpr
	canvas.height = rect.height * dpr
	ctx.scale(dpr, dpr)
	
	const width = rect.width
	const height = rect.height
	
	// Clear
	ctx.fillStyle = '#0e0806'
	ctx.fillRect(0, 0, width, height)
	
	// Get audio data
	const data = trimAudioBuffer.getChannelData(0)
	const step = Math.ceil(data.length / width)
	const amp = height / 2
	
	// Draw waveform
	ctx.strokeStyle = '#f3b15a'
	ctx.lineWidth = 1
	ctx.beginPath()
	
	for (let i = 0; i < width; i++) {
		const min = Math.min(...data.slice(i * step, (i + 1) * step))
		const max = Math.max(...data.slice(i * step, (i + 1) * step))
		ctx.moveTo(i, (1 + min) * amp)
		ctx.lineTo(i, (1 + max) * amp)
	}
	
	ctx.stroke()
}

// update trim UI
function update_trim_ui() {
	if (!trimAudioBuffer) return
	
	const duration = trimAudioBuffer.duration
	const startPercent = (trimStartTime / duration) * 100
	const endPercent = (trimEndTime / duration) * 100
	
	// Position start handle from left
	trimHandleStart.style.left = startPercent + '%'
	trimHandleStart.style.right = 'auto'
	
	// Position end handle from right to prevent it going off-screen
	trimHandleEnd.style.left = 'auto'
	trimHandleEnd.style.right = (100 - endPercent) + '%'
	
	trimSelection.style.left = startPercent + '%'
	trimSelection.style.width = (endPercent - startPercent) + '%'
	
	trimStartDisplay.textContent = trimStartTime.toFixed(1) + 's'
	trimEndDisplay.textContent = trimEndTime.toFixed(1) + 's'
	trimDuration.textContent = '(' + (trimEndTime - trimStartTime).toFixed(1) + 's)'
}

// trim handle dragging
trimHandleStart.addEventListener('mousedown', (e) => {
	isDraggingTrim = true
	dragTarget = 'start'
	e.preventDefault()
})

trimHandleEnd.addEventListener('mousedown', (e) => {
	isDraggingTrim = true
	dragTarget = 'end'
	e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
	if (!isDraggingTrim || !trimAudioBuffer) return
	
	const rect = waveformCanvas.getBoundingClientRect()
	const x = e.clientX - rect.left
	const percent = Math.max(0, Math.min(1, x / rect.width))
	const time = percent * trimAudioBuffer.duration
	
	if (dragTarget === 'start') {
		trimStartTime = Math.min(time, trimEndTime - 0.1)
	} else if (dragTarget === 'end') {
		trimEndTime = Math.max(time, trimStartTime + 0.1)
	}
	
	update_trim_ui()
})

document.addEventListener('mouseup', () => {
	isDraggingTrim = false
	dragTarget = null
})

// update playhead position
function updatePlayhead() {
	if (!trimAudioBuffer) return
	
	const currentTime = trimAudio.currentTime
	const duration = trimAudioBuffer.duration
	const percent = (currentTime / duration) * 100
	
	trimPlayhead.style.left = percent + '%'
	trimCurrentTime.textContent = '▶ ' + currentTime.toFixed(1) + 's'
}

// start playhead tracking
function startPlayheadTracking() {
	if (playheadInterval) {
		clearInterval(playheadInterval)
	}
	
	trimPlayhead.classList.add('active')
	playheadInterval = setInterval(updatePlayhead, 50)
}

// stop playhead tracking
function stopPlayheadTracking() {
	if (playheadInterval) {
		clearInterval(playheadInterval)
		playheadInterval = null
	}
	
	trimPlayhead.classList.remove('active')
	trimCurrentTime.textContent = ''
}

// trim modal handlers
trimPlayPreview.onclick = () => {
	if (trimStartTime < trimEndTime) {
		trimAudio.currentTime = trimStartTime
		trimAudio.play()
		startPlayheadTracking()
		
		setTimeout(() => {
			trimAudio.pause()
			stopPlayheadTracking()
		}, (trimEndTime - trimStartTime) * 1000)
	}
}

// listen for audio ended/paused to stop playhead
trimAudio.addEventListener('pause', () => {
	stopPlayheadTracking()
})

trimAudio.addEventListener('ended', () => {
	stopPlayheadTracking()
})

trimCancel.onclick = () => {
	stopPlayheadTracking()
	trimModal.style.display = 'none'
	trimAudio.pause()
	trimAudio.src = ''
	trimAudioBuffer = null
}

trimSave.onclick = () => {
	if (currentSoundIndex !== null && trimStartTime < trimEndTime) {
		sounds[currentSoundIndex].trimStart = trimStartTime
		sounds[currentSoundIndex].trimEnd = trimEndTime
		save_sounds()
	}
	stopPlayheadTracking()
	trimModal.style.display = 'none'
	trimAudio.pause()
	trimAudio.src = ''
	trimAudioBuffer = null
}

// global hotkey listener
window.addEventListener('keydown', (e) => {
	if (recordingHotkey) return
	if (e.target.tagName === 'INPUT') return
	const key = e.key.toUpperCase()
	const modifiers = []
	if (e.ctrlKey) modifiers.push('Ctrl')
	if (e.altKey) modifiers.push('Alt')
	if (e.shiftKey) modifiers.push('Shift')
	const hotkeyStr = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key
	const index = sounds.findIndex(s => s.hotkey === hotkeyStr)
	if (index !== -1) {
		e.preventDefault()
		play_sound(index)
	}
})

// start
;(async () => {
	await init_paths()
	await load_settings()
	await load_sounds()
	await init_audio()
})()