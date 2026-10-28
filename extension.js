// Drag Effects - engine
//
// Engine không biết gì về từng hiệu ứng cụ thể. Nó chỉ:
//   1. Bắt grab-op-begin / grab-op-end của Meta.Display.
//   2. Gọi start()/update()/stop() trên các hiệu ứng đang bật.
//   3. Tổng hợp Frame rồi áp lên MetaWindowActor.
//   4. Chạy animation trả về khi thả chuột.
//
// Muốn thêm hiệu ứng: xem effects/_template.js và effects/index.js.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {EFFECTS} from './effects/index.js';
import {Frame} from './lib/frame.js';
import {debugLog, resetDebugLog} from './lib/debug.js';

const EASING = Clutter.AnimationMode;
const MIN_INTERVAL = 8;
const MAX_INTERVAL = 50;

// MetaGrabOp dùng các bit cao cho cờ (keyboard, unconstrained, hướng kéo).
// MOVING có thể đến dưới dạng MOVING (Wayland) hoặc MOVING_UNCONSTRAINED
// (X11/XWayland), nên so sánh sau khi bỏ các bit cờ.
const GRAB_OP_FLAGS_MASK = 0x0f00;

const isMovingOp = op =>
    (op & ~GRAB_OP_FLAGS_MASK) === Meta.GrabOp.MOVING;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default class DragEffectsExtension extends Extension {
    enable() {
        resetDebugLog();
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
        this._tickId = 0;
        this._startedAt = 0;
        this._lastTick = 0;

        // Giữ bộ đếm qua các lần disable/enable để timeout cũ tự huỷ.
        if (this._epoch === undefined)
            this._epoch = 0;

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

        // Cửa sổ maximized vẫn kéo được: Mutter sẽ "shake loose" (bỏ
        // maximized) ngay khi chuột di chuyển. Chỉ fullscreen mới thực sự
        // không kéo được, nên chỉ lọc fullscreen.
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

        this._epoch++;
        this._actor = actor;
        this._destroyed = false;
        this._active = [];

        // Huỷ animation còn dang dở (kể cả của lần thả trước) để tick của
        // engine toàn quyền điều khiển transform.
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
                // start() có thể đã gắn effect/clone dở dang: dọn lại.
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

        if (!actor || !ctx || this._active.length === 0)
            return GLib.SOURCE_REMOVE;

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
                // Hiệu ứng lỗi thì bỏ ra khỏi vòng lặp, tránh spam log mỗi khung.
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
                // actor đã bị huỷ
            }
            this._destroyId = 0;
        }

        // Luôn gọi stop() kể cả khi actor đã bị huỷ: hiệu ứng có thể đang giữ
        // tài nguyên bên ngoài actor (effect phụ, clone, timeout...).
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

        const epoch = ++this._epoch;

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

        // Trả tâm biến đổi về giữa sau khi animation kết thúc. Nếu người dùng
        // đã bắt đầu kéo cửa sổ khác thì bỏ qua (epoch đã đổi).
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration + 60, () => {
            if (this._epoch !== epoch)
                return GLib.SOURCE_REMOVE;

            try {
                actor.set_pivot_point(0.5, 0.5);
            } catch (e) {
                // actor đã bị huỷ
            }

            return GLib.SOURCE_REMOVE;
        });
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
            // actor đã bị huỷ
        }
    }

    _clearTransitions(actor) {
        try {
            actor.remove_all_transitions();
        } catch (e) {
            // phiên bản Clutter cũ: bỏ qua
        }
    }
}
