# Audio files

## basement-radio.m4a

- **What:** the basement radio's placeholder, 7 min 4.5 s, looped whole.
- **Source:** supplied by the project owner on 2026-11-27 as "Basement placeholder.mp3" (10,189,773 bytes, stereo 44.1 kHz MP3). The owner should confirm its rights before release.
- **Encoding:** `afconvert -f m4af -d aac -b 64000 -c 1` (mono AAC-LC in MP4, about 62 kbps). The file is 3,374,957 bytes, SHA-256 `f3f498c156b35f580eb3ae016e4ce282841c626c15b103af246d7a11b3f9cc6a`.

## living-radio.m4a

- **What:** the living room radio's placeholder, 4 min 59.5 s, looped whole.
- **Source:** supplied by the project owner on 2026-11-27 as "Room placeholder.wav" (52,826,190 bytes, stereo 44.1 kHz 16-bit WAV). The owner should confirm its rights before release.
- **Encoding:** `afconvert -f m4af -d aac -b 64000 -c 1` (mono AAC-LC in MP4, about 63 kbps). The file is 2,405,315 bytes, SHA-256 `9b03a41ae5a177eb726a8c9ca0283e531caea61858b78939fec68cae2f2e18b5`.

## radio-placeholder.m4a (retired)

- No longer played: replaced by `basement-radio.m4a` on 2026-11-27. The synthesis script `assets-source/audio/radio_placeholder.mjs` stays, and can rebuild it.

- **Was:** the basement radio's placeholder loop, 12.8 s (eight bars at 150 BPM). It is a tremolo-picked minor riff in power chords over a blast beat, band-limited to sound like an old AM set, with hiss and crackle.
- **Source:** original to this project. `assets-source/audio/radio_placeholder.mjs` synthesizes it deterministically; it uses no samples, recordings, or third-party material. It stands in until the owner's own recording replaces it via `src/audio/tracks.ts`.
- **Encoding:** rendered as 48 kHz mono 16-bit WAV, then encoded with `afconvert -f m4af -d aac -b 48000` (AAC-LC in MP4, about 49 kbps). The file is 87,199 bytes, SHA-256 `45cb4f1dfa42f87562200eb8dea94cae5fe573e4d141202170770535190bfef5`.
- **Tested formats:** AAC in MP4 decodes in Chromium and Firefox (Playwright builds on macOS) and is universally supported by current browsers. Ogg Opus would be smaller, but the available encoder could not write it.
