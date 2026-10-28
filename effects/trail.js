// Effect: trail.
// Adds several translucent Clutter.Clones of the dragged window, each with
// a larger lag and a lower opacity. The clones are inserted below the window
// actor so the original stays sharp.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';
import {loadClutter, getClutter} from '../lib/clutter.js';
import {debugLog} from '../lib/debug.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class TrailEffect extends DragEffect {
    static id = 'trail';
    static title = 'Trail';
    static description = 'Leaves a short trail of translucent afterimages behind the dragged window.';

    static controls = [
        {
            key: 'trail-count',
            type: 'int',
            title: 'Number of copies',
            subtitle: 'More copies create a longer trail but cost more to render.',
            min: 1, max: 5, step: 1,
        },
        {
            key: 'trail-opacity',
            type: 'int',
            title: 'Opacity',
            subtitle: 'Percent for the nearest copy; farther copies are fainter.',
            min: 5, max: 60, step: 5,
        },
        {
            key: 'trail-lag',
            type: 'int',
            title: 'Lag',
            subtitle: 'Distance between copies, in frames of pointer movement.',
            min: 1, max: 20, step: 1,
        },
        {
            key: 'trail-smoothing',
            type: 'double',
            title: 'Smoothing',
            subtitle: 'Lower values make the trail lag more smoothly.',
            min: 0.05, max: 1.0, step: 0.05, digits: 2,
        },
    ];

    enable() {
        this._actor = null;
        this._parent = null;
        this._clones = [];
        this._offsetX = 0;
        this._offsetY = 0;
        loadClutter();
    }

    start(ctx) {
        this._removeClones();

        this._actor = ctx.actor;
        this._parent = null;
        this._clones = [];
        this._offsetX = 0;
        this._offsetY = 0;

        const Clutter = getClutter();
        if (!Clutter) {
            loadClutter();
            return;
        }

        const parent = this._actor.get_parent();
        if (!parent) {
            debugLog('  trail: window actor has no parent');
            return;
        }

        const count = clamp(readInt(this.settings, 'trail-count', 3), 1, 5);
        const baseOpacity = clamp(readInt(this.settings, 'trail-opacity', 25), 5, 60) / 100;

        for (let i = 0; i < count; i++) {
            try {
                const clone = new Clutter.Clone({
                    source: this._actor,
                    reactive: false,
                });

                clone.set_size(this._actor.width, this._actor.height);
                clone.set_position(this._actor.x, this._actor.y);
                clone.opacity = 0;

                parent.add_child(clone);
                parent.set_child_below_sibling(clone, this._actor);
                this._clones.push(clone);
            } catch (e) {
                logError(e);
                debugLog(`  trail: failed to attach clone ${i + 1}: ${e}`);
            }
        }

        this._parent = parent;
        debugLog(`  trail: ${this._clones.length} clone(s) attached`);
    }

    update(ctx, frame) {
        const actor = this._actor;
        if (!actor || this._clones.length === 0)
            return;

        const lag = clamp(readInt(this.settings, 'trail-lag', 5), 1, 20);
        const smoothing = readDouble(this.settings, 'trail-smoothing', 0.25);
        const count = this._clones.length;
        const baseOpacity = clamp(readInt(this.settings, 'trail-opacity', 25), 5, 60) / 100;

        const targetX = clamp(ctx.dx * lag, -ctx.width, ctx.width);
        const targetY = clamp(ctx.dy * lag, -ctx.height, ctx.height);
        const k = alphaFor(smoothing, timeScale(ctx.dt));

        this._offsetX += (targetX - this._offsetX) * k;
        this._offsetY += (targetY - this._offsetY) * k;

        for (let i = 0; i < count; i++) {
            const clone = this._clones[i];
            const factor = i + 1;
            const opacity = baseOpacity * (1 - i / (count + 0.5));

            try {
                if (clone.width !== actor.width || clone.height !== actor.height)
                    clone.set_size(actor.width, actor.height);
                clone.set_position(
                    actor.x - clamp(this._offsetX * factor, -ctx.width, ctx.width),
                    actor.y - clamp(this._offsetY * factor, -ctx.height, ctx.height));
                clone.opacity = Math.round(255 * opacity);

                // Clutter.Clone paints the source content without the source
                // model-view transform, so copy the current frame transform.
                clone.set_pivot_point(ctx.pivot.x, ctx.pivot.y);
                clone.set_scale(frame.scaleX, frame.scaleY);
                clone.rotation_angle_x = frame.rotationX;
                clone.rotation_angle_y = frame.rotationY;
                clone.rotation_angle_z = frame.rotationZ;
            } catch (e) {
                // Actor/clone destroyed mid-drag.
                this._removeClones();
                return;
            }
        }
    }

    stop(_ctx) {
        this._removeClones();
        this._actor = null;
        this._parent = null;
    }

    disable() {
        this._removeClones();
        this._actor = null;
        this._parent = null;
    }

    _removeClones() {
        const clones = this._clones;
        this._clones = [];

        for (const clone of clones) {
            try {
                clone.destroy();
            } catch (e) {
                // Already destroyed.
            }
        }
    }
}
