// Lazy Clutter loader shared by effects that need Clutter APIs.
//
// Effect modules are also imported by prefs.js, and the Preferences process
// does not have the Clutter typelib. For that reason, never import
// `gi://Clutter` at module top level. Call loadClutter() from enable() and
// use getClutter() from start()/update()/stop().

import {debugLog} from './debug.js';

let Clutter = null;
let loading = null;

export function loadClutter() {
    if (Clutter)
        return Promise.resolve(Clutter);

    if (!loading) {
        loading = import('gi://Clutter')
            .then(module => {
                Clutter = module.default;
                debugLog('clutter: loaded');
                return Clutter;
            })
            .catch(e => {
                debugLog(`clutter: load failed: ${e}`);
                logError(e, 'Drag Effects: failed to load Clutter');
                return null;
            })
            .then(result => {
                loading = null;
                return result;
            });
    }

    return loading;
}

export function getClutter() {
    return Clutter;
}
