function logInfo(...args) {
    const message = args.join(" ");
    console.info("%c[PocketPicker]", "color: green;", message);
}

function logWarn(...args) {
    const message = args.join(" ");
    console.warn("%c[PocketPicker]", "color: red;", message);
}

// Chromium before Chrome 152 defines only the 'chrome' namespace, Firefox defines both.
// Content scripts carry no engine specific logic, so no engine flag is kept here.
if (typeof browser === "undefined") {
    browser = chrome;
}

const INSERT_ENTRIES = "insert_entries";

browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === INSERT_ENTRIES) {
        let success = performInsertions(message.entry);
        if (success) {
            logInfo("Inserted into page successfully");
        } else {
            logWarn("Inserted into page with a failure");
        }
    }
});

function performInsertions(entry) {
    if (entry.extension === "vtt" || entry.extension === "srt") {
        let subtitleUrl = getById("entry_subtitle_url_input");
        return setText(subtitleUrl, entry.url);
    }

    let urlBox = getById("entry_url_input");
    let urlResult = setText(urlBox, entry.url);

    let refererBox = getById("entry_dropdown_referer_input");
    let refererResult = setText(refererBox, entry.referer);

    let proxyToggleDiv = getById("entry_proxy_toggle");
    if (!proxyToggleDiv) {
        return false;
    }
    if (!proxyToggleDiv.classList.contains("active")) {
        proxyToggleDiv.click();
    }

    return urlResult && refererResult;
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

    const tag = element.tagName.toLowerCase();
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
