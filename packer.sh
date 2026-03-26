#!/bin/sh
set -euo pipefail

version="${1:-}"
mv="${2:-2}"

if [ -z "$version" ]; then
    echo "Usage: $0 <version> [-mv3]" >&2
    echo "  -mv3  Pack with manifest V3 (optional, defaults to V2)" >&2
    exit 2
fi

COMMON=(icons background.js content.js picker.css picker.html picker.js)

if [ "$mv" = "-mv3" ] || [ "$mv" = "--manifest-version-3" ]; then
    echo "Packing the extension with manifest version 3"
    echo "---------------------------------------------"
    OUT="PocketPicker-v${version}-mv3.zip"
    zip -r "$OUT" "${COMMON[@]}"
    # Add manifest_v3.json as manifest.json inside the zip
    zip -j "$OUT" manifest_v3.json && printf "@ manifest_v3.json\n@=manifest.json\n" | zipnote -w "$OUT"
else
    echo "Packing the extension with manifest version 2"
    echo "---------------------------------------------"
    OUT="PocketPicker-v${version}.zip"
    zip -r "$OUT" "${COMMON[@]}" manifest.json
fi

echo "Created: $OUT"
