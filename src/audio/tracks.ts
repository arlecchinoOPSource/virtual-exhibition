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

// The basement radio's soundtrack. To play the owner's recording instead of
// the placeholder, change this entry: its files, loop length, and level.
// Rights for each file are recorded in public/audio/CREDITS.md.
export const RADIO_TRACK: Track = {
  title: 'Radio placeholder loop (original, synthesized)',
  sources: [
    {
      url: 'audio/radio-placeholder.m4a',
      type: 'audio/mp4; codecs="mp4a.40.2"',
    },
  ],
  loopSeconds: 12.8,
  level: 0.55,
};
