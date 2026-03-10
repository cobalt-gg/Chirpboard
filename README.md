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

1. Install [VB-Audio Virtual Cable](https://vb-audio.com/Cable/index.htm) (or equivalent)
2. In ChirpBoard Settings, set **Virtual Mic** to your virtual cable output
3. In Discord/OBS, set the input device to that same virtual cable

## Development

```bash
npm install
npm start
```

## Build

```bash
npm run dist
```

Outputs a Windows installer to `dist/`.

## HTTP API

ChirpBoard exposes a local API on `http://127.0.0.1:3939`:

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/sounds` | — | List all sounds with images |
| GET | `/sounds/names` | — | List sound names only |
| POST | `/play` | `{ "index": 0 }` or `{ "name": "..." }` | Play a sound |
| POST | `/stop` | — | Stop all sounds |
