import './style.css';
import { Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Object3D, PerspectiveCamera } from 'three';
import { startRenderer } from './core/renderer';
import { loadGallery } from './environments/gallery';
import { createGreybox } from './environments/greybox';
import { loadExhibits } from './exhibition/manifest';
import { createAmbience } from './audio/ambience';
import { createRadio } from './audio/radio';
import type { RadioState } from './audio/radio';
import { RADIO_TRACK } from './audio/tracks';
import { renderDirectory } from './ui/directory-list';
import { createDetails } from './ui/details';
import { requireGalleryPassword } from './ui/gallery-entry';
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
  const entry = document.querySelector<HTMLDialogElement>('#gallery-entry');

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
    !entry ||
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
  // The set's pilot lamp shows power; its dial glows while it plays.
  let radioLamp: MeshStandardMaterial | undefined;
  let radioDial: MeshStandardMaterial | undefined;
  function showRadio(state: RadioState) {
    radioLamp?.emissive.setHex(state === 'off' ? 0x000000 : 0xff7a1a);
    radioDial?.emissive.setHex(state === 'playing' ? 0x8a5a20 : 0x000000);
    if (!viewport) return;
    viewport.dataset.radio = state;
  }
  const radio = createRadio(
    RADIO_TRACK,
    () => ambience.channel(),
    (state, sources) => {
      showRadio(state);
      if (viewport) viewport.dataset.radioSources = String(sources);
    },
  );
  const radioLabels: Record<RadioState, string> = {
    off: 'E / Click · Turn the radio on',
    silent: 'E / Click · Turn the radio off · Sound is off in Settings',
    idle: 'E / Click · Turn the radio off',
    loading: 'E / Click · Turn the radio off · Warming up…',
    playing: 'E / Click · Turn the radio off',
    blocked: 'E / Click · Let the radio play',
    unavailable: 'The radio is silent · E / Click to try again',
  };
  let radioPower: Object3D | undefined;
  const head = new Vector3();
  const facing = new Vector3();
  const up = new Vector3();
  // Finds the set once the basement has loaded, then follows the visitor.
  function followRadio(
    feet: Vector3,
    camera: PerspectiveCamera,
    downstairs: Object3D | undefined,
  ) {
    if (!radioPower && downstairs) {
      const power = downstairs.getObjectByName('Radio_Basement_Power');
      const emitter = downstairs.getObjectByName('Radio_Basement_Emitter');
      if (power && emitter) {
        radioPower = power;
        const material = (name: string) => {
          const node = downstairs.getObjectByName(name);
          return node instanceof Mesh &&
            node.material instanceof MeshStandardMaterial
            ? node.material
            : undefined;
        };
        radioLamp = material('Radio_Basement_Status');
        radioDial = material('Radio_Basement_Dial');
        radio.setReady(emitter.getWorldPosition(new Vector3()));
      }
    }
    radio.setZone(feet.y < -1.2);
    camera.getWorldPosition(head);
    camera.getWorldDirection(facing);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    radio.listen(head, facing, up);
  }

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
          ) => {
            const action = gallery.isCatalogue(hit)
              ? {
                  label: 'E / Click · Open Exhibition Directory',
                  pause: true,
                  run: () => catalogue.showModal(),
                }
              : radioPower && hit === radioPower
                ? { label: radioLabels[radio.state], run: () => radio.press() }
                : gallery.actionAt(hit, feet);
            // Every scene action is a gesture: unlock audio inside it, before
            // the door awaits the basement or the radio its track.
            return (
              action && {
                ...action,
                run() {
                  ambience.unlock();
                  action.run();
                },
              }
            );
          },
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
      (feet, camera) => {
        ambience.setZone(feet.y < -1.2 ? 'basement' : 'gallery');
        followRadio(feet, camera, gallery?.passes[0]);
      },
    );
    // A blocked radio retries quietly on the visitor's next gesture.
    const retryAudio = () => {
      if (radio.state === 'blocked') ambience.unlock();
    };
    window.addEventListener('pointerdown', retryAudio);
    window.addEventListener('keydown', retryAudio);
    const hide = () => radio.setHidden(document.hidden);
    document.addEventListener('visibilitychange', hide);
    if (import.meta.hot)
      import.meta.hot.dispose(() => {
        window.removeEventListener('pointerdown', retryAudio);
        window.removeEventListener('keydown', retryAudio);
        document.removeEventListener('visibilitychange', hide);
        view.dispose();
        radio.dispose();
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
      radio.setSound(settings.sound);
      save();
    });
    startButton.addEventListener('click', () => {
      ambience.setEnabled(settings.sound);
      radio.setSound(settings.sound);
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
    if (gallery) requireGalleryPassword(entry, startButton);
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
