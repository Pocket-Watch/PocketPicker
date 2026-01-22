#!/bin/sh
set -euo pipefail

version="${1:-}"
if [ -z "$version" ]; then
  echo "Usage: $0 <version>" >&2
  exit 2
fi

OUT="PocketPicker-v${version}.zip"

# Files/dirs to include
INCLUDE=(icons background.js content.js manifest.json picker.css picker.html picker.js)

TMPDIR="$(mktemp -d)"
removeTmpDir() { rm -rf "$TMPDIR"; }
trap removeTmpDir EXIT

# Copy listed items preserving paths
for item in "${INCLUDE[@]}"; do
  if [ -e "$item" ]; then
    # Ensure parent dirs exist in tmp, then copy
    DEST="$TMPDIR/$(dirname "$item")"
    mkdir -p "$DEST"
    cp -r "$item" "$DEST"/
  else
    echo "Warning: $item not found, skipping" >&2
  fi
done

# Create zip from the temp dir (no extra directory level)
( cd "$TMPDIR" && zip -r -X "$OLDPWD/$OUT" . )

echo "Created: $OUT"
