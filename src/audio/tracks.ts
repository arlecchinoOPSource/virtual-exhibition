export interface Track {
  title: string;
  // Tried in order; the first the browser can play is fetched.
  sources: readonly { url: string; type: string }[];
  // The musical loop length. Decoders that keep encoder padding return a
  // longer buffer; playback loops exactly this much of it.
  loopSeconds?: number;
  // Radio level before distance, under the global volume.
  level: number;
}

// The radios' soundtracks. To play other recordings, change these entries:
// their files, loop length, and level. Rights for each file are recorded in
// public/audio/CREDITS.md.
export const RADIO_TRACK: Track = {
  title: 'Basement radio placeholder (owner-supplied)',
  sources: [
    { url: 'audio/basement-radio.m4a', type: 'audio/mp4; codecs="mp4a.40.2"' },
  ],
  // Louder than the first placeholder's 0.55, as the owner asked.
  level: 1.0,
};

// The living room's copy of the radio.
export const LIVING_TRACK: Track = {
  title: 'Living room radio placeholder (owner-supplied)',
  sources: [
    { url: 'audio/living-radio.m4a', type: 'audio/mp4; codecs="mp4a.40.2"' },
  ],
  level: 1.0,
};
