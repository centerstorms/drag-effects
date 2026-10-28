// Effect: ghost.
// Adds one translucent Clutter.Clone of the dragged window that lags behind
// the pointer. The clone is inserted below the window actor, so the main
// window stays sharp and the ghost trails behind it.

import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble, readInt} from '../lib/settings.js';
import {loadClutter, getClutter} from '../lib/clutter.js';
import {debugLog} from '../lib/debug.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class GhostEffect extends DragEffect {
    static id = 'ghost';
    static title = 'Ghost';
    static description = 'Leaves a single translucent afterimage trailing behind the dragged window.';

    static controls = [
        {
            key: 'ghost-opacity',
            type: 'int',
            title: 'Opacity',
            subtitle: 'Percent. Lower values make the ghost more subtle.',
            min: 5, max: 80, step: 5,
        },
        {
            key: 'ghost-lag',
            type: 'int',
            title: 'Lag',
            subtitle: 'How many frames the ghost stays behind the window.',
            min: 1, max: 20, step: 1,
        },
        {
            key: 'ghost-smoothing',
            type: 'double',
            title: 'Smoothing',
            subtitle: 'Lower values make the ghost lag more smoothly.',
            min: 0.05, max: 1.0, step: 0.05, digits: 2,
        },
    ];

    enable() {
        this._actor = null;
        this._parent = null;
        this._clone = null;
        this._offsetX = 0;
        this._offsetY = 0;
        loadClutter();
    }

    start(ctx) {
        this._removeClone();

        this._actor = ctx.actor;
        this._parent = null;
        this._offsetX = 0;
        this._offsetY = 0;

        const Clutter = getClutter();
        if (!Clutter) {
            loadClutter();
            return;
        }

        const parent = this._actor.get_parent();
        if (!parent) {
            debugLog('  ghost: window actor has no parent');
            return;
        }

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

            this._parent = parent;
            this._clone = clone;
            debugLog('  ghost: clone attached');
        } catch (e) {
            logError(e);
            debugLog(`  ghost: failed to attach clone: ${e}`);
        }
    }

    update(ctx, frame) {
        const clone = this._clone;
        const actor = this._actor;
        if (!clone || !actor)
            return;

        const lag = clamp(readInt(this.settings, 'ghost-lag', 6), 1, 20);
        const smoothing = readDouble(this.settings, 'ghost-smoothing', 0.25);
        const opacity = clamp(readInt(this.settings, 'ghost-opacity', 35), 5, 80) / 100;

        const targetX = clamp(ctx.dx * lag, -ctx.width, ctx.width);
        const targetY = clamp(ctx.dy * lag, -ctx.height, ctx.height);
        const k = alphaFor(smoothing, timeScale(ctx.dt));

        this._offsetX += (targetX - this._offsetX) * k;
        this._offsetY += (targetY - this._offsetY) * k;

        try {
            if (clone.width !== actor.width || clone.height !== actor.height)
                clone.set_size(actor.width, actor.height);
            clone.set_position(actor.x - this._offsetX, actor.y - this._offsetY);
            clone.opacity = Math.round(255 * opacity);

            // The clone paints the source without its model-view transform,
            // so copy the frame transform explicitly to keep the ghost
            // aligned with the real window.
            clone.set_pivot_point(ctx.pivot.x, ctx.pivot.y);
            clone.set_scale(frame.scaleX, frame.scaleY);
            clone.rotation_angle_x = frame.rotationX;
            clone.rotation_angle_y = frame.rotationY;
            clone.rotation_angle_z = frame.rotationZ;
        } catch (e) {
            // Actor/clone destroyed mid-drag.
            this._removeClone();
        }
    }

    stop(_ctx) {
        this._removeClone();
        this._actor = null;
        this._parent = null;
    }

    disable() {
        this._removeClone();
        this._actor = null;
        this._parent = null;
    }

    _removeClone() {
        const clone = this._clone;
        this._clone = null;

        if (!clone)
            return;

        try {
            clone.destroy();
        } catch (e) {
            // Already destroyed.
        }
    }
}
