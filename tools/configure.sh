#!/usr/bin/env bash
# Set the public GitHub URL (and optionally a production UUID) in the
# extension metadata and in the scripts that install or run it.
#
#   ./tools/configure.sh <github-user> [repo]
#
# By default this sets:
#   url  = https://github.com/<github-user>/<repo>
#   uuid = drag-effects@<github-user>.github.io
#
# Use --keep-uuid to keep the current UUID, or --uuid <uuid> to provide one.
# Use --url <url> to override the repository URL.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
META="$ROOT/metadata.json"
KEEP_UUID=0
NEW_UUID=""
NEW_URL=""

usage() {
    cat <<EOF
Usage: $(basename "$0") <github-user> [repo] [options]

Options:
  --uuid <uuid>   use a specific UUID (for example name@example.org)
  --keep-uuid     keep the UUID currently in metadata.json
  --url <url>     use a specific repository URL
  -h, --help      show this help

Example:
  $(basename "$0") octocat drag-effects
EOF
}

if [ "$#" -eq 0 ]; then
    usage
    exit 2
fi

USER=""
REPO="drag-effects"
POSITIONAL=()
while [ "$#" -gt 0 ]; do
    case "$1" in
        --uuid)
            [ "$#" -ge 2 ] || { echo "error: --uuid needs a value" >&2; exit 2; }
            NEW_UUID="$2"
            shift 2
            ;;
        --keep-uuid)
            KEEP_UUID=1
            shift
            ;;
        --url)
            [ "$#" -ge 2 ] || { echo "error: --url needs a value" >&2; exit 2; }
            NEW_URL="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "error: unknown option $1" >&2
            usage >&2
            exit 2
            ;;
        *)
            POSITIONAL+=("$1")
            shift
            ;;
    esac
done

if [ "${#POSITIONAL[@]}" -lt 1 ] || [ "${#POSITIONAL[@]}" -gt 2 ]; then
    usage >&2
    exit 2
fi

USER="${POSITIONAL[0]}"
if [ "${#POSITIONAL[@]}" -eq 2 ]; then
    REPO="${POSITIONAL[1]}"
fi

if ! [[ "$USER" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$ ]]; then
    echo "error: invalid GitHub username: $USER" >&2
    exit 1
fi
if ! [[ "$REPO" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "error: invalid repository name: $REPO" >&2
    exit 1
fi

OLD_UUID="$(python3 -c 'import json, pathlib, sys; print(json.loads(pathlib.Path(sys.argv[1]).read_text())["uuid"])' "$META")"

if [ -z "$NEW_URL" ]; then
    NEW_URL="https://github.com/$USER/$REPO"
fi

if [ -z "$NEW_UUID" ]; then
    if [ "$KEEP_UUID" -eq 1 ]; then
        NEW_UUID="$OLD_UUID"
    else
        NEW_UUID="drag-effects@$USER.github.io"
    fi
fi

if ! [[ "$NEW_UUID" =~ ^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$ ]]; then
    echo "error: invalid UUID: $NEW_UUID" >&2
    exit 1
fi
if ! [[ "$NEW_URL" =~ ^https?:// ]]; then
    echo "error: URL must start with http:// or https://" >&2
    exit 1
fi

python3 - "$META" "$NEW_UUID" "$NEW_URL" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
uuid = sys.argv[2]
url = sys.argv[3]
data = json.loads(path.read_text())
data["uuid"] = uuid
data["url"] = url
path.write_text(json.dumps(data, indent=2) + "\n")
PY

python3 - "$ROOT" "$OLD_UUID" "$NEW_UUID" "$NEW_URL" "$USER" <<'PY'
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
old_uuid = sys.argv[2]
new_uuid = sys.argv[3]
new_url = sys.argv[4]
github_user = sys.argv[5]
skip_dirs = {".git", "build", "dist", "node_modules", "__pycache__", "tools"}
skip_suffixes = {".zip", ".png", ".jpg", ".jpeg", ".gif", ".compiled"}
skip_files = {(root / "tools" / "configure.sh").resolve()}

for path in root.rglob("*"):
    if not path.is_file():
        continue
    if path.resolve() in skip_files:
        continue
    if any(part in skip_dirs for part in path.parts):
        continue
    if path.suffix.lower() in skip_suffixes:
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    updated = (
        text.replace(old_uuid, new_uuid)
        .replace("https://github.com/your-username/drag-effects", new_url)
        .replace("your-username", github_user)
        .replace("<github-user>", github_user)
    )
    if updated != text:
        path.write_text(updated, encoding="utf-8")
PY

echo "Repository URL: $NEW_URL"
echo "UUID:           $NEW_UUID"
if [ "$OLD_UUID" != "$NEW_UUID" ]; then
    echo
    echo "The old UUID was: $OLD_UUID"
    echo "Reinstall the extension before testing the new UUID:"
    echo "  ./install.sh install"
    echo "  gnome-extensions enable $NEW_UUID"
fi
echo
echo "Next steps:"
echo "  1. Review the changes: git diff"
echo "  2. Run: ./tools/check_extension.py"
echo "  3. Build: ./tools/package.sh"
echo "  4. Commit and push to GitHub."
