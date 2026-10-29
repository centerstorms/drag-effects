# Changelog

All notable changes to Drag Effects are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project follows [Semantic Versioning](https://semver.org/).

## [3.0.0] - 2026-10-28

### Added

- Motion effects: `tilt3d`, `shake`, and `spring`.
- Shared lazy Clutter loader (`lib/clutter.js`) for shader and clone effects.
- Automatic Preferences UI generation from each effect's `static controls`.
- A Ko-fi donation section in Preferences.
- Portable package builder (`tools/package.sh`) and static checks
  (`tools/check_extension.py`).
- GitHub Actions workflows for validation and tagged releases.

### Changed

- English UI strings, effect descriptions, metadata, and documentation.
- `desaturate` is now grouped with the material effects.
- `skip-maximized` now skips only fullscreen windows. Maximized windows remain
  draggable and unmaximize when dragged out.
- The release animation, debug logging, and effect cleanup were hardened.

### Removed

- `speed-zoom`, `squash`, `pulse`, `accel-tilt`, `wobble`, `swing`, `jelly`,
  and `fade-speed`. They overlapped with stronger core effects or were too
  subtle to notice during a normal drag.

### Fixed

- Read maximized state with `win.is_maximized()` on GNOME 50.
- Use `insert_child_below` semantics instead of the removed
  `Clutter.Actor.get_index()` for ghost and trail clones.
- Avoid `Clutter.ShaderType`, which is not available in GNOME 50; the default
  fragment shader type is used instead.

## [2.0.0] - 2026-10-27

### Added

- Initial pluggable effect registry, engine, Preferences UI, and GSettings
  schema.
- Core effects: `tilt`, `stretch`, `lift`, and `opacity`.
- Material effect: `desaturate`.

[3.0.0]: https://github.com/centerstorms/drag-effects/releases/tag/v3.0.0
[2.0.0]: https://github.com/centerstorms/drag-effects/releases/tag/v2.0.0
