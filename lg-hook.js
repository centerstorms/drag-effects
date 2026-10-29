// Diagnostic hook for GNOME Shell Looking Glass (Alt+F2 -> lg).
//
// Usage (paste one line into the Looking Glass evaluator, replacing the
// extension directory if yours is installed somewhere else):
//
//   import('file:///home/<user>/.local/share/gnome-shell/extensions/drag-effects@centerstorms.github.io/lg-hook.js?v=' + Date.now()).then(m => m.installHook())
//
// The hook adds a grab-op-begin handler that runs the same steps as the
// engine, writes results and exceptions to ~/.cache/drag-effects-hook.log,
// and then calls the extension's original handler. This makes it possible to
// see which step fails without logging out. Remove it with removeHook().

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const UUID = 'drag-effects@centerstorms.github.io';

const LOG = Gio.File.new_for_path(GLib.build_filenamev([
    GLib.get_user_cache_dir(),
    'drag-effects-hook.log',
]));

function log(message) {
    try {
        const line = `[${new Date().toISOString()}] ${message}\n`;
        const stream = LOG.append_to(Gio.FileCreateFlags.NONE, null);
        stream.write_all(new TextEncoder().encode(line), null);
        stream.close(null);
    } catch (e) {
        // Ignore logging failures.
    }
}

function step(label, fn) {
    try {
        const value = fn();
        log(`${label}: ${value}`);
        return value;
    } catch (e) {
        log(`${label} ERROR: ${e}\n${e.stack ?? ''}`);
        throw e;
    }
}

export function installHook() {
    try {
        LOG.delete(null);
    } catch (e) {
        // No log file yet.
    }

    const entry = Main.extensionManager.lookup(UUID);
    const ext = entry?.stateObj;
    if (!ext)
        return 'Extension instance not found. Is it enabled?';

    log(`hook installed: state=${entry.state} settings=${ext._settings ? 'ok' : 'NULL'} ` +
        `effects=${ext._effects?.length ?? 'undefined'}`);

    if (globalThis._dragEffectsHookId) {
        try {
            global.display.disconnect(globalThis._dragEffectsHookId);
        } catch (e) {
            // Already disconnected.
        }
        log('removed old hook');
    }

    const handlerId = global.display.connect('grab-op-begin', (_display, win, op) => {
        log(`grab: op=${op} win=${win ? 'present' : 'null'} ` +
            `settings=${ext._settings ? 'ok' : 'NULL'} effects=${ext._effects?.length ?? 'undefined'}`);

        try {
            if (!win) {
                log('stop: no window');
                return;
            }

            const settings = step('settings', () => ext._settings ? 'ok' : 'NULL');
            if (!settings || settings === 'NULL')
                return;

            const active = step('effects.filter(enabled)',
                () => ext._effects.filter(effect => effect.enabled));
            log(`enabled=[${active.map(e => e.constructor.id).join(',')}]`);

            step('win.get_id()', () => win.get_id());
            step('win.get_window_type()', () => win.get_window_type());
            step('win.is_maximized()', () => win.is_maximized());
            step('win.is_fullscreen()', () => win.is_fullscreen());
            step('win.get_compositor_private()', () => {
                const actor = win.get_compositor_private();
                return actor ? `${actor.width}x${actor.height}` : 'null';
            });

            // Run the real handler loaded in the shell to see whether it
            // starts an effect or exits early.
            log('calling ext._onGrabBegin() ...');
            ext._onGrabBegin(win, op);
            log(`ext._onGrabBegin() finished: actor=${ext._actor ? 'present' : 'null'} ` +
                `active=${ext._active?.length ?? 'undefined'}`);
        } catch (e) {
            log(`ERROR in hook: ${e}\n${e.stack ?? ''}`);
            logError(e);
        }
    });

    globalThis._dragEffectsHookId = handlerId;
    log(`hook installed id=${handlerId}; drag a normal window`);

    return 'Hook installed. Drag a normal (non-fullscreen) window.';
}

export function removeHook() {
    if (globalThis._dragEffectsHookId) {
        try {
            global.display.disconnect(globalThis._dragEffectsHookId);
        } catch (e) {
            // Already disconnected.
        }
        globalThis._dragEffectsHookId = 0;
        log('hook removed');
        return 'Hook removed.';
    }
    return 'No hook installed.';
}
