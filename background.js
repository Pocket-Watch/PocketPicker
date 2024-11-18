console.log("Background worker started at", Date.now(), "!");

const MEDIA_EXTENSIONS = ["mp4", "mp3", "mp2", "mov", "mkv", "webm", "m3u8", "m3u"]
const IGNORE_EXTENSIONLESS = true;

// Needs testing on Chromium
if (typeof browser === "undefined") {
    browser = chrome;
}

// Should only listen selectively, instead of always in the background - removeListener
browser.webRequest.onSendHeaders.addListener(processRequest,
    { urls: ["<all_urls>"] },
    ["requestHeaders"]
);

function processRequest(request) {
    if (request.method !== "GET" && request.method !== "POST") {
        return;
    }
    let url = new URL(request.url);
    let dot = url.pathname.lastIndexOf('.');
    if (IGNORE_EXTENSIONLESS && dot === -1) {
        return;
    }
    let extension = url.pathname.substring(dot + 1)
    if (!MEDIA_EXTENSIONS.includes(extension)) {
        return;
    }
    let headers = request.requestHeaders;
    let origin = null;
    let referer = null;
    for (let i = 0; i < headers.length; i++) {
        let header = headers[i];
        if (header.name === "Origin") {
            origin = header.value;
            continue
        }
        if (header.name === "Referer") {
            referer = header.value;
        }
    }
    console.log("URL:", request.url);
    console.log("Origin:", origin);
    console.log("Referer:", referer);
}


// For "webRequest.onBeforeRequest" headers are undefined even if "requestHeaders" is passed.
// Invalid enumeration value "requestHeaders" for webRequest.onBeforeRequest.