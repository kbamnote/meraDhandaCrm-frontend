// Simple toast helper that replicates the legacy `showToast(msg, type)` API.
// Renders into #toast-container which is included in AppLayout.

export function showToast(msg, type = 'info') {
  const root = document.getElementById('toast-container');
  if (!root) { console.log('[toast]', msg); return; }
  const el = document.createElement('div');
  el.className = 'toast';
  const color = ({
    success: 'var(--green)',
    error: 'var(--red)',
    warning: 'var(--amber)',
    info: 'var(--blue)',
  })[type] || 'var(--blue)';
  el.style.borderLeft = `3px solid ${color}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'all .2s';
    setTimeout(() => el.remove(), 220);
  }, 3000);
}

// Make available globally so ported legacy code that calls window.showToast() works.
if (typeof window !== 'undefined') window.showToast = showToast;
