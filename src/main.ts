import './style.css';
import { startRenderer } from './core/renderer';
import { loadGallery } from './environments/gallery';
import { createGreybox } from './environments/greybox';
import { loadExhibits } from './exhibition/manifest';
import { createAmbience } from './audio/ambience';
import { renderDirectory } from './ui/directory-list';
import { createDetails } from './ui/details';
import { createViewer } from './ui/viewer';
import { loadSettings, saveSettings } from './ui/settings';

async function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  const status = document.querySelector<HTMLParagraphElement>('#status');

  const overlay = document.querySelector<HTMLElement>('#controls');
  const startButton = document.querySelector<HTMLButtonElement>('#start-walk');
  const instructions = document.querySelector<HTMLElement>('#instructions');
  const crosshair = document.querySelector<HTMLElement>('#crosshair');
  const prompt = document.querySelector<HTMLElement>('#interaction');
  const label = document.querySelector<HTMLElement>('#exhibit-label');
  const dialog = document.querySelector<HTMLDialogElement>('#exhibit-details');
  const viewer = document.querySelector<HTMLDialogElement>('#essay-viewer');

  const catalogue = document.querySelector<HTMLDialogElement>('#catalogue');
  const catalogueList = catalogue?.querySelector<HTMLOListElement>('ol');

  if (
    !canvas ||
    !status ||
    !overlay ||
    !startButton ||
    !instructions ||
    !crosshair ||
    !prompt ||
    !label ||
    !dialog ||
    !viewer ||
    !catalogue ||
    !catalogueList
  )
    throw new Error('The preview markup is missing.');

  const viewport = document.querySelector<HTMLElement>('#viewport');
  const ambience = createAmbience((state, live) => {
    if (!viewport) return;
    viewport.dataset.ambience = state;
    viewport.dataset.ambienceLayers = live.join(' ');
  });

  try {
    const exhibits = await loadExhibits();
    // The greybox stays available as a traversal and interaction test room.
    const useGreybox =
      new URLSearchParams(location.search).get('env') === 'greybox';
    const essayViewer = createViewer(viewer);
    renderDirectory(catalogueList, exhibits, essayViewer.open);
    catalogue.addEventListener('close', () => startButton.focus());
    const gallery = useGreybox ? undefined : await loadGallery(exhibits);
    const world = gallery
      ? {
          ...gallery,
          actionAt: (
            hit: Parameters<typeof gallery.actionAt>[0],
            feet: Parameters<typeof gallery.actionAt>[1],
          ) =>
            gallery.isCatalogue(hit)
              ? {
                  label: 'E / Click · Open Exhibition Directory',
                  pause: true,
                  run: () => catalogue.showModal(),
                }
              : gallery.actionAt(hit, feet),
        }
      : createGreybox();
    canvas.dataset.environment = useGreybox ? 'greybox' : 'gallery';
    const view = startRenderer(
      world,
      canvas,
      overlay,
      startButton,
      instructions,
      crosshair,
      prompt,
      label,
      // Closing the details leaves the visitor paused on Resume walk.
      createDetails(dialog, () => startButton.focus(), essayViewer.open).open,
      // Below ground, the basement's ambience takes over from the gallery's.
      (feet) => ambience.setZone(feet.y < -1.2 ? 'basement' : 'gallery'),
    );
    if (import.meta.hot)
      import.meta.hot.dispose(() => {
        view.dispose();
        ambience.dispose();
      });

    const settings = loadSettings();
    const input = (id: string) => document.querySelector<HTMLInputElement>(id);
    const lookSpeed = input('#look-speed');
    const resolution = input('#resolution');
    const resolutionValue = document.querySelector('#resolution-value');
    const spotlights = input('#spotlights');
    const sound = input('#sound');
    const volume = input('#volume');
    const volumeValue = document.querySelector('#volume-value');
    const mute = input('#mute');
    // Every change applies immediately and is saved for the next visit.
    function apply() {
      view.setLookScale(settings.lookScale);
      view.setResolution(settings.resolution);
      view.setSpotlights(settings.spotlights);
      const percent = `${Math.round(settings.resolution * 100)}%`;
      if (resolutionValue) resolutionValue.textContent = percent;
      resolution?.setAttribute('aria-valuetext', percent);
      ambience.setVolume(settings.volume);
      ambience.setMuted(settings.muted);
      const level = `${Math.round(settings.volume * 100)}%`;
      if (volumeValue) volumeValue.textContent = level;
      volume?.setAttribute('aria-valuetext', level);
    }
    function save() {
      apply();
      saveSettings(settings);
    }
    if (lookSpeed) lookSpeed.value = String(settings.lookScale);
    if (resolution) resolution.value = String(settings.resolution);
    if (spotlights) spotlights.checked = settings.spotlights;
    if (sound) sound.checked = settings.sound;
    if (volume) volume.value = String(settings.volume);
    if (mute) mute.checked = settings.muted;
    apply();
    lookSpeed?.addEventListener('input', () => {
      settings.lookScale = Number(lookSpeed.value);
      save();
    });
    resolution?.addEventListener('input', () => {
      settings.resolution = Number(resolution.value);
      save();
    });
    spotlights?.addEventListener('change', () => {
      settings.spotlights = spotlights.checked;
      save();
    });
    // Each of these is a visitor gesture, which audio playback needs.
    sound?.addEventListener('change', () => {
      settings.sound = sound.checked;
      ambience.setEnabled(settings.sound);
      save();
    });
    startButton.addEventListener('click', () => {
      ambience.setEnabled(settings.sound);
      // The arrival elevator opens onto the gallery once the walk starts;
      // with reduced motion its doors are simply open.
      gallery?.elevator.open(
        matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    });
    volume?.addEventListener('input', () => {
      settings.volume = Number(volume.value);
      save();
    });
    mute?.addEventListener('change', () => {
      settings.muted = mute.checked;
      save();
    });
    canvas.dataset.exhibitCount = String(exhibits.length);
    status.hidden = true;
  } catch (error) {
    console.error('Virtual Exhibition could not start.', error);
    const fallback = document.createElement('a');
    fallback.href = './directory.html';
    fallback.textContent = 'Open the accessible exhibition directory';
    status.replaceChildren(
      document.createTextNode(
        'Could not load the preview. Check that WebGL 2 is available and try reloading. ',
      ),
      fallback,
    );
  }
}

void start();
