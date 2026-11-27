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
import { LIVING_TRACK, RADIO_TRACK } from './audio/tracks';
import type { Track } from './audio/tracks';
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
  const radioLabels: Record<RadioState, string> = {
    off: 'E / Click · Turn the radio on',
    silent: 'E / Click · Turn the radio off · Sound is off in Settings',
    idle: 'E / Click · Turn the radio off',
    loading: 'E / Click · Turn the radio off · Warming up…',
    playing: 'E / Click · Turn the radio off',
    blocked: 'E / Click · Let the radio play',
    unavailable: 'The radio is silent · E / Click to try again',
  };
  const head = new Vector3();
  const facing = new Vector3();
  const up = new Vector3();
  // One valve radio set: its playback, and its nodes once its model is in the
  // scene. `key` names the viewport's data attributes (radio, radioSources).
  function mountRadio(track: Track, prefix: string, key: string) {
    let lamp: MeshStandardMaterial | undefined;
    let dial: MeshStandardMaterial | undefined;
    let power: Object3D | undefined;
    let placed = false;
    // The set's pilot lamp shows power; its dial glows while it plays.
    const radio = createRadio(
      track,
      () => ambience.channel(),
      (state, sources) => {
        lamp?.emissive.setHex(state === 'off' ? 0x000000 : 0xff7a1a);
        dial?.emissive.setHex(state === 'playing' ? 0x8a5a20 : 0x000000);
        if (!viewport) return;
        viewport.dataset[key] = state;
        viewport.dataset[`${key}Sources`] = String(sources);
      },
    );
    return {
      radio,
      isPower: (hit: Object3D) => power !== undefined && hit === power,
      // Places the set's sound as soon as any root carries its emitter (or the
      // gallery's anchor for it), binds its controls once its model loads,
      // and follows the visitor.
      follow(
        camera: PerspectiveCamera,
        roots: readonly (Object3D | undefined)[],
      ) {
        for (const root of roots) {
          if (!root) continue;
          if (!placed) {
            const emitter =
              root.getObjectByName(`${prefix}_Emitter`) ??
              root.getObjectByName(`${prefix}_Anchor`);
            if (emitter) {
              placed = true;
              radio.setReady(emitter.getWorldPosition(new Vector3()));
            }
          }
          const switchNode = power
            ? undefined
            : root.getObjectByName(`${prefix}_Power`);
          if (switchNode) {
            power = switchNode;
            const material = (name: string) => {
              const node = root.getObjectByName(name);
              return node instanceof Mesh &&
                node.material instanceof MeshStandardMaterial
                ? node.material
                : undefined;
            };
            lamp = material(`${prefix}_Status`);
            dial = material(`${prefix}_Dial`);
            radio.sync();
          }
        }
        camera.getWorldPosition(head);
        camera.getWorldDirection(facing);
        up.set(0, 1, 0).applyQuaternion(camera.quaternion);
        radio.listen(head, facing, up);
      },
    };
  }
  // Both sets play from the visitor's arrival and keep playing wherever they
  // walk (owner's request); each is positional, so it grows louder nearby.
  const basementRadio = mountRadio(RADIO_TRACK, 'Radio_Basement', 'radio');
  const livingRadio = mountRadio(LIVING_TRACK, 'Radio_Living', 'livingRadio');
  for (const { radio } of [basementRadio, livingRadio]) radio.setZone(true);
  const radios = [basementRadio, livingRadio];

  try {
    const exhibits = await loadExhibits();
    // The greybox stays available as a traversal and interaction test room.
    const useGreybox =
      new URLSearchParams(location.search).get('env') === 'greybox';
    const essayViewer = createViewer(viewer);
    renderDirectory(catalogueList, exhibits, essayViewer.open);
    catalogue.addEventListener('close', () => startButton.focus());
    const gallery = useGreybox ? undefined : await loadGallery(exhibits);
    const radioAction = (hit: Object3D | undefined) => {
      const set = hit && radios.find(({ isPower }) => isPower(hit));
      return (
        set && {
          label: radioLabels[set.radio.state],
          run: () => set.radio.press(),
        }
      );
    };
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
              : (radioAction(hit) ?? gallery.actionAt(hit, feet));
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
        basementRadio.follow(camera, [gallery?.scene, gallery?.passes[0]]);
        livingRadio.follow(camera, [gallery?.scene]);
      },
    );
    // A blocked radio retries quietly on the visitor's next gesture.
    const retryAudio = () => {
      // The first click or key starts the sound (browsers hold it until then).
      ambience.unlock();
    };
    window.addEventListener('pointerdown', retryAudio);
    window.addEventListener('keydown', retryAudio);
    const hide = () => {
      for (const { radio } of radios) radio.setHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', hide);
    if (import.meta.hot)
      import.meta.hot.dispose(() => {
        window.removeEventListener('pointerdown', retryAudio);
        window.removeEventListener('keydown', retryAudio);
        document.removeEventListener('visibilitychange', hide);
        view.dispose();
        for (const { radio } of radios) radio.dispose();
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
      for (const { radio } of radios) radio.setSound(settings.sound);
      save();
    });
    startButton.addEventListener('click', () => {
      ambience.setEnabled(settings.sound);
      for (const { radio } of radios) radio.setSound(settings.sound);
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
