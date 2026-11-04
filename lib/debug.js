// Optional diagnostic logging for Drag Effects.
//
// Logging is disabled by default so the GNOME journal stays clean. To
// enable it, set DRAG_EFFECTS_DEBUG=1 in the environment before GNOME
// Shell starts (for example via ~/.config/environment.d/100-drag-effects.conf)
// and then inspect the journal with:
//   journalctl --user -f | grep drag-effects
//
// Only GLib is imported, so this module is also safe to import from the
// preferences process if it is ever needed there.

import GLib from 'gi://GLib';

const ENABLED = GLib.getenv('DRAG_EFFECTS_DEBUG') === '1';

export function debugLog(message) {
    if (ENABLED)
        console.debug(`drag-effects: ${message}`);
}
