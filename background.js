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


let entryQueue = []

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
    let entry = new Entry(request.url, origin, referer);
    entryQueue.push(entry)
    console.log(entry)
    console.log(entryQueue)
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "getEntries") {
        console.log("getEntries - received from foreground");
        sendResponse({entries: entryQueue});
        return;
    }
    if (message.type === "clearEntries") {
        console.log("clearEntries - received from foreground");
        entryQueue.length = 0;
    }
    // entryQueue = [];
});

class Entry {
    constructor(url, origin, referer) {
        this.time = Date.now();
        this.url = url;
        this.origin = origin;
        this.referer = referer;
    }
}
// For "webRequest.onBeforeRequest" headers are undefined even if "requestHeaders" is passed.
// Invalid enumeration value "requestHeaders" for webRequest.onBeforeRequest.