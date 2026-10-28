// ============================================================================
// EFFECT TEMPLATE
// ============================================================================
// This file is NOT imported and therefore never runs. Copy it to a new file,
// rename the class/id, and follow these four steps:
//
// 1. Create effects/my-effect.js (rename the file, class, and static id).
// 2. Add keys to schemas/*.gschema.xml, including:
//        <key name="effect-my-effect-enabled" type="b">
//          <default>false</default>
//        </key>
//    (without this key the effect has no switch in the UI and is always on)
// 3. Add the class to EFFECTS in effects/index.js.
// 4. Run ./install.sh, then log out/in (Wayland) or press Alt+F2 -> r (X11).
//
// extension.js and prefs.js do not need changes.
//
// NOTE: effect files are also imported by prefs.js to read metadata, and the
// Preferences process does not have Clutter or Meta. Never import
// gi://Clutter, gi://Meta, or gi://Shell at top level. If you need them, load
// them lazily from enable() with lib/clutter.js, as tint/ghost/trail do.
// ============================================================================

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble} from '../lib/settings.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class ExampleEffect extends DragEffect {
    // The id determines the switch key: effect-example-enabled.
    static id = 'example';
    static title = 'Example effect';
    static description = 'Short description shown in Preferences.';

    // The UI is generated from this array.
    // Supported types: 'int', 'double', 'enum', 'switch'.
    //   int/double: {key, type, title, subtitle?, min, max, step, digits?}
    //   enum:       {key, type, title, options: [{value, label}]}
    //   switch:     {key, type, title, subtitle?}
    static controls = [
        {
            key: 'example-strength',
            type: 'double',
            title: 'Strength',
            subtitle: 'Declare this key in the schema.',
            min: 0, max: 20, step: 0.5,
        },
        {
            key: 'example-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    // Called when the extension is enabled (not on every drag).
    enable() {
        this._angle = 0;
    }

    // Called when a drag begins.
    start(ctx) {
        this._angle = 0;
    }

    // Called every frame. Write the result into the frame:
    //   frame.rotationX += angle   (tilt around X)
    //   frame.rotationY += angle   (tilt around Y)
    //   frame.rotationZ += angle
    //   frame.scaleX *= factor
    //   frame.scaleY *= factor
    //   frame.opacity  = 0..255
    update(ctx, frame) {
        const strength = readDouble(this.settings, 'example-strength', 2);
        const smoothing = readDouble(this.settings, 'example-smoothing', 0.2);

        // Example: rotate against motion with a small amplitude.
        const target = clamp(-ctx.dx * strength * 0.1, -5, 5);
        this._angle += (target - this._angle) * alphaFor(smoothing, timeScale(ctx.dt));

        frame.rotationZ += this._angle;
    }

    // Called when the mouse is released, before the release animation.
    stop(_ctx) {
        this._angle = 0;
    }

    // Called when the extension is disabled.
    disable() {}
}
