# Publishing Drag Effects

This checklist covers the GitHub repository and the GNOME Extensions website.
The extension is ready to build with either `make pack` or the official
`gnome-extensions pack` helper.

## 1. Set the public URL and UUID

The repository ships with development placeholders so it can be tested before
it has a public home. Run:

```bash
./tools/configure.sh <github-user> [repo]
```

For example:

```bash
./tools/configure.sh octocat drag-effects
```

This updates `metadata.json`:

```json
"url": "https://github.com/octocat/drag-effects",
"uuid": "drag-effects@octocat.github.io"
```

It also updates the UUID in `install.sh`, `nested-shell.sh`, `Makefile`, and
the documentation. Use `--keep-uuid` if you already have a production UUID, or
`--uuid name@example.org` to provide a custom one.

> The UUID is part of the installed directory name. Reinstall the extension
> after changing it, and remove the old directory if necessary.

## 2. Check the metadata

`metadata.json` should contain:

- `uuid` — a unique name in a namespace you control.
- `name` — `Drag Effects`.
- `description` — a short public description.
- `shell-version` — the GNOME Shell versions you actually support.
- `url` — a reachable public repository.
- `settings-schema` — `org.gnome.shell.extensions.drag-effects`.
- `version-name` — the version shown to users, for example `3.0.0`.

Do **not** add `version`. The GNOME Extensions website sets that field when a
submission is published.

## 3. Validate and build

```bash
make check
make check-release
make pack
```

`make check-release` fails if the development URL or `@example.com` UUID is
still present. `make pack` writes:

```text
dist/drag-effects@octocat.github.io.shell-extension.zip
```

The ZIP contains `metadata.json` at its root, plus `extension.js`, `prefs.js`,
`lib/`, `effects/`, and `schemas/gschemas.compiled`. It does not contain the
development tools, README, or tests.

Test the ZIP in a disposable session:

```bash
gnome-extensions install --force dist/*.shell-extension.zip
# Wayland: log out and back in
# X11:     Alt+F2 -> r -> Enter
gnome-extensions enable drag-effects@octocat.github.io
```

You can also use the official helper if it is installed:

```bash
make pack-gnome
```

## 4. Create the GitHub repository

The working tree is already a Git repository with an initial commit. To push
it to a new empty GitHub repository:

```bash
git remote add origin git@github.com:<github-user>/drag-effects.git
git branch -M main
git push -u origin main
```

If you use HTTPS:

```bash
git remote add origin https://github.com/<github-user>/drag-effects.git
```

The `CI` workflow runs on every push and pull request. It validates the
metadata, schema, effect registry, and package layout.

## 5. Create a release

Update `version-name` in `metadata.json`, update `CHANGELOG.md`, then:

```bash
git add metadata.json CHANGELOG.md
git commit -m "Release 3.0.0"
git tag v3.0.0
git push origin main
git push origin v3.0.0
```

The `Release` workflow builds the ZIP and attaches it to the GitHub release.
That ZIP is the file to upload to extensions.gnome.org.

## 6. Upload to GNOME Extensions

1. Sign in at <https://extensions.gnome.org/>.
2. Open <https://extensions.gnome.org/upload/>.
3. Upload `dist/<uuid>.shell-extension.zip`.
4. Check the automatically read metadata.
5. Add a screenshot if the form offers one. A good screenshot shows two or
   three effects in action, not just the Preferences window.
6. Submit for review. Reviews are manual; respond to reviewer comments in the
   issue thread.
7. After approval, the extension appears at
   `https://extensions.gnome.org/extension/<id>/drag-effects/`.

The website requires a valid `url` in `metadata.json`; the repository URL is
used for the “Homepage” link and issue reports.

## 7. Updating an extension

1. Change code and documentation.
2. Bump `version-name` in `metadata.json`.
3. Add a `CHANGELOG.md` entry.
4. Run `make check-release` and `make pack`.
5. Commit, tag, and push.
6. Upload the new ZIP to the existing GNOME Extensions page.

## 8. Screenshot and description tips

- Capture at 1920×1080 or 1280×720, with the window on a clean background.
- Show the effect clearly: a tilted/tinted window, a ghost/trail, or a
  Preferences page.
- Keep the description short and concrete; list the effect groups.
- Mention that new effects are off by default and are enabled in Preferences.
- Link to the repository and the changelog.

## Review guidelines

Read the official review guidelines before submitting:

- <https://gjs.guide/extensions/review-guidelines/review-guidelines.html>
- <https://gjs.guide/extensions/review-guidelines/best-practices.html>

Common review points relevant to this project:

- Clean up every actor, effect, signal, and timeout in `disable()`.
- Do not require a restart or logout for settings changes.
- Keep the Preferences process free of Clutter/Meta/Shell imports.
- Avoid private GNOME Shell APIs when a public API exists.
- Include a valid license and repository URL.
