# ChirpBoard

A lightweight Electron soundboard with virtual mic routing. Play sounds into Discord, OBS, or any other app.

## Features

- Play sounds via buttons, hotkeys, or HTTP API
- Download audio directly from YouTube URLs
- Trim audio clips with a visual waveform editor
- Route sounds to a virtual mic (mic + soundboard merged)
- Pin, loop, and per-sound volume controls
- Minimize to tray

## Setup

**Windows:** Install [VB-Audio Virtual Cable](https://vb-audio.com/Cable/index.htm)

**macOS:** Install [BlackHole](https://github.com/ExistentialAudio/BlackHole)

**Linux (PulseAudio):**
```bash
pactl load-module module-null-sink sink_name=chirpboard sink_properties=device.description=ChirpBoard
```

**Linux (PipeWire):** Use `pw-loopback` or [qpwgraph](https://github.com/rncbc/qpwgraph) to create a virtual sink.

Then in ChirpBoard Settings, set **Virtual Mic** to that virtual device. In Discord/OBS, set input to the same device.

## Development

```bash
npm install
npm start
```

## Build

```bash
# Windows installer
npm run dist -- --win

# Linux (AppImage + deb)
npm run dist -- --linux
```

Outputs to `dist/`.

## HTTP API

ChirpBoard exposes a local API on `http://127.0.0.1:3939`:

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/sounds` | — | List all sounds with images |
| GET | `/sounds/names` | — | List sound names only |
| POST | `/play` | `{ "index": 0 }` or `{ "name": "..." }` | Play a sound |
| POST | `/stop` | — | Stop all sounds |
