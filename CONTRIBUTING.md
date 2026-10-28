# Contributing to Drag Effects

Thanks for improving Drag Effects. This project is a pluggable GNOME Shell
extension; keeping the engine independent from individual effects is the most
important design rule.

## Development environment

- GNOME Shell 45 or newer on Wayland (recommended) or X11.
- `gjs`, `glib-compile-schemas`, and `zip`.
- On GNOME 49+, the nested test runner needs `mutter-devkit`.

Clone the repository and run the checks:

```bash
git clone https://github.com/your-username/drag-effects.git
cd drag-effects
make check
```

`make check` validates the schema, metadata, shell scripts, effect registry,
effect control keys, and the lazy-Clutter rule.

## Testing

Use a nested shell so you do not have to log out:

```bash
./nested-shell.sh
```

Enable the effects in Preferences and drag a window. Read the diagnostics with:

```bash
cat ~/.cache/drag-effects.log
```

The first drag after startup may skip effects that need Clutter while the
lazy import completes; drag a second time.

## Adding an effect

1. Copy `effects/_template.js` to `effects/<id>.js`.
2. Give the class a unique `static id`, a title, a description, and controls.
3. Add `effect-<id>-enabled` and every control key to
   `schemas/org.gnome.shell.extensions.drag-effects.gschema.xml`.
4. Register the class in `effects/index.js`.
5. Run `make check` and test with `./nested-shell.sh`.

You do **not** need to edit `extension.js` or `prefs.js`.

### Lazy-load Clutter

`prefs.js` imports every effect module to build the UI, and the Preferences
process does not have the Clutter, Meta, or Shell typelibs. Never import
`gi://Clutter`, `gi://Meta`, `gi://Shell`, `gi://Cogl`, or `gi://GObject` at
the top level of an effect or `lib/` module. Use `lib/clutter.js` from
`enable()` and call `getClutter()` in `start()`/`update()`/`stop()`.

### Cleanup

Effects that attach a `Clutter.Effect` or create `Clutter.Clone` actors must
release them in `stop()` and `disable()`. The engine calls `stop()` even if the
window is closed mid-drag.

## Style

- Match the existing module and naming style.
- Keep user-facing strings in English.
- Keep comments concise and explain non-obvious API choices.
- Do not add new runtime dependencies unless they are part of GNOME Shell.

## Pull requests

- Keep one logical change per pull request.
- Include a short description, test steps, and the GNOME Shell version used.
- Update `README.md` and `CHANGELOG.md` when behavior or settings change.
- Make sure `make check` and `make pack` pass.

## License

By contributing, you agree that your contributions are licensed under the
GNU General Public License v3.0 or later. See [LICENSE](LICENSE).
