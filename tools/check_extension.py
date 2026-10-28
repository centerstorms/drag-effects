#!/usr/bin/env python3
"""Static checks for the Drag Effects GNOME Shell extension.

This script intentionally uses only the Python standard library so it can run
in CI without installing extra packages.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
WARNINGS: list[str] = []


def error(message: str) -> None:
    ERRORS.append(message)


def warn(message: str) -> None:
    WARNINGS.append(message)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


metadata_path = ROOT / "metadata.json"
if not metadata_path.exists():
    error("metadata.json is missing")
    print("\n".join(ERRORS))
    sys.exit(1)

try:
    metadata = json.loads(read(metadata_path))
except json.JSONDecodeError as exc:
    error(f"metadata.json is not valid JSON: {exc}")
    print("\n".join(ERRORS))
    sys.exit(1)

required_fields = {
    "uuid": str,
    "name": str,
    "description": str,
    "shell-version": list,
    "url": str,
    "settings-schema": str,
}
for field, expected in required_fields.items():
    value = metadata.get(field)
    if value is None:
        error(f"metadata.json: missing required field '{field}'")
    elif not isinstance(value, expected):
        error(
            f"metadata.json: '{field}' must be {expected.__name__}, "
            f"got {type(value).__name__}"
        )

uuid = metadata.get("uuid", "")
if not re.fullmatch(r"[A-Za-z0-9._-]+@[A-Za-z0-9._-]+", uuid):
    error("metadata.json: uuid must look like name@namespace")
if uuid.endswith("@example.com"):
    warn("metadata.json: uuid still uses the development @example.com namespace")
if "version" in metadata:
    error(
        "metadata.json: remove 'version'; extensions.gnome.org controls it "
        "and recommends using 'version-name' instead"
    )
version_name = metadata.get("version-name")
if version_name is not None:
    if not isinstance(version_name, str) or not re.fullmatch(
        r"(?!^[. ]+$)[a-zA-Z0-9 .]{1,16}", version_name
    ):
        error("metadata.json: invalid version-name")

url = metadata.get("url", "")
if not re.match(r"^https?://", url):
    error("metadata.json: url must be an http(s) URL")
if "your-username" in url or "example.com" in url:
    warn("metadata.json: replace the placeholder URL before publishing")

shell_versions = metadata.get("shell-version", [])
if not shell_versions:
    error("metadata.json: shell-version must include at least one version")
for version in shell_versions:
    if not isinstance(version, str) or not re.fullmatch(r"\d+", version):
        error(f"metadata.json: invalid shell-version {version!r}")

schema_id = metadata.get("settings-schema", "")
schema_path = ROOT / "schemas" / f"{schema_id}.gschema.xml"
if not schema_id:
    error("metadata.json: settings-schema is empty")
elif not schema_path.exists():
    error(f"schema file not found: {schema_path.relative_to(ROOT)}")

schema_keys: set[str] = set()
if schema_path.exists():
    schema_text = read(schema_path)
    match = re.search(r'<schema\s+id="([^"]+)"', schema_text)
    if not match:
        error(f"{schema_path.name}: missing <schema id=...>")
    elif match.group(1) != schema_id:
        error(
            f"{schema_path.name}: schema id {match.group(1)!r} does not match "
            f"metadata settings-schema {schema_id!r}"
        )
    schema_keys = set(re.findall(r'<key\s+name="([^"]+)"', schema_text))
    if not schema_keys:
        error(f"{schema_path.name}: no keys found")
    if len(schema_keys) != len(re.findall(r'<key\s+name="', schema_text)):
        error(f"{schema_path.name}: duplicate key names")

effect_ids: dict[str, Path] = {}
for effect_path in sorted((ROOT / "effects").glob("*.js")):
    if effect_path.name in {"index.js", "_template.js"}:
        continue
    text = read(effect_path)
    id_match = re.search(r"static\s+id\s*=\s*'([^']+)'", text)
    if not id_match:
        error(f"{effect_path.name}: missing static id")
        continue
    effect_id = id_match.group(1)
    if effect_id in effect_ids:
        error(
            f"duplicate effect id {effect_id!r}: "
            f"{effect_path.name} and {effect_ids[effect_id].name}"
        )
    effect_ids[effect_id] = effect_path

    enabled_key = f"effect-{effect_id}-enabled"
    if enabled_key not in schema_keys:
        error(f"{effect_path.name}: schema is missing '{enabled_key}'")

    # Keys read by the effect implementation.
    read_keys = set(
        re.findall(
            r"read(?:Int|Double|Boolean|String)\(\s*this\.settings\s*,\s*'([^']+)'",
            text,
        )
    )
    # Keys declared in the Preferences controls.
    control_keys = set(re.findall(r"\bkey:\s*'([^']+)'", text))
    for key in sorted(read_keys | control_keys):
        if key not in schema_keys:
            error(f"{effect_path.name}: schema is missing key '{key}'")

# Verify that every effect class imported by effects/index.js is registered,
# and that the registry does not contain unknown names.
index_path = ROOT / "effects" / "index.js"
if index_path.exists():
    index_text = read(index_path)
    imported = set(
        re.findall(
            r"import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*'\./[^']+\.js'",
            index_text,
        )
    )
    registry_match = re.search(
        r"export\s+const\s+EFFECTS\s*=\s*\[(.*?)\];", index_text, re.S
    )
    if not registry_match:
        error("effects/index.js: EFFECTS registry not found")
    else:
        registered = set(
            re.findall(r"\b([A-Z][A-Za-z0-9_]*)\b", registry_match.group(1))
        )
        missing = imported - registered
        unknown = registered - imported
        for name in sorted(missing):
            error(f"effects/index.js: {name} is imported but not registered")
        for name in sorted(unknown):
            error(f"effects/index.js: {name} is registered but not imported")
        if len(registered) != len(effect_ids):
            error(
                "effects/index.js: registry count does not match effect module "
                f"count ({len(registered)} vs {len(effect_ids)})"
            )

# prefs.js imports effect classes, so top-level Clutter/Meta/Shell imports are
# forbidden in effect and library modules.
for folder in ("effects", "lib"):
    for js_path in sorted((ROOT / folder).glob("*.js")):
        text = read(js_path)
        forbidden = re.findall(
            r"^\s*import\s+[^;]*from\s+['\"]gi://(Clutter|Meta|Shell|Cogl|GObject)['\"]",
            text,
            re.M,
        )
        if forbidden:
            error(
                f"{js_path.relative_to(ROOT)}: top-level GI import(s) "
                f"{', '.join(sorted(set(forbidden)))} are not allowed; "
                "load them lazily in enable()"
            )

# The Preferences process imports every effect module. Keep a lightweight
# guard against accidentally forgetting the lazy Clutter rule.
if not (ROOT / "lib" / "clutter.js").exists():
    error("lib/clutter.js is missing")

print(f"Effects: {len(effect_ids)}")
print(f"Schema keys: {len(schema_keys)}")
for message in WARNINGS:
    print(f"warning: {message}")
if ERRORS:
    print()
    for message in ERRORS:
        print(f"error: {message}")
    sys.exit(1)
print("OK")
