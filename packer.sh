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

zip -r "$OUT" "${Include[@]}"

echo "Created: $OUT"
