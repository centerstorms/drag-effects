// Base class for all effects.
//
// Lifecycle:
//   enable()        - the extension is enabled
//   start(ctx)      - a drag begins
//   update(ctx, f)  - each frame while dragging
//   stop(ctx)       - the pointer is released
//   disable()       - the extension is disabled
//
// ctx (DragContext) contains:
//   actor, win          - the Meta.WindowActor and Meta.Window
//   x, y                - current pointer position (stage coordinates)
//   dx, dy              - how much the pointer moved since the last frame
//   dt                  - milliseconds since the last frame
//   elapsed             - milliseconds since the drag started
//   width, height       - the actor size
//   pivot               - normalized transform center {x, y}
//   settings            - the Gio.Settings object
//
// To add an effect: see effects/_template.js

import {readBoolean} from './settings.js';

export class DragEffect {
    // --- metadata used by the registry + Preferences ---
    static id = 'effect';
    static title = 'Effect';
    static description = '';
    static controls = [];

    constructor(settings) {
        this.settings = settings;
    }

    get enabledKey() {
        return `effect-${this.constructor.id}-enabled`;
    }

    get enabled() {
        return readBoolean(this.settings, this.enabledKey, true);
    }

    // --- hooks ---
    enable() {}
    disable() {}
    start(_ctx) {}
    update(_ctx, _frame) {}
    stop(_ctx) {}
}

// Scale a coefficient by dt so effects do not depend on the frame rate.
export function timeScale(dt) {
    return Math.min(4, Math.max(0.25, dt / 16.67));
}

// Convert a per-frame "smoothness" into an alpha matching the actual dt.
export function alphaFor(smoothing, factor) {
    return 1 - Math.pow(1 - smoothing, factor);
}
