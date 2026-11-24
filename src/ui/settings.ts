export interface Settings {
  lookScale: number;
  resolution: number;
  spotlights: boolean;
  sound: boolean;
  volume: number;
  muted: boolean;
}

const KEY = 'virtual-exhibition-settings';
// Sound is opt-in, so it starts off.
const DEFAULTS: Settings = {
  lookScale: 1,
  resolution: 1,
  spotlights: true,
  sound: false,
  volume: 0.6,
  muted: false,
};

const flag = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

function inRange(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return number >= min && number <= max ? number : fallback;
}

// Settings are a per-visitor convenience: storage can be blocked or empty.
export function loadSettings(): Settings {
  try {
    const stored: Partial<Record<keyof Settings, unknown>> = JSON.parse(
      localStorage.getItem(KEY) ?? '{}',
    );
    return {
      lookScale: inRange(stored.lookScale, 0.5, 2, DEFAULTS.lookScale),
      resolution: inRange(stored.resolution, 0.5, 1, DEFAULTS.resolution),
      spotlights: flag(stored.spotlights, DEFAULTS.spotlights),
      sound: flag(stored.sound, DEFAULTS.sound),
      volume: inRange(stored.volume, 0, 1, DEFAULTS.volume),
      muted: flag(stored.muted, DEFAULTS.muted),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Unsaved settings still apply for this visit.
  }
}
