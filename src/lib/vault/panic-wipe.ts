/**
 * Runs the destructive-side of a panic wipe in the browser. The vault-key
 * context still needs to call `lock()` from React; this helper handles
 * everything outside of that: clipboard clear, server-side logout, and any
 * per-device preference we shouldn't leave behind on a compromised device.
 */
export async function panicWipeLocal(): Promise<void> {
  // Clear the clipboard so anything the user copied earlier is gone.
  try {
    await navigator.clipboard.writeText('');
  } catch {
    // Some browsers refuse without focus; nothing else to try.
  }

  // Invalidate the session cookie server-side. Fire-and-forget so a slow or
  // offline server never prevents the local wipe.
  fetch('/api/auth/logout', { method: 'POST', keepalive: true }).catch(() => {});

  // Drop every Vaulty preference key we own so a shared device doesn't
  // remember tour progress, theme, changelog seen-state, etc.
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('vaulty.')) toRemove.push(key);
    }
    for (const key of toRemove) window.localStorage.removeItem(key);
  } catch {
    // localStorage may be unavailable (private mode); safe to ignore.
  }
}
