console.log("Background worker started at", Date.now(), "!");


const MEDIA_EXTENSIONS = ["mp4", "mp3", "mp2", "mov", "mkv", "webm", "m3u8", "m3u", "txt", "vtt", "srt", "aac", "avi", "ogg", "mpd"]
const ACCEPTED_METHODS = ["GET", "POST", "HEAD"];
var isChromium = false;

// 'browser' is undefined in Chromium but in Firefox both 'chrome' and 'browser' are defined
if (typeof browser === "undefined") {
    isChromium = true;
    browser = chrome;
}

// Should only listen selectively, instead of always in the background - removeListener
if (isChromium) {
    // Chromium considers headers to be 'extra' so 'extraHeaders' is necessary to read them
    chrome.webRequest.onBeforeSendHeaders.addListener(processRequest,
        { urls: ["<all_urls>"] },
        ["requestHeaders", "extraHeaders"]
    );
    chrome.webRequest.onHeadersReceived.addListener(processResponse,
        { urls: ["<all_urls>"] },
        ["responseHeaders", "extraHeaders"]
    );
    chrome.webRequest.onErrorOccurred.addListener(processError,
        { urls: ["<all_urls>"] },
    );
} else {
    browser.webRequest.onBeforeSendHeaders.addListener(processRequest,
        { urls: ["<all_urls>"] },
        ["requestHeaders"]
    );
    browser.webRequest.onHeadersReceived.addListener(processResponse,
        { urls: ["<all_urls>"] },
        // blocking may have to be passed here if we need to fetch from cache
        ["responseHeaders"]
    );
    browser.webRequest.onErrorOccurred.addListener(processError,
        { urls: ["<all_urls>"] },
    );
}

let requestMap = new Map();
let entryQueue = []

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
        return;
    }

    entry.extension = extension;
    /*if (extension.startsWith("m3u")) {
        // TODO, use fetch to extract metadata from response
    }*/
    entryQueue.push(entry)
    console.log(entry)
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
    let code = details.statusCode;
    if (code < 200 || code >= 300) {
        // Will this fire again on redirects?
        return
    }
    let contentType = null;
    let headers = details.responseHeaders;
    for (let i = 0; i < headers.length; i++) {
        let header = headers[i];
        if (header.name === "content-type") {
            contentType = header.value;
            break
        }
    }
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
        console.log("entryQueue.length", entryQueue.length);
        let insertAt = entryQueue.length;
        for (let i = insertAt - 1; i >= 0; i--) {
            let e = entryQueue[i];
            if (e.time < entry.time) {
                insertAt = i + 1;
                break;
            }
        }
        console.log("Adding entry by mime type:", entry)
        entryQueue.splice(insertAt, 0, entry);
    }
}

// Prevent memory leaks by processing errors or clean up by timestamp
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
            console.log(GET_ENTRIES, "- received from foreground");
            sendResponse({entries: entryQueue});
            return

        case CLEAR_ENTRIES:
            console.log(CLEAR_ENTRIES, "- received from foreground");
            entryQueue.length = 0;
            return

        case DELETE_ENTRY:
            let id = message.id;
            console.log(DELETE_ENTRY, "of id", id, "- received from foreground");
            if (!Number.isInteger(id)) {
                console.error("ID passed is not an int:", id);
                return
            }
            for (let i = 0; i < entryQueue.length; i++) {
                if (entryQueue[i].id === id) {
                    entryQueue.splice(i, 1);
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

class Metadata {
    constructor(type, ...qualities) {
        this.type = type; // VOD or MASTER or LIVE
        this.qualities = qualities;
    }
}

class Entry {
    constructor(id, url, origin, referer, tabId) {
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
        return new Entry(Number(request.requestId), request.url, origin, referer, tabId);
    }
}
// For "webRequest.onBeforeRequest" headers are undefined even if "requestHeaders" is passed.
// Invalid enumeration value "requestHeaders" for webRequest.onBeforeRequest.
