# PocketPicker
A browser MV2 extension that streamlines retrieving media URLs and other related metadata.
It'll integrate nicely into Pocket Watch by sending a request to the preconfigured server.

## Loading extensions for testing in Firefox
1. Navigate to `about:addons`
2. Click on the settings icon to the right of "Manage Your Extensions"
3. Click on `Debug Add-ons`
4. Click on `Load Temporary Add-on`
5. Select `manifest.json` (at project's root directory)

## Loading extensions for testing in Chromium-based browsers
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Press "Load unpacked" button
4. Select extension root directory

## Publishing extension in Mozilla
1. If there's an existing version, ensure `"version"` is updated in `manifest.json`
2. Zip up the extension folder, delete garbage like `README`, `LICENSE`, `.git`, `.gitignore`
3. Sign in or log in at https://addons.mozilla.org/developers/addons
4. Click on the extension (or click **Submit a New Add-on** if it's the first release)
5. Upload a new version - select .zip file
6. Mark Firefox and Android compatibility, proceed with other prompts
7. Once uploaded, click on **View all**
8. Click on version number, if status shows **Awaiting review** then the extension is not ready
9. If status shows **Approved**, right-click on the .xpi file and click **Save link as**


 