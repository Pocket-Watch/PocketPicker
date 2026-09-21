# PocketPicker
A browser extension (MV2 and MV3) that captures media URLs, subtitles, and related metadata from webpages you visit.
It integrates with [Pocket Watch](https://github.com/Pocket-Watch) by sending captured entries to a preconfigured server.

## Features

- **Automatic capture** - intercepts media requests (video, audio, streams, subtitles) by URL extension or Content-Type
- **Card-based popup** - browse captured entries with thumbnails, media-type icons, and expandable detail panels
- **Search** - filter entries by URL, referer, or extension
- **Deduplicate** - remove duplicate URLs from the capture list
- **Context menu** - right-click any entry for Insert, Copy URL, Copy Referer, Expand, or Delete
- **Insert into page** - push a captured URL into the current tab's subtitle or media input fields

## Building

Use the packer scripts to produce a clean zip containing only the extension files:

```bash
# MV2 (default)
./packer.sh 1.4

# MV3
./packer.sh 1.4 -mv3
```

Or on Windows:

```powershell
.\packer.ps1 -Version 1.4
.\packer.ps1 -Version 1.4 -mv3
```

This produces `PocketPicker-v1.4.zip` (MV2) or `PocketPicker-v1.4-mv3.zip` (MV3).

## Loading extensions for testing

### Firefox (MV2)

1. Navigate to `about:addons`
2. Click the settings icon to the right of "Manage Your Extensions"
3. Click on `Debug Add-ons`
4. Click on `Load Temporary Add-on`
5. Select `manifest.json` (at project's root directory)

### Firefox (MV3)

1. Navigate to `about:config`
2. Set `extensions.install.requireSystemAddon` to `false`
3. Follow the same steps as above but select `manifest_v3.json`

### Chromium-based browsers (MV3)

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Press "Load unpacked" button
4. Select the extension root directory (use `manifest_v3.json` for MV3)

### Safari

1. Open Safari
2. Select "Safari" from the Apple menu bar then "Settings..."
3. Navigate to the "Developer" tab
4. Click "Add Temporary Extension" button at the bottom
5. Enter your password in the prompt
6. Select the extension's root directory

## Publishing to Mozilla

1. Ensure `"version"` is updated in `manifest.json`
2. Pack the extension with `./packer.sh <version>`
3. Sign in at https://addons.mozilla.org/developers/addons
4. Click on the extension (or **Submit a New Add-on** for first release)
5. Upload the `.zip` file
6. Mark Firefox and Android compatibility, proceed with other prompts
7. Once uploaded, click **View all**
8. Click the version number - if status shows **Awaiting review** the extension is under review
9. If status shows **Approved**, right-click the .xpi file and click **Save link as**
