// Copies text, falling back to execCommand where the async Clipboard API is missing or blocked.
function legacyCopy(text) {
  const textarea = document.createElement('textarea');
  Object.assign(textarea.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try { document.execCommand('copy'); } catch { /* nothing else to try */ }
  document.body.removeChild(textarea);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    legacyCopy(text);
  }
}
