
function logInfo(...args) {
    const message = args.join(' ');
    console.info("%c[PocketPicker]", "color: green;", message);
}

function logWarn(...args) {
    const message = args.join(' ');
    console.warn("%c[PocketPicker]", "color: red;", message);
}

// 'browser' is undefined in Chromium but in Firefox both 'chrome' and 'browser' are defined
if (typeof browser === "undefined") {
    isChromium = true;
    browser = chrome;
}

const INSERT_ENTRIES = "insert_entries";

browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === INSERT_ENTRIES) {
        let success = performInsertions(message.entry);
        // send result to foreground (picker.js) and show in UI
        if (success) {
            logInfo("Inserted into page successfully")
        } else {
            logWarn("Inserted into page with a failure")
        }
    }
});

function performInsertions(entry) {
    let success = true;
    let urlBox = getById("entry_url_input");
    success &= setText(urlBox, entry.url);

    let refererBox = getById("entry_dropdown_referer_input");
    success &= setText(refererBox, entry.referer);

    let proxyToggleDiv = getById("entry_proxy_toggle");
    if (!proxyToggleDiv) {
        return false;
    }
    if (!proxyToggleDiv.classList.contains("active")) {
        proxyToggleDiv.click()
    }
    return success;
}

function getById(id) {
    return document.getElementById(id);
}

function setText(element, text) {
    if (element == null) {
        logWarn("Given element is null, cannot insert text!");
        return false;
    }
    if (!(element instanceof HTMLElement)) {
        logWarn(element, "is not an HTMLElement");
        return false;
    }
    const tag = element.tagName.toLowerCase(); // Convert to lowercase for consistency

    switch (tag) {
        case "input":
        case "textarea":
            element.value = text;
            return true;
        default:
            element.innerText = text;
            return true;
    }
}
