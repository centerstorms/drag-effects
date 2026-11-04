# Drag Effects

[![CI](https://github.com/centerstorms/drag-effects/actions/workflows/ci.yml/badge.svg)](https://github.com/centerstorms/drag-effects/actions/workflows/ci.yml)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%E2%80%9351-4a86cf.svg)](#compatibility)

## Support

<p align="center">
  Your support helps maintain and improve Drag Effects, develop new features,
  and ensure smooth updates. Even a small donation makes a big difference!
  <br><br>
  <a href="https://ko-fi.com/centerstorms"><img src="assets/support-kofi.png" alt="Support Me on Ko-fi" width="300"></a>
  <br><br>
  Thank you for your support!
</p>

## Overview

Drag Effects is a **pluggable effect framework** for dragging windows in GNOME
Shell. Every effect is an independent module with its own switch and settings in
Preferences.

- **11 focused effects** in three groups: core, motion, and material.
- **Pluggable by design:** adding an effect means adding one module and schema
  keys. `extension.js` and `prefs.js` do not need to change.
- **Safe defaults:** new effects are disabled until you enable them.
- **GNOME Shell 45–51**, Wayland and X11. English UI and documentation.

## Effects

| Set | Effect | What it does |
| --- | --- | --- |
| Core | Tilt | Rotates the window with horizontal inertia |
| Core | Stretch | Stretches the window vertically on fast upward/downward drags |
| Core | Lift | Shrinks the window slightly, like lifting it off the desktop |
| Core | Opacity | Fades the window a little while dragging |
| Motion | 3D Tilt | Tilts the window in space around both screen axes |
| Motion | Shake | Shakes the window proportionally to drag speed |
| Motion | Spring | Follows the drag with an elastic overshoot and oscillation |
| Material | Desaturate | Drains color from the window while dragging |
| Material | Tint | Overlays the drag direction with a chosen color tint |
| Material | Ghost | Leaves a single translucent afterimage lagging behind |
| Material | Trail | Leaves a short trail of translucent afterimages |

Every effect has its own switch in Preferences. Core effects are on by default;
motion and material effects are off by default.

Common settings: `pivot-mode` (transform origin at the pointer or the window
center), `release-wobble`, `release-duration`, `frame-interval`,
`only-normal-windows`, and `skip-maximized`.

> Do not run this extension together with **Compiz windows effect** or similar
> window-transform extensions.

## Installation

### From extensions.gnome.org

Once the extension is published, install it from its page on
[extensions.gnome.org](https://extensions.gnome.org/). The website also
handles updates.

### From a GitHub release

Download the latest `.shell-extension.zip` from the
[releases page](https://github.com/centerstorms/drag-effects/releases), then:

```bash
gnome-extensions install --force drag-effects@centerstorms.shell-extension.zip

# Wayland: log out and back in
# X11:     Alt+F2 -> type "r" -> Enter

gnome-extensions enable drag-effects@centerstorms
gnome-extensions prefs drag-effects@centerstorms
```

### From source

Requirements: GNOME Shell 45+, `glib-compile-schemas`, and `zip`.

```bash
git clone https://github.com/centerstorms/drag-effects.git
cd drag-effects
make check
./install.sh

# Wayland: log out and back in
# X11:     Alt+F2 -> type "r" -> Enter

gnome-extensions enable drag-effects@centerstorms
gnome-extensions prefs drag-effects@centerstorms
```

`make install && make enable` also works; uninstall with
`./install.sh uninstall` or `make uninstall`.

> **Important:** GNOME Shell scans extension directories **once at startup**.
> If you copy files while logged in, the shell will not see the new code until
> you log out and back in (Wayland) or run a nested shell. Disabling and
> re-enabling the extension does **not** reload ESM modules.

## Compatibility

| GNOME Shell | Status |
| --- | --- |
| 45, 46, 47, 48, 49, 50, 51 | Supported (ESM) |

Effects that need Clutter (shaders, clones) import it lazily, so the very first
drag after shell startup may skip them while the import completes; later drags
work normally.

## How it works

```
                 grab-op-begin / grab-op-end
                              │
                     ┌────────▼────────┐
                     │  extension.js   │   engine (knows no effect)
                     └────────┬────────┘
                              │ start / update / stop
      ┌───────────┬───────────┼───────────┬──────────┐
      ▼           ▼           ▼           ▼          ▼
   tilt.js    stretch.js    lift.js    opacity.js  (new effect)
      └───────────┴───────────┼───────────┴──────────┘
                              ▼
            Frame {rotationX, rotationY, rotationZ,
                   scaleX, scaleY, opacity}
                              │
                              ▼
                Meta.WindowActor (transform + opacity)
```

Each effect only writes into a shared `Frame`; the engine aggregates it and
applies it to the window actor once per frame. `prefs.js` builds the whole
Preferences UI from each effect's `static controls` — adding an effect needs no
engine or preferences changes.

## Development

```bash
make check          # schema, metadata, scripts, registry, control keys
make check-release  # fails while URL/UUID placeholders remain
make pack           # portable zip in dist/
```

On Wayland, test changes with a local nested-shell helper
(`nested-shell.sh`, kept out of the repo):
`./nested-shell.sh` or `DRAG_EFFECTS_DEBUG=1 ./nested-shell.sh`
(`--no-prefs`, `--no-install`, `-v` are available options). On X11, use
`./install.sh` then `Alt+F2` → `r` → Enter.

### Adding an effect

1. Copy `effects/_template.js` to `effects/<id>.js`; give the class a unique
   `static id`, `title`, `description`, and `static controls`.
2. Declare `effect-<id>-enabled` and every control key in the
   [GSettings schema](schemas/org.gnome.shell.extensions.drag-effects.gschema.xml).
3. Import the class and add it to the `EFFECTS` registry in
   [effects/index.js](effects/index.js).
4. Reinstall: `./install.sh` and restart the shell.

Preferences picks up the new switch and controls automatically. See
[CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Debugging

Diagnostics are disabled by default. To enable them:

```bash
mkdir -p ~/.config/environment.d
echo 'DRAG_EFFECTS_DEBUG=1' > ~/.config/environment.d/100-drag-effects-debug.conf
systemctl --user import-environment DRAG_EFFECTS_DEBUG
```

Then log out and back in and filter the journal:

```bash
journalctl --user -f | grep drag-effects
```

Looking Glass (`Alt+F2` → `lg`) → **Extensions** tab also shows errors.

## Publishing

1. Run `make check-release` and `make pack` — both must pass.
2. Push the repository and tag `v3.0.0`; the release workflow attaches the
   ZIP to the GitHub release.
3. Upload the ZIP at <https://extensions.gnome.org/upload/>.

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for the full checklist.

## License

Drag Effects is licensed under the
[GNU General Public License v3.0 or later](LICENSE).
