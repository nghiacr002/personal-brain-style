// Loaded only by npm start's development server.
let version,
  dirty = false;
document.addEventListener('input', () => {
  dirty = true;
});
document.addEventListener('change', () => {
  dirty = true;
});
async function checkForChanges() {
  try {
    const response = await fetch('/api/dev-version', {cache: 'no-store'});
    if (!response.ok) {
      throw new Error('Server is restarting');
    }
    const next = (await response.json()).version;
    if (version && next !== version) {
      if (!dirty) {
        location.reload();
        return;
      }
      if (!document.getElementById('codeReloadNotice')) {
        const button = document.createElement('button');
        button.id = 'codeReloadNotice';
        button.className = 'button primary code-reload-notice';
        button.textContent = 'Code updated — reload page (discards unsaved edits)';
        button.addEventListener('click', () => location.reload());
        document.body.appendChild(button);
      }
    }
    version = next;
  } catch {
    /* Keep polling while the server restarts. */
  }
  setTimeout(checkForChanges, 1000);
}
void checkForChanges();
