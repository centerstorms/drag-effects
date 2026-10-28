// Effect: tint.
// Attaches a Clutter.ShaderEffect directly to the window actor.
//
// A tiny GLSL shader mixes the window color toward a preset while dragging.
// Using a custom shader avoids the ClutterColor/CoglColor API change that
// affected Clutter.ColorizeEffect between GNOME versions.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readString} from '../lib/settings.js';
import {loadClutter, getClutter} from '../lib/clutter.js';
import {debugLog} from '../lib/debug.js';

const EFFECT_NAME = 'drag-effects-tint';

const COLORS = {
    amber: [1.0, 0.55, 0.15],
    blue: [0.20, 0.55, 1.0],
    magenta: [1.0, 0.20, 0.80],
    green: [0.20, 1.0, 0.50],
    red: [1.0, 0.20, 0.20],
    violet: [0.60, 0.30, 1.0],
};

const TINT_SHADER = `
uniform sampler2D tex;
uniform float red;
uniform float green;
uniform float blue;
uniform float blend;

void main() {
    vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
    cogl_color_out = vec4(mix(c.rgb, vec3(red, green, blue), blend), c.a);
}
`;

const uniformValue = value => parseFloat(value);

export class TintEffect extends DragEffect {
    static id = 'tint';
    static title = 'Tint';
    static description = 'Washes the window in a translucent color while it is being dragged.';

    static controls = [
        {
            key: 'tint-color',
            type: 'enum',
            title: 'Color',
            options: [
                {value: 'amber', label: 'Amber'},
                {value: 'blue', label: 'Blue'},
                {value: 'magenta', label: 'Magenta'},
                {value: 'green', label: 'Green'},
                {value: 'red', label: 'Red'},
                {value: 'violet', label: 'Violet'},
            ],
        },
        {
            key: 'tint-strength',
            type: 'double',
            title: 'Strength',
            subtitle: '0 = no tint, 0.8 = strong wash.',
            min: 0.0, max: 0.8, step: 0.05, digits: 2,
        },
        {
            key: 'tint-smoothing',
            type: 'double',
            title: 'Smoothing',
            subtitle: 'How quickly the tint fades in.',
            min: 0.05, max: 1.0, step: 0.05, digits: 2,
        },
    ];

    enable() {
        this._actor = null;
        this._effect = null;
        this._blend = 0;
        loadClutter();
    }

    start(ctx) {
        this._removeEffect();

        this._actor = ctx.actor;
        this._blend = 0;

        const Clutter = getClutter();
        if (!Clutter) {
            loadClutter();
            return;
        }

        const color = COLORS[readString(this.settings, 'tint-color', 'amber')] ??
            COLORS.amber;

        try {
            // The default shader type is FRAGMENT, so no constructor
            // argument is needed. This also works on GNOME 50, where
            // Clutter uses CoglShaderType instead of ClutterShaderType.
            const effect = new Clutter.ShaderEffect();
            if (effect.set_shader_source(TINT_SHADER) === false)
                throw new Error('tint shader failed to compile');
            effect.set_uniform_value('tex', 0);
            effect.set_uniform_value('red', uniformValue(color[0]));
            effect.set_uniform_value('green', uniformValue(color[1]));
            effect.set_uniform_value('blue', uniformValue(color[2]));
            effect.set_uniform_value('blend', 0.0);
            effect.set_enabled(true);

            this._actor.add_effect_with_name(EFFECT_NAME, effect);
            this._effect = effect;
            debugLog('  tint: shader attached');
        } catch (e) {
            logError(e);
            this._effect = null;
            debugLog(`  tint: failed to attach shader: ${e}`);
        }
    }

    update(ctx, _frame) {
        const effect = this._effect;
        if (!effect)
            return;

        const target = readDouble(this.settings, 'tint-strength', 0.35);
        const smoothing = readDouble(this.settings, 'tint-smoothing', 0.2);

        this._blend += (target - this._blend) *
            alphaFor(smoothing, timeScale(ctx.dt));

        try {
            effect.set_uniform_value('blend', uniformValue(this._blend));
        } catch (e) {
            // The actor or shader was destroyed or is invalid. Detach it so
            // the next drag can start cleanly.
            this._removeEffect();
        }
    }

    stop(_ctx) {
        this._removeEffect();
        this._actor = null;
        this._blend = 0;
    }

    disable() {
        this._removeEffect();
        this._actor = null;
        this._blend = 0;
    }

    _removeEffect() {
        const actor = this._actor;
        const effect = this._effect;

        this._effect = null;

        if (!effect)
            return;

        try {
            if (actor)
                actor.remove_effect(effect);
            else
                effect.actor?.remove_effect(effect);
        } catch (e) {
            // Actor/effect already destroyed.
        }
    }
}
