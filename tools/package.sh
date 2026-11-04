#!/usr/bin/env bash
# Build a GNOME Extensions-compatible ZIP from the source tree.
#
# This intentionally does not require gnome-extensions(1), so it also works in
# minimal containers and CI. The output layout is:
#
#   metadata.json
#   extension.js
#   prefs.js
#   lib/*.js
#   effects/*.js
#   assets/*
#   schemas/*.gschema.xml
#   schemas/gschemas.compiled

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UUID="$(python3 -c 'import json, pathlib, sys; print(json.loads(pathlib.Path(sys.argv[1]).read_text())["uuid"])' "$ROOT/metadata.json")"
DIST="$ROOT/dist"
BUILD="$ROOT/build/package"
ZIP="$DIST/$UUID.shell-extension.zip"

if ! command -v glib-compile-schemas >/dev/null 2>&1; then
    echo "error: glib-compile-schemas is missing (libglib2.0-bin / glib2)" >&2
    exit 1
fi
if ! command -v zip >/dev/null 2>&1; then
    echo "error: zip is missing" >&2
    exit 1
fi

rm -rf "$BUILD" "$ZIP"
mkdir -p "$BUILD/schemas" "$DIST"

cp "$ROOT/metadata.json" "$ROOT/extension.js" "$ROOT/prefs.js" "$BUILD/"
cp -R "$ROOT/lib" "$ROOT/effects" "$ROOT/assets" "$BUILD/"
rm -f "$BUILD/effects/_template.js"
find "$BUILD" -type d -name '__pycache__' -prune -exec rm -rf {} +

cp "$ROOT/schemas/"*.gschema.xml "$BUILD/schemas/"
glib-compile-schemas "$BUILD/schemas"

(
    cd "$BUILD"
    zip -X -q -r "$ZIP" \
        metadata.json extension.js prefs.js lib effects assets schemas
)

echo "Created: $ZIP"
echo
echo "Package contents:"
python3 - "$ZIP" <<'PY'
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    for name in sorted(archive.namelist()):
        print(name)
PY
