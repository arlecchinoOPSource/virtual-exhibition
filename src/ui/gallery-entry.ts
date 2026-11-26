// The public 3D scene uses a local admission prompt. The digest keeps the
// plaintext out of the bundle; this is not server-side access control.
const passwordDigest: string =
  import.meta.env.VITE_GALLERY_PASSWORD_DIGEST ??
  'dcb44b963a350b9ab70210a048d7a723267370779bc4d584944f9ddba76767c7';

export function requireGalleryPassword(
  dialog: HTMLDialogElement,
  startWalk: HTMLButtonElement,
) {
  const form = dialog.querySelector('form')!;
  const password = dialog.querySelector<HTMLInputElement>('input')!;
  const submit = form.querySelector('button')!;
  const status = dialog.querySelector<HTMLElement>('[role="alert"]')!;

  startWalk.disabled = true;
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  password.addEventListener('input', () => {
    password.removeAttribute('aria-invalid');
    status.textContent = '';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    const entry = new TextEncoder().encode(password.value);
    password.value = '';
    try {
      const bytes = new Uint8Array(
        await crypto.subtle.digest('SHA-256', entry),
      );
      const digest = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      if (digest === passwordDigest) {
        startWalk.disabled = false;
        dialog.close();
        startWalk.focus({ preventScroll: true });
        return;
      }
      password.setAttribute('aria-invalid', 'true');
      status.textContent = 'Incorrect password. Try again.';
    } catch {
      status.textContent =
        'The password could not be checked. Open the gallery over HTTPS or on localhost.';
    } finally {
      submit.disabled = false;
    }
    password.focus();
  });
  dialog.showModal();
  password.focus();
}
