# Audio files

## radio-placeholder.m4a

- **What:** the basement radio's placeholder loop, 12.8 s (eight bars at 150 BPM). It is a tremolo-picked minor riff in power chords over a blast beat, band-limited to sound like an old AM set, with hiss and crackle.
- **Source:** original to this project. `assets-source/audio/radio_placeholder.mjs` synthesizes it deterministically; it uses no samples, recordings, or third-party material. It stands in until the owner's own recording replaces it via `src/audio/tracks.ts`.
- **Encoding:** rendered as 48 kHz mono 16-bit WAV, then encoded with `afconvert -f m4af -d aac -b 48000` (AAC-LC in MP4, about 49 kbps). The file is 87,199 bytes, SHA-256 `45cb4f1dfa42f87562200eb8dea94cae5fe573e4d141202170770535190bfef5`.
- **Tested formats:** AAC in MP4 decodes in Chromium and Firefox (Playwright builds on macOS) and is universally supported by current browsers. Ogg Opus would be smaller, but the available encoder could not write it.
- **Rights:** original work for this exhibition; no attribution required.
