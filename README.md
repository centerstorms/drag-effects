# Drag Effects

[![CI](https://github.com/your-username/drag-effects/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/drag-effects/actions/workflows/ci.yml)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%E2%80%9351-4a86cf.svg)](#compatibility)

Drag Effects is a **pluggable effect framework** for dragging windows in GNOME
Shell. Every effect is an independent module with its own switch and settings in
Preferences.

- **19 effects** in three groups: core, motion, and material.
- **Pluggable by design:** adding an effect means adding one module and schema
  keys. `extension.js` and `prefs.js` do not need to change.
- **Safe defaults:** new effects are disabled until you enable them.
- **GNOME Shell 45–51**, Wayland and X11.
- English UI, effect metadata, and documentation.

> The UUID in the repository is a development placeholder. Run
> `./tools/configure.sh <github-user>` before publishing; see
> [Publishing](docs/PUBLISHING.md).

## Installation

### From extensions.gnome.org

Once the extension is published, install it from its page on
[extensions.gnome.org](https://extensions.gnome.org/) or with the install
button on the site. The website also handles updates.

### From a GitHub release

Download the latest `.shell-extension.zip` from the
[releases page](https://github.com/your-username/drag-effects/releases), then:

```bash
gnome-extensions install --force drag-effects@example.com.shell-extension.zip

# Wayland: log out and back in
# X11:     Alt+F2 -> type "r" -> Enter

gnome-extensions enable drag-effects@example.com
gnome-extensions prefs drag-effects@example.com
```

### From source

Requirements: GNOME Shell 45+, `glib-compile-schemas`, and `zip` for packaging.

```bash
git clone https://github.com/your-username/drag-effects.git
cd drag-effects
make check
./install.sh

# Wayland: log out and back in
# X11:     Alt+F2 -> type "r" -> Enter

gnome-extensions enable drag-effects@example.com
gnome-extensions prefs drag-effects@example.com
```

Or use `make install && make enable`. Uninstall with
`./install.sh uninstall` or `make uninstall`.

> **Important:** GNOME Shell scans extension directories **once at startup**.
> If you copy files while logged in, the shell will not see the new code until
> you log out and back in (Wayland) or run a nested shell. Disabling and
> re-enabling the extension in the Extensions app does **not** reload ESM
> modules.

## Effects

Every effect has its own switch: `effect-<id>-enabled`. Set 2 and Set 3 effects
default to **off**. Enable the ones you want in Preferences; only enabled
effects take part in a drag.

### Set 1 — Core

| id | Name | Output | Keys |
| --- | --- | --- | --- |
| `tilt` | Inertial tilt | `rotationZ` | `tilt-max-angle`, `tilt-sensitivity`, `tilt-smoothing` |
| `stretch` | Vertical stretch | `scaleY` | `stretch-max`, `stretch-strength`, `stretch-smoothing` |
| `lift` | Lift | `scaleX`, `scaleY` | `lift-scale`, `lift-smoothing` |
| `opacity` | Fade | `opacity` | `drag-opacity`, `opacity-smoothing` |

### Set 2 — Motion

| id | Name | Output | Keys |
| --- | --- | --- | --- |
| `tilt3d` | 3D tilt | `rotationX`, `rotationY` | `tilt3d-max-angle`, `tilt3d-sensitivity`, `tilt3d-smoothing` |
| `speed-zoom` | Speed zoom | `scaleX`, `scaleY` | `speed-zoom-max`, `speed-zoom-strength`, `speed-zoom-smoothing` |
| `squash` | Squash | `scaleX`, `scaleY` | `squash-max`, `squash-strength`, `squash-smoothing` |
| `shake` | Shake | `rotationZ` | `shake-max-angle`, `shake-frequency`, `shake-sensitivity`, `shake-smoothing` |
| `spring` | Spring | `rotationZ` | `spring-max-angle`, `spring-sensitivity`, `spring-stiffness`, `spring-damping` |
| `pulse` | Pulse | `scaleX`, `scaleY` | `pulse-amplitude`, `pulse-frequency` |
| `accel-tilt` | Acceleration tilt | `rotationZ` | `accel-tilt-max-angle`, `accel-tilt-sensitivity`, `accel-tilt-smoothing` |
| `wobble` | Wobble | `rotationY` | `wobble-max-angle`, `wobble-frequency`, `wobble-sensitivity`, `wobble-smoothing` |
| `swing` | Swing | `rotationZ` | `swing-max-angle`, `swing-sensitivity`, `swing-smoothing` |
| `jelly` | Jelly | `scaleX`, `scaleY` | `jelly-max`, `jelly-sensitivity`, `jelly-stiffness`, `jelly-damping` |
| `fade-speed` | Speed fade | `opacity` | `fade-speed-min`, `fade-speed-strength`, `fade-speed-smoothing` |

### Set 3 — Material

| id | Name | Output | Keys |
| --- | --- | --- | --- |
| `desaturate` | Desaturate | `Clutter.DesaturateEffect` | `desaturate-factor`, `desaturate-smoothing` |
| `tint` | Tint | custom `Clutter.ShaderEffect` | `tint-color`, `tint-strength`, `tint-smoothing` |
| `ghost` | Ghost | one `Clutter.Clone` | `ghost-opacity`, `ghost-lag`, `ghost-smoothing` |
| `trail` | Trail | multiple `Clutter.Clone` actors | `trail-count`, `trail-opacity`, `trail-lag`, `trail-smoothing` |

`tint` uses a small custom GLSL shader instead of `Clutter.ColorizeEffect`,
whose color type changed between GNOME releases. `ghost` and `trail` insert
translucent clones below the dragged window actor, so the original window stays
sharp.

Common settings apply to every effect:

- `pivot-mode` — transform origin: pointer or window center.
- `release-wobble` — overshoot easing when the window settles.
- `release-duration` — release animation in milliseconds.
- `frame-interval` — update interval in milliseconds.
- `only-normal-windows` — skip dialogs, popups, docks, and utilities.
- `skip-maximized` — skip fullscreen windows only. Maximized windows are still
  draggable; dragging one out unmaximizes it.

## Architecture

```
                 grab-op-begin / grab-op-end
                              │
                     ┌────────▼────────┐
                     │  extension.js   │  engine
                     │  (does not know │
                     │   any effect)   │
                     └────────┬────────┘
                              │ start / update / stop
        ┌───────────┬─────────┼─────────┬───────────┐
        ▼           ▼         ▼         ▼           ▼
     tilt.js   stretch.js  lift.js  opacity.js  (new effect)
        └───────────┴─────────┼─────────┴───────────┘
                              ▼
                        Frame {rotationX, rotationY, rotationZ,
                               scaleX, scaleY, opacity}
                              │
                              ▼
                  Meta.WindowActor (transform + opacity)
```

- `lib/effect.js` — `DragEffect` base class plus `timeScale`/`alphaFor`
  helpers.
- `lib/frame.js` — per-frame accumulator. Effects write into the same frame
  instead of racing to set actor properties.
- `lib/settings.js` — safe GSettings reads with fallbacks when a key is not
  present yet.
- `lib/clutter.js` — lazy Clutter loader for shader/clone effects.
- `effects/index.js` — the `EFFECTS` registry, which is also the order shown
  in Preferences.
- `prefs.js` — builds the UI from each effect's `static controls`.

Effects may also attach a `Clutter.Effect` directly to the actor in `start()`
and remove it in `stop()` (see `desaturate`, `tint`, `ghost`, and `trail`).
The engine always calls `stop()`, even when the window is closed or the actor
is destroyed mid-drag, so external resources are cleaned up.

## Compatibility

| GNOME Shell | Status |
| --- | --- |
| 45, 46, 47, 48, 49, 50, 51 | Supported (ESM) |

Wayland and X11 are supported. The primary development target is GNOME Shell
50. Effects that need Clutter import it lazily, so the first drag after shell
startup may skip them while the import completes; later drags work normally.

`tint` uses the full-shader `Clutter.ShaderEffect` API. If a future shell version
removes that API, the effect logs a diagnostic and is skipped while the other
effects keep working.

## Development

### Repository layout

```text
extension.js                 engine and actor application
prefs.js                     generated Preferences UI
effects/                     one module per effect; index.js is the registry
lib/                         shared helpers and lazy loaders
schemas/                     GSettings schema
tools/                       validation, packaging, and configuration
docs/                        publishing notes
```

### Nested shell

On **Wayland**, test changes without logging out:

```bash
./nested-shell.sh
```

The script:

1. Installs the extension (runs `./install.sh`).
2. Starts a nested GNOME Shell (`--nested --wayland`, or `--devkit --wayland`
   on GNOME 49+).
3. Enables `drag-effects@example.com` inside the nested session and opens
   Preferences on the nested display. Drag the Preferences window to test.
4. Writes `/tmp/drag-effects-nested.log` (errors and effect messages only by
   default).
5. The extension writes diagnostics to `~/.cache/drag-effects.log` (cleared on
   every enable; read it with `cat ~/.cache/drag-effects.log`).

Options: `--no-prefs` (do not open Preferences), `--no-install`, `-v` (print
the full nested log).

Close the nested window to exit. After editing code, run the script again; no
logout is needed. GNOME 49+ requires the `mutter-devkit` package; the script
explains how to install it if it is missing.

> X11 has no nested shell: use `./install.sh`, then `Alt+F2` → `r` → Enter.
> Inside a Flatpak sandbox, run the script from a terminal on the desktop.

> Do not run this extension together with `drag-fx@example.com` (the older
> version) or **Compiz windows effect**: all of them write window transforms.

### Checks and packaging

```bash
make check          # schema, metadata, scripts, registry, control keys
make check-release  # fails while URL/UUID placeholders remain
make pack           # portable zip in dist/
make pack-gnome     # official gnome-extensions pack, if installed
```

`make check` runs `glib-compile-schemas --strict`, validates `metadata.json`,
checks every effect key against the schema, and verifies that `prefs.js` cannot
accidentally import Clutter, Meta, Shell, Cogl, or GObject at the top level.

`make pack` produces `dist/drag-effects@example.com.shell-extension.zip` with
`metadata.json` at the ZIP root. `make pack-gnome` uses the official helper and
produces the same layout.

## Adding an effect

### 1. Create the module

Copy `effects/_template.js` to `effects/spin.js`:

```js
import {DragEffect, alphaFor, timeScale} from '../lib/effect.js';
import {readDouble} from '../lib/settings.js';

export class SpinEffect extends DragEffect {
    static id = 'spin';                         // -> effect-spin-enabled
    static title = 'Spin';
    static description = 'Example description shown in Preferences.';

    static controls = [
        {
            key: 'spin-strength',
            type: 'double',
            title: 'Strength',
            min: 0, max: 3, step: 0.05,
        },
    ];

    start(_ctx) {
        this._angle = 0;
    }

    update(ctx, frame) {
        const strength = readDouble(this.settings, 'spin-strength', 0.5);
        const target = ctx.dx * strength;

        this._angle += (target - this._angle) *
            alphaFor(0.2, timeScale(ctx.dt));

        frame.rotationZ += this._angle;
    }
}
```

`update()` only writes to `frame`:
`rotationX`/`rotationY`/`rotationZ` (additive), `scaleX`/`scaleY`
(multiplicative), and `opacity` (0–255).

### 2. Declare the keys in the schema

`schemas/org.gnome.shell.extensions.drag-effects.gschema.xml`:

```xml
<key name="effect-spin-enabled" type="b">
  <default>false</default>
</key>

<key name="spin-strength" type="d">
  <default>0.5</default>
  <range min="0" max="3"/>
</key>
```

### 3. Register it in `effects/index.js`

```js
import {SpinEffect} from './spin.js';

export const EFFECTS = [
    TiltEffect,
    // ...
    TrailEffect,
    SpinEffect,          // add this line
];
```

### 4. Reinstall and restart

```bash
./install.sh
# Wayland: log out and back in. X11: Alt+F2 -> r
```

Preferences automatically gets a new group with a switch and the controls you
declared.

### Supported control types

```js
{key, type: 'switch', title, subtitle?}
{key, type: 'int',    title, subtitle?, min, max, step}
{key, type: 'double', title, subtitle?, min, max, step, digits?}
{key, type: 'enum',   title, subtitle?, options: [{value, label}]}
```

If a key is missing from the schema, `lib/settings.js` uses the fallback value
and Preferences skips that control with a warning. This is convenient during
development, but `make check` treats it as an error for release.

### Adding a new transform property

`Frame` currently has `rotationX`, `rotationY`, `rotationZ`, `scaleX`,
`scaleY`, and `opacity`. To add, for example, translation:

1. Add the field to `lib/frame.js` and reset it to its neutral value.
2. Apply it to the actor in `_applyFrame()` in `extension.js` (for example
   `actor.translation_x`, or a `Clutter.Transform`).
3. Have the new effect write that field in `update()`.

For offscreen effects, shaders, or clones, attach the Clutter object in
`start(ctx)` and remove it in `stop(ctx)`, as `tint`, `ghost`, `trail`, and
`desaturate` do. Always wrap the calls in `try/catch`: the actor may be
destroyed if the window closes mid-drag.

> **Important:** `prefs.js` imports every file in `effects/` to read metadata,
> but the Preferences process **does not have** the Clutter, Meta, or Shell
> typelibs. Never use top-level `import Clutter from 'gi://Clutter'` (or Meta /
> Shell) in an effect module. Use the lazy loader in `lib/clutter.js` from
> `enable()` and call `getClutter()` from `start()`/`update()`/`stop()`.

## Effect lifecycle

| Hook | When | Use it for |
| --- | --- | --- |
| `enable()` | extension enabled | allocate resources, start lazy loading |
| `start(ctx)` | drag begins | reset state, read actor values |
| `update(ctx, frame)` | every frame | compute values and write to the frame |
| `stop(ctx)` | mouse released | clean up before the release animation |
| `disable()` | extension disabled | release resources |

`ctx` contains: `actor`, `win`, `x`, `y`, `dx`, `dy`, `dt`, `elapsed`,
`width`, `height`, `pivot`, and `settings`.

The set of active effects is fixed when a drag begins; toggling effects during
a drag applies to the next drag. If `update()` throws, that effect is removed
from the current drag and the error is logged. `stop()` is always called, even
if `start()` failed halfway or the actor was destroyed, so effects can clean
up.

## Debugging

```bash
journalctl -f -o cat /usr/bin/gnome-shell
gnome-extensions info drag-effects@example.com
cat ~/.cache/drag-effects.log
```

Looking Glass (`Alt+F2` → `lg`) → **Extensions** tab also shows errors.

Quick schema/key check:

```bash
GSETTINGS_SCHEMA_DIR=~/.local/share/gnome-shell/extensions/drag-effects@example.com/schemas \
  gsettings list-keys org.gnome.shell.extensions.drag-effects
```

## Publishing

The repository is ready for GitHub and extensions.gnome.org:

1. Set the repository URL and production UUID:
   `./tools/configure.sh <github-user> [repo]`.
2. Run `make check-release` and `make pack`.
3. Push the repository and tag a release; the `Release` workflow attaches the
   ZIP to the GitHub release.
4. Upload the ZIP at <https://extensions.gnome.org/upload/>.

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for the full checklist.

## Contributing

Bug reports, effect ideas, and pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before adding an effect or changing the
engine.

## License

Drag Effects is licensed under the
[GNU General Public License v3.0 or later](LICENSE).
