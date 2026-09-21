const MEDIA_EXTENSIONS = ["mp4", "mp3", "mp2", "mov", "mkv", "webm", "m3u8", "m3u", "txt", "vtt", "srt", "aac", "avi", "ogg", "mpd", "m4s"]
const ACCEPTED_METHODS = ["GET", "POST", "HEAD"];

// Chrome support for the 'browser' namespace was introduced in Chrome 152.
if (typeof browser === "undefined") {
    browser = chrome;
}

function userAgentBrowserName() {
    const ua = navigator.userAgent;

    let nameIndex = ua.lastIndexOf("Chrome/");
    if (nameIndex !== -1) return "Chromium";

    nameIndex = ua.lastIndexOf("Firefox/");
    if (nameIndex !== -1) return "Firefox";

    nameIndex = ua.lastIndexOf("Version/");
    if (nameIndex !== -1) return "Safari";

    return "Unknown";
}

// There's no single reliable way to detect Chromium
let isChromium = userAgentBrowserName() === "Chromium";
let isMV3 = browser.runtime.getManifest().manifest_version === 3;

let requestSpec = ["requestHeaders"];
let responseSpec = ["responseHeaders"];
if (isChromium) {
    requestSpec.push("extraHeaders");
    responseSpec.push("extraHeaders");
}

// onBeforeRequest does not provide request headers, so onBeforeSendHeaders is used instead
// TODO: Listen selectively, removeListener when inactive
browser.webRequest.onBeforeSendHeaders.addListener(processRequest,
    { urls: ["<all_urls>"] },
    requestSpec
);
browser.webRequest.onHeadersReceived.addListener(processResponse,
    { urls: ["<all_urls>"] },
    responseSpec
);
browser.webRequest.onErrorOccurred.addListener(processError,
    { urls: ["<all_urls>"] },
);

let requestMap = new Map();
let entryQueue = []

// MV3 service workers can be terminated at any time, so persist state to storage.session
function saveState() {
    if (!isMV3) return;
    chrome.storage.session.set({
        entryQueue: entryQueue,
        requestMap: Array.from(requestMap.entries()),
    });
}

// Restore state when the service worker wakes up (no-op on MV2, storage won't exist)
if (isMV3) {
    chrome.storage.session.get(["entryQueue", "requestMap"], (result) => {
        if (result.entryQueue) {
            entryQueue = result.entryQueue;
        }
        if (result.requestMap) {
            requestMap = new Map(result.requestMap);
        }
    });
}

async function processRequest(details) {
    if (!ACCEPTED_METHODS.includes(details.method)) {
        return;
    }
    let url = new URL(details.url);
    let extension = getExtension(url.pathname);
    let missingExt = extension.length === 0;
    if (!missingExt && !MEDIA_EXTENSIONS.includes(extension)) {
        return;
    }

    let entry = Entry.fromRequest(details);
    if (missingExt) {
        requestMap.set(entry.id, entry);
        saveState();
        return;
    }

    entry.extension = extension;
    entryQueue.push(entry)
    saveState();
}

async function processResponse(details) {
    if (requestMap.size === 0) {
        return
    }
    let id = Number(details.requestId);
    let entry = requestMap.get(id);
    if (!entry) {
        return
    }
    requestMap.delete(id)
    saveState();
    let code = details.statusCode;
    if (code < 200 || code >= 300) {
        return
    }
    let contentType = getHeaderValue(details.responseHeaders, "content-type");
    if (!contentType) {
        return
    }
    let semicolon = contentType.indexOf(';');
    if (semicolon > 0) {
        contentType = contentType.substring(0, semicolon);
    }
    let extension = "";
    switch (contentType) {
        case "video/mp4":
            extension = "mp4";
            break;
        case "video/mpeg":
            extension = "mpeg";
            break;
        case "audio/mp3":
            extension = "mp3";
            break;
        case "application/vnd.apple.mpegurl":
            extension = "m3u8";
            break;
    }
    if (extension.length > 0) {
        entry.extension = extension;
        // Chronological order insert
        let insertAt = entryQueue.length;
        for (let i = insertAt - 1; i >= 0; i--) {
            let queuedEntry = entryQueue[i];
            if (queuedEntry.time < entry.time) {
                insertAt = i + 1;
                break;
            }
        }
        entryQueue.splice(insertAt, 0, entry);
        saveState();
    }
}

// Remove pending entries whose requests failed, so they do not leak
async function processError(details) {
    if (requestMap.size === 0) {
        return
    }
    let id = Number(details.requestId);
    let entry = requestMap.get(id);
    if (!entry) {
        return
    }
    requestMap.delete(id)
    saveState();
}

function getExtension(pathname) {
    let end = pathname.length;
    for (let i = end - 1; i >= 0; i--) {
        if (pathname[i] === '/') {
            end = i;
        } else break;
    }
    for (let i = end-1; i >= 0; i--) {
        switch (pathname[i]) {
            case '.':
                return pathname.substring(i+1, end).toLowerCase();
            case '/':
                return ""
        }
    }
    return "";
}

const GET_ENTRIES = "get_entries";
const CLEAR_ENTRIES = "clear_entries";
const UPDATE_ENTRIES = "update_entries";
const DEDUPLICATE_ENTRIES = "deduplicate_entries";
const DELETE_ENTRY = "delete_entry";

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case GET_ENTRIES:
            sendResponse({entries: entryQueue});
            return

        case CLEAR_ENTRIES:
            entryQueue.length = 0;
            saveState();
            return

        case DELETE_ENTRY:
            let id = message.id;
            if (!Number.isInteger(id)) {
                console.error("ID passed is not an int:", id);
                return
            }
            for (let i = 0; i < entryQueue.length; i++) {
                if (entryQueue[i].id === id) {
                    entryQueue.splice(i, 1);
                    saveState();
                    sendResponse({index: i});
                    break;
                }
            }
            return
        case DEDUPLICATE_ENTRIES:
            let urlSet = new Set();
            let uniqueEntries = [];
            for (let i = 0; i < entryQueue.length; i++) {
                let entry = entryQueue[i];
                if (!urlSet.has(entry.url)) {
                    urlSet.add(entry.url);
                    uniqueEntries.push(entry)
                }
            }
            entryQueue = uniqueEntries;
            saveState();
            sendResponse({entries: entryQueue});
            return
    }
});

const EXTM3U = "#EXTM3U"
const STREAM_INFO = "#EXT-X-STREAM-INF"
function parseM3U8Metadata(content) {
    if (!content) {
        return;
    }
    let lines = content.split("\n");
    if (lines[0] !== EXTM3U) {
        return;
    }
    let isMaster = false;
    let qualities = [];
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        if (line.startsWith(STREAM_INFO)) {
            isMaster = true;
            let pairLine = line.substring(STREAM_INFO.length + 1);
            let pairs = pairLine.split(",");
            for (const pair of pairs) {
                let [key, value] = pair.split("=");
                if (key === "RESOLUTION") {
                    let x = value.indexOf("x");
                    let height = value.substring(x + 1);
                    if (height) {
                        qualities.push(height + "p")
                    }
                }
            }
        }
    }
    // Should parse VOD and LIVE properly once the entire payload is read
    return new Metadata(isMaster ? "MASTER" : "VOD/LIVE", qualities);
}

function getHeaderValue(headers, name) {
    for (let i = 0; i < headers.length; i++) {
        let header = headers[i];
        // Some requests send the literal value "null", treat it as missing
        if (header.name === name && header.value !== "null") {
            return header.value;
        }
    }
    return null;
}

class Metadata {
    constructor(type, ...qualities) {
        this.type = type;
        this.qualities = qualities;
    }
}

class Entry {
    constructor(id, url, origin, referer, tabId) {
        // Fall back to the origin URL when no referer header was sent
        if (!referer && origin) {
            referer = origin + "/";
        }
        this.time = Date.now();
        this.id = id;
        this.url = url;
        this.origin = origin;
        this.referer = referer;
        this.tabId = tabId;
        this.extension = "";
        this.metadata = null;
    }

    static fromRequest(request) {
        let tabId = request.tabId;
        let headers = request.requestHeaders;
        let origin = getHeaderValue(headers, "Origin");
        let referer = getHeaderValue(headers, "Referer");
        return new Entry(Number(request.requestId), request.url, origin, referer, tabId);
    }
}
