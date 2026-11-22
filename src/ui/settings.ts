export interface Settings {
  lookScale: number;
}

const KEY = 'virtual-exhibition-settings';
const DEFAULTS: Settings = { lookScale: 1 };

// Settings are a per-visitor convenience: storage can be blocked or empty.
export function loadSettings(): Settings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const lookScale =
      typeof stored === 'object' && stored && 'lookScale' in stored
        ? Number(stored.lookScale)
        : DEFAULTS.lookScale;
    return {
      lookScale:
        lookScale >= 0.5 && lookScale <= 2 ? lookScale : DEFAULTS.lookScale,
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
