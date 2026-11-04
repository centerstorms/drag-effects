// Drag Effects - engine
//
// The engine knows nothing about individual effects. It only:
//   1. Listens to grab-op-begin / grab-op-end on Meta.Display.
//   2. Calls start()/update()/stop() on the enabled effects.
//   3. Aggregates a Frame and applies it to the MetaWindowActor.
//   4. Runs a settle animation when the pointer is released.
//
// To add an effect: see effects/_template.js and effects/index.js.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {EFFECTS} from './effects/index.js';
import {Frame} from './lib/frame.js';
import {debugLog} from './lib/debug.js';

const EASING = Clutter.AnimationMode;
const MIN_INTERVAL = 8;
const MAX_INTERVAL = 50;

// MetaGrabOp uses the high bits for flags (keyboard, unconstrained, drag
// direction). MOVING can arrive as MOVING (Wayland) or MOVING_UNCONSTRAINED
// (X11/XWayland), so compare after masking out the flag bits.
const GRAB_OP_FLAGS_MASK = 0x0f00;

const isMovingOp = op =>
    (op & ~GRAB_OP_FLAGS_MASK) === Meta.GrabOp.MOVING;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default class DragEffectsExtension extends Extension {
    enable() {
        debugLog('enable: extension enabled');

        this._settings = this.getSettings();
        this._frame = new Frame();

        this._effects = EFFECTS.map(EffectClass => new EffectClass(this._settings));
        for (const effect of this._effects) {
            try {
                effect.enable();
            } catch (e) {
                logError(e);
            }
        }

        this._actor = null;
        this._ctx = null;
        this._active = [];
        this._destroyId = 0;
        this._destroyed = false;
        this._resetId = 0;
        this._tickId = 0;
        this._startedAt = 0;
        this._lastTick = 0;

        this._beginId = global.display.connect('grab-op-begin',
            (_display, win, op) => this._onGrabBegin(win, op));
        this._endId = global.display.connect('grab-op-end',
            () => this._onGrabEnd());
    }

    disable() {
        if (this._beginId) {
            global.display.disconnect(this._beginId);
            this._beginId = 0;
        }

        if (this._endId) {
            global.display.disconnect(this._endId);
            this._endId = 0;
        }

        this._stop();

        for (const effect of this._effects) {
            try {
                effect.disable();
            } catch (e) {
                logError(e);
            }
        }

        this._effects = [];
        this._settings = null;
        this._frame = null;
    }

    // ------------------------------------------------------------ grab

    _onGrabBegin(win, op) {
        try {
            this._handleGrabBegin(win, op);
        } catch (e) {
            logError(e);
            debugLog(`  !! error in _onGrabBegin: ${e}`);
            debugLog(`  ${e.stack ?? ''}`);
        }
    }

    _handleGrabBegin(win, op) {
        debugLog(`grab-op-begin op=${op} (MOVING=${Meta.GrabOp.MOVING})`);
        debugLog(`  win=${win ? 'yes' : 'null'} settings=${this._settings ? 'yes' : 'NULL'} ` +
            `effects=${this._effects?.length ?? 'undefined'}`);

        if (!win) {
            debugLog('  -> skip: no window');
            return;
        }

        if (!isMovingOp(op)) {
            debugLog(`  -> skip: not a move grab (op=${op})`);
            return;
        }

        const settings = this._settings;
        if (!settings) {
            debugLog('  -> skip: _settings is null');
            return;
        }

        const active = this._effects.filter(effect => effect.enabled);
        debugLog(`  enabled=[${active.map(e => e.constructor.id).join(',')}]`);

        const windowType = win.get_window_type();
        debugLog(`  window type=${windowType}`);
        const maximized = win.is_maximized();
        debugLog(`  max=${maximized} fullscreen=${win.is_fullscreen()}`);

        if (active.length === 0) {
            debugLog('  -> skip: no effects enabled');
            return;
        }

        if (settings.get_boolean('only-normal-windows') &&
            win.get_window_type() !== Meta.WindowType.NORMAL) {
            debugLog('  -> skip: only-normal-windows');
            return;
        }

        // Maximized windows can still be dragged: Mutter "shakes them loose"
        // (unmaximizes) as soon as the pointer moves. Only fullscreen windows
        // really cannot be dragged, so only those are filtered out.
        if (settings.get_boolean('skip-maximized') && win.is_fullscreen()) {
            debugLog('  -> skip: fullscreen');
            return;
        }

        const actor = win.get_compositor_private();
        if (!actor || !actor.width || !actor.height) {
            debugLog(`  -> skip: actor=${actor} size=${actor?.width}x${actor?.height}`);
            return;
        }

        if (this._actor)
            this._stop();

        const [px, py] = global.get_pointer();

        const pivot = settings.get_string('pivot-mode') === 'cursor'
            ? {
                x: clamp((px - actor.x) / actor.width, 0, 1),
                y: clamp((py - actor.y) / actor.height, 0, 1),
            }
            : {x: 0.5, y: 0.5};

        // Cancel any pending settle timeout from the previous release so it
        // cannot fire in the middle of this drag.
        this._clearResetSource();

        this._actor = actor;
        this._destroyed = false;
        this._active = [];

        // Cancel leftover animations (including from the previous release) so
        // the engine tick has full control over the transform.
        this._clearTransitions(actor);
        actor.set_pivot_point(pivot.x, pivot.y);

        const now = GLib.get_monotonic_time() / 1000;

        this._ctx = {
            actor,
            win,
            settings,
            x: px,
            y: py,
            dx: 0,
            dy: 0,
            dt: 16,
            elapsed: 0,
            width: actor.width,
            height: actor.height,
            pivot,
        };

        for (const effect of active) {
            try {
                effect.start(this._ctx);
                this._active.push(effect);
            } catch (e) {
                logError(e);
                debugLog(`  -> start failed for ${effect.constructor.id}: ${e}`);
                // start() may have attached a half-ready effect or clone to
                // the actor: clean it up before continuing.
                try {
                    effect.stop(this._ctx);
                } catch (err) {
                    logError(err);
                }
            }
        }

        if (this._active.length === 0) {
            debugLog('  -> no effect started successfully');
            this._stop();
            return;
        }

        debugLog(`  -> running [${this._active.map(e => e.constructor.id).join(',')}] ` +
            `actor ${actor.width}x${actor.height} at ${actor.x},${actor.y} ` +
            `pivot ${pivot.x.toFixed(3)},${pivot.y.toFixed(3)}`);

        this._startedAt = now;
        this._lastTick = now;
        this._tickCount = 0;

        this._destroyId = actor.connect('destroy', () => {
            if (this._actor !== actor)
                return;
            this._destroyed = true;
            this._stop();
        });

        this._tickId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            clamp(settings.get_int('frame-interval'), MIN_INTERVAL, MAX_INTERVAL),
            () => this._tick());
    }

    _onGrabEnd() {
        if (this._actor)
            debugLog('grab-op-end');
        this._stop();
    }

    // ------------------------------------------------------------ tick

    _tick() {
        const actor = this._actor;
        const ctx = this._ctx;

        if (!actor || !ctx || this._active.length === 0) {
            this._tickId = 0;
            return GLib.SOURCE_REMOVE;
        }

        const now = GLib.get_monotonic_time() / 1000;
        const [px, py] = global.get_pointer();

        ctx.dx = px - ctx.x;
        ctx.dy = py - ctx.y;
        ctx.x = px;
        ctx.y = py;
        ctx.dt = Math.max(1, now - this._lastTick);
        ctx.elapsed = now - this._startedAt;
        ctx.width = actor.width;
        ctx.height = actor.height;
        this._lastTick = now;
        this._tickCount++;

        this._frame.reset();

        for (const effect of [...this._active]) {
            try {
                effect.update(ctx, this._frame);
            } catch (e) {
                logError(e);
                debugLog(`  -> update failed for ${effect.constructor.id}: ${e}`);
                // Drop the failing effect from the loop to avoid log spam on
                // every frame.
                this._active = this._active.filter(item => item !== effect);
                try {
                    effect.stop(ctx);
                } catch (err) {
                    logError(err);
                }
            }
        }

        try {
            this._applyFrame(actor);
        } catch (e) {
            logError(e);
            debugLog(`  -> _applyFrame failed: ${e}`);
            this._tickId = 0;
            return GLib.SOURCE_REMOVE;
        }

        if (this._tickCount === 1) {
            const f = this._frame;
            debugLog(`  tick #1 dx=${ctx.dx} dy=${ctx.dy} ` +
                `=> rotX=${f.rotationX.toFixed(2)} rotY=${f.rotationY.toFixed(2)} ` +
                `rotZ=${f.rotationZ.toFixed(2)} scale=${f.scaleX.toFixed(4)},${f.scaleY.toFixed(4)} ` +
                `opacity=${Math.round(f.opacity)}`);
        }

        return GLib.SOURCE_CONTINUE;
    }

    _applyFrame(actor) {
        const frame = this._frame;

        actor.rotation_angle_x = frame.rotationX;
        actor.rotation_angle_y = frame.rotationY;
        actor.rotation_angle_z = frame.rotationZ;
        actor.set_scale(frame.scaleX, frame.scaleY);

        const opacity = Math.round(clamp(frame.opacity, 0, 255));
        if (actor.opacity !== opacity)
            actor.opacity = opacity;
    }

    // ------------------------------------------------------------ stop

    _stop() {
        if (this._tickId) {
            GLib.source_remove(this._tickId);
            this._tickId = 0;
        }

        this._clearResetSource();

        const actor = this._actor;
        const ctx = this._ctx;
        const active = this._active;
        const destroyed = this._destroyed;

        this._actor = null;
        this._ctx = null;
        this._active = [];
        this._destroyed = false;

        if (!actor)
            return;

        if (this._destroyId) {
            try {
                actor.disconnect(this._destroyId);
            } catch (e) {
                // The actor was already destroyed.
            }
            this._destroyId = 0;
        }

        // Always call stop() even if the actor is destroyed: effects may hold
        // on to resources outside the actor (sub-effects, clones, timeouts...).
        for (const effect of active) {
            try {
                effect.stop(ctx);
            } catch (e) {
                logError(e);
            }
        }

        if (destroyed)
            return;

        const settings = this._settings;
        const duration = settings ? Math.max(0, settings.get_int('release-duration')) : 0;
        const wobble = settings ? settings.get_boolean('release-wobble') : false;

        if (duration === 0) {
            this._resetActor(actor);
            return;
        }

        try {
            actor.ease({
                rotation_angle_x: 0,
                rotation_angle_y: 0,
                rotation_angle_z: 0,
                scale_x: 1,
                scale_y: 1,
                opacity: 255,
                duration,
                mode: wobble ? EASING.EASE_OUT_BACK : EASING.EASE_OUT_QUAD,
            });
        } catch (e) {
            return;
        }

        // Restore the transform pivot to the center once the animation
        // finishes. The source handle is stored so that _stop() (including the
        // one invoked by disable()) can remove this source at any time.
        this._resetId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration + 60, () => {
            this._resetId = 0;

            try {
                actor.set_pivot_point(0.5, 0.5);
            } catch (e) {
                // The actor was already destroyed.
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    _clearResetSource() {
        if (this._resetId) {
            GLib.source_remove(this._resetId);
            this._resetId = 0;
        }
    }

    _resetActor(actor) {
        try {
            actor.rotation_angle_x = 0;
            actor.rotation_angle_y = 0;
            actor.rotation_angle_z = 0;
            actor.set_scale(1, 1);
            actor.opacity = 255;
            actor.set_pivot_point(0.5, 0.5);
        } catch (e) {
            // The actor was already destroyed.
        }
    }

    _clearTransitions(actor) {
        try {
            actor.remove_all_transitions();
        } catch (e) {
            // Older Clutter versions without this API: ignore.
        }
    }
}
