console.log("Background worker started at", Date.now(), "!");

const MEDIA_EXTENSIONS = ["mp4", "mp3", "mp2", "mov", "mkv", "webm", "m3u8", "m3u"]
const ACCEPTED_METHODS = ["GET", "POST", "HEAD"];
const IGNORE_EXTENSIONLESS = true;
var isChromium = false;

// 'browser' is undefined in Chromium but in Firefox both 'chrome' and 'browser' are defined
if (typeof browser === "undefined") {
    isChromium = true;
    browser = chrome;
}

// Should only listen selectively, instead of always in the background - removeListener
if (isChromium) {
    // Chromium considers headers to be 'extra' so 'extraHeaders' is necessary to read them
    chrome.webRequest.onSendHeaders.addListener(processRequest,
        { urls: ["<all_urls>"] },
        ["requestHeaders", "extraHeaders"]
    );
} else {
    browser.webRequest.onSendHeaders.addListener(processRequest,
        { urls: ["<all_urls>"] },
        ["requestHeaders"]
    );
}


let entryQueue = []

function processRequest(request) {
    if (!ACCEPTED_METHODS.includes(request.method)) {
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
    let tabDomain = new URL(request.documentUrl).host;
    let headers = request.requestHeaders;
    let origin = null, referer = null;
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
    let entry = new Entry(request.url, origin, referer, tabDomain);
    entryQueue.push(entry)
    console.log(entry)
}

const GET_ENTRIES = "get_entries";
const CLEAR_ENTRIES = "clear_entries";

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === GET_ENTRIES) {
        console.log(GET_ENTRIES, "- received from foreground");
        sendResponse({entries: entryQueue});
        return;
    }
    if (message.type === CLEAR_ENTRIES) {
        console.log(CLEAR_ENTRIES, "- received from foreground");
        entryQueue.length = 0;
    }
    // entryQueue = [];
});

class Entry {
    constructor(url, origin, referer, tabDomain) {
        this.time = Date.now();
        this.url = url;
        this.origin = origin;
        this.referer = referer;
        this.tabDomain = tabDomain;
    }
}
// For "webRequest.onBeforeRequest" headers are undefined even if "requestHeaders" is passed.
// Invalid enumeration value "requestHeaders" for webRequest.onBeforeRequest.
