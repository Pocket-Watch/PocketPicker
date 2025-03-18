console.log("Background worker started at", Date.now(), "!");


const MEDIA_EXTENSIONS = ["mp4", "mp3", "mp2", "mov", "mkv", "webm", "m3u8", "m3u", "vtt", "srt"]
const ACCEPTED_METHODS = ["GET", "POST", "HEAD"];
const REQUIRE_EXTENSION = false;
const SCAN_QUERY_PARAMS = true;
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
} else {
    browser.webRequest.onBeforeSendHeaders.addListener(processRequest,
        { urls: ["<all_urls>"] },
        // blocking is passed here because webRequestBlocking is not enough to filterResponseData
        ["requestHeaders", "blocking"]
    );
}


let entryQueue = []

async function processRequest(details) {
    if (!ACCEPTED_METHODS.includes(details.method)) {
        return;
    }
    let url = new URL(details.url);
    let dot = url.pathname.lastIndexOf('.');
    let missingExt = dot === -1;
    if (REQUIRE_EXTENSION && missingExt) {
        return;
    }
    let extension = url.pathname.substring(dot + 1)
    if (!missingExt && !MEDIA_EXTENSIONS.includes(extension)) {
        return;
    }

    if (SCAN_QUERY_PARAMS && missingExt) {
        let foundAny = false;
        for (const [_, value] of url.searchParams) {
            if (!value.startsWith("http")) {
                continue;
            }
            let paramURL = new URL(value);
            if (!paramURL) {
                continue;
            }
            let paramExt = getExtension(paramURL.pathname);
            if (!MEDIA_EXTENSIONS.includes(paramExt)) {
                continue;
            }
            extension = paramExt;
            foundAny = true;
            break;
        }
        if (!foundAny) {
            return;
        }
    }

    let entry = Entry.fromRequest(details);
    entry.extension = extension;
    if (!isChromium && extension.startsWith("m3u")) {
        await supplementMetadata(entry, details.requestId);
    }
    entryQueue.push(entry)
    console.log(entry)
}

function getExtension(pathname) {
    let slash = Math.max(pathname.lastIndexOf("/"), pathname.lastIndexOf("\\"));
    let filename = pathname.substring(slash + 1);
    return filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
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

async function supplementMetadata(entry, requestId) {
    if (isChromium) {
        // Can't monitor response neither in MV2 nor MV3
        return;
    }
    console.log("Gathering additional metadata for requestId " + requestId);

    const decoder = new TextDecoder("utf-8"); // Specify the encoding
    let payload = "";

    let filter = browser.webRequest.filterResponseData(requestId);
    filter.ondata = (event) => {
        filter.write(event.data);
        // For now just the first read
        if (!payload) {
            payload = decoder.decode(event.data);
        }
    };
    filter.onstop = (_) => {
        // disconnect() - just in case any remaining response data is left.
        filter.disconnect();
        let metadata = parseM3U8Metadata(payload);
        if (metadata) {
            console.log(metadata)
            entry.metadata = metadata;
        }
    };
}

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
    constructor(url, origin, referer, tabId) {
        this.time = Date.now();
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
        return new Entry(request.url, origin, referer, tabId);
    }
}
// For "webRequest.onBeforeRequest" headers are undefined even if "requestHeaders" is passed.
// Invalid enumeration value "requestHeaders" for webRequest.onBeforeRequest.
