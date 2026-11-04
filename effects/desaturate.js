// Effect: desaturate.
// Does not write to Frame: attaches a Clutter.DesaturateEffect directly to
// the actor.
//
// The Clutter.DesaturateEffect API is stable from GNOME 45 through 51 (only
// the double-typed factor property is used), unlike ColorizeEffect which
// changed its color type from ClutterColor to CoglColor and is therefore
// not used for now.
//
// NOTE: prefs.js also imports this file to read the metadata, and the
// Preferences process has no Clutter typelib. For that reason Clutter MUST
// NOT be imported at the top level; load it dynamically only when the
// extension is actually enabled.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';

const EFFECT_NAME = 'drag-effects-desaturate';

let Clutter = null;
let clutterLoading = false;

function loadClutter() {
    if (Clutter || clutterLoading)
        return;

    clutterLoading = true;
    import('gi://Clutter')
        .then(module => {
            Clutter = module.default;
        })
        .catch(e => {
            logError(e, 'Drag Effects: failed to load Clutter');
        })
        .then(() => {
            clutterLoading = false;
        });
}

export class DesaturateEffect extends DragEffect {
    static id = 'desaturate';
    static title = 'Desaturate';
    static description = 'The window loses saturation while dragging and returns to full color on release.';

    static controls = [
        {
            key: 'desaturate-factor',
            type: 'int',
            title: 'Desaturation amount',
            subtitle: 'Percent. 100% = fully grayscale.',
            min: 0, max: 100, step: 5,
        },
        {
            key: 'desaturate-smoothing',
            type: 'double',
            title: 'Smoothing',
            min: 0.05, max: 1.0, step: 0.05,
        },
    ];

    enable() {
        this._actor = null;
        this._effect = null;
        this._factor = 0;
        loadClutter();
    }

    start(ctx) {
        // Clean up any effect left over from the previous drag (if any)
        // before switching to a new actor.
        this._removeEffect();

        this._actor = ctx.actor;
        this._factor = 0;

        if (!Clutter) {
            // The first drag may happen before the Clutter module finishes
            // loading: skip; the next drag will have the effect.
            loadClutter();
            return;
        }

        let effect;
        try {
            effect = new Clutter.DesaturateEffect({factor: 0});
        } catch (e) {
            // This Clutter build does not support the effect: skip it
            // without crashing the engine.
            logError(e);
            return;
        }

        effect.factor = 0;

        try {
            // Avoid duplicate names if a stale effect was not removed for
            // some reason.
            this._actor.remove_effect_by_name(EFFECT_NAME);
        } catch (e) {
            // The actor/effect was already destroyed.
        }

        try {
            this._actor.add_effect_with_name(EFFECT_NAME, effect);
            this._effect = effect;
        } catch (e) {
            logError(e);
        }
    }

    update(ctx, _frame) {
        const effect = this._effect;
        if (!effect)
            return;

        const target = readInt(this.settings, 'desaturate-factor', 60) / 100;
        const smoothing = readDouble(this.settings, 'desaturate-smoothing', 0.2);

        this._factor += (target - this._factor) *
            alphaFor(smoothing, timeScale(ctx.dt));

        try {
            effect.factor = this._factor;
        } catch (e) {
            // The effect was destroyed along with the actor.
            this._effect = null;
        }
    }

    stop(_ctx) {
        this._removeEffect();
        this._actor = null;
        this._factor = 0;
    }

    disable() {
        this._removeEffect();
        this._actor = null;
        this._factor = 0;
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
            // The actor/effect was destroyed (e.g. the window closed
            // mid-drag).
        }
    }
}
