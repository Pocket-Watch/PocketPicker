// ===========================================================================================
// PocketPicker - Foreground popup logic
// ===========================================================================================

if (typeof browser === "undefined") {
    browser = chrome;
}

// ---------------------------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------------------------

function getById(id) {
    return document.getElementById(id);
}

function div(className, textContent) {
    let element = document.createElement("div");
    element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

function span(className, textContent) {
    let element = document.createElement("span");
    element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

function button(className, title) {
    let element = document.createElement("button");
    element.className = className;
    if (title) element.title = title;
    return element;
}

function readOnlyInput(className, value) {
    let element = document.createElement("input");
    element.className = className;
    element.readOnly = true;
    element.value = value;
    element.title = value;
    return element;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// Creates an <svg> element that renders a symbol from icons.svg
function makeSvg(iconId) {
    let svgElement = document.createElementNS(SVG_NAMESPACE, "svg");
    let useElement = document.createElementNS(SVG_NAMESPACE, "use");
    useElement.setAttribute("href", "icons.svg#" + iconId);
    svgElement.appendChild(useElement);
    return svgElement;
}

// ---------------------------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------------------------

const entryList         = getById("entry_list");
const emptyState        = getById("empty_state");
const entryCount        = getById("entry_count");
const clearButton       = getById("clear");
const refreshButton     = getById("refresh");
const deduplicateButton = getById("deduplicate");
const searchInput       = getById("search_input");
const contextMenu       = getById("context_menu");

const contextMenuInsert      = getById("context_menu_insert");
const contextMenuCopyUrl     = getById("context_menu_copy_url");
const contextMenuCopyReferer = getById("context_menu_copy_referer");
const contextMenuExpand      = getById("context_menu_expand");
const contextMenuExpandText  = getById("context_menu_expand_text");
const contextMenuDelete      = getById("context_menu_delete");

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------

let allEntries = [];
let currentEntry = null;
let currentEntryEl = null;
let expandedEntryEl = null;

const DROPDOWN_REMOVE_DELAY = 300;
const COPY_FEEDBACK_DELAY = 1200;
const CONTEXT_MENU_WIDTH = 150;
const CONTEXT_MENU_HEIGHT = 160;

// ---------------------------------------------------------------------------------------------
// Media type classification
// ---------------------------------------------------------------------------------------------

const MEDIA_TYPES = {
    video:    ["mp4", "mov", "mkv", "webm", "avi", "mpeg", "m4v"],
    audio:    ["mp3", "mp2", "aac", "ogg", "m4a", "wav", "flac"],
    stream:   ["m3u8", "m3u", "mpd", "m4s"],
    subtitle: ["vtt", "srt", "txt"],
};

function getMediaTypeInfo(extension) {
    for (const [type, extensions] of Object.entries(MEDIA_TYPES)) {
        if (extensions.includes(extension)) {
            // iconKey must match a symbol id in icons.svg
            // "subtitle" maps to the "subtitles" symbol, "stream" maps to the "tv" symbol
            let iconKey = type;
            if (type === "subtitle") iconKey = "subtitles";
            if (type === "stream")   iconKey = "tv";
            return { type, iconKey };
        }
    }
    return { type: "link", iconKey: "link" };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    let time = "";
    if (seconds >= 3600) {
        let hours = (seconds / 3600) | 0;
        seconds %= 3600;
        time += hours + "h ";
    }
    if (seconds >= 60) {
        let minutes = (seconds / 60) | 0;
        seconds %= 60;
        time += minutes + "m ";
    }
    if (seconds > 0 || time === "") {
        seconds |= 0;
        time += seconds + "s ";
    }
    return time.trim() + " ago";
}

function extractFilename(url) {
    try {
        let parsed = new URL(url);
        let pathname = parsed.pathname;
        let parts = pathname.split("/");
        let last = parts[parts.length - 1];
        if (last) {
            last = last.split("?")[0];
            return decodeURIComponent(last);
        }
        return parsed.hostname;
    } catch {
        return url;
    }
}

// ---------------------------------------------------------------------------------------------
// Entry card creation
// ---------------------------------------------------------------------------------------------

function createEntryThumbnail(entry, mediaInfo) {
    let thumbnail = div("entry_thumbnail");
    thumbnail.title = "Insert into current tab";

    let typeIcon = makeSvg(mediaInfo.iconKey);
    typeIcon.classList.add("thumbnail_icon");
    thumbnail.appendChild(typeIcon);

    let playIcon = makeSvg("thumbnail_play");
    playIcon.classList.add("thumbnail_overlay");
    thumbnail.appendChild(playIcon);

    thumbnail.onclick = () => sendEntryToCurrentTab(entry);
    return thumbnail;
}

function createEntryInfo(entry) {
    let info = div("entry_info");

    let title = div("entry_title", extractFilename(entry.url));
    title.title = entry.url;
    info.appendChild(title);

    let subtitle = div("entry_subtitle");

    let badge = span("entry_extension_badge", entry.extension || "?");
    subtitle.appendChild(badge);

    let refererText = span("entry_subtitle_text", entry.referer || "No referer");
    refererText.title = entry.referer || "";
    subtitle.appendChild(refererText);

    info.appendChild(subtitle);
    return info;
}

function createEntryButtons(entry) {
    let buttons = div("entry_buttons");

    let copyButton = button("entry_button entry_copy_button", "Copy URL");
    copyButton.appendChild(makeSvg("copy"));
    copyButton.onclick = () => navigator.clipboard.writeText(entry.url);
    buttons.appendChild(copyButton);

    let deleteButton = button("entry_button entry_delete_button", "Delete entry");
    deleteButton.appendChild(makeSvg("delete"));
    deleteButton.onclick = () => deleteEntryById(entry.id);
    buttons.appendChild(deleteButton);

    return buttons;
}

function createEntryCard(entry) {
    let mediaInfo = getMediaTypeInfo(entry.extension);

    let card = div("entry type-" + mediaInfo.type);
    let top = div("entry_top");

    let thumbnail = createEntryThumbnail(entry, mediaInfo);
    top.appendChild(thumbnail);

    let info = createEntryInfo(entry);
    top.appendChild(info);

    let buttons = createEntryButtons(entry);
    top.appendChild(buttons);

    let dropdownButton = div("entry_dropdown_button");
    dropdownButton.title = "Show more info";
    dropdownButton.appendChild(makeSvg("dropdown"));
    dropdownButton.onclick = () => toggleExpand(card, entry);
    top.appendChild(dropdownButton);

    card.appendChild(top);
    card.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showContextMenu(event, card, entry);
    });

    return card;
}

// ---------------------------------------------------------------------------------------------
// Entry dropdown (expanded detail panel)
// ---------------------------------------------------------------------------------------------

function createDropdownCopyButton(label, value) {
    let copyButton = button("entry_dropdown_copy_button", "Copy " + label);
    copyButton.appendChild(makeSvg("copy"));
    copyButton.onclick = (event) => {
        event.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
            copyButton.classList.add("copied");
            copyButton.replaceChildren(makeSvg("accept"));
            setTimeout(() => {
                copyButton.classList.remove("copied");
                copyButton.replaceChildren(makeSvg("copy"));
            }, COPY_FEEDBACK_DELAY);
        });
    };
    return copyButton;
}

function createDropdownField(label, icon, value, copyable) {
    let field = div("entry_dropdown_field");

    let labelRow = div("entry_dropdown_field_label");

    let labelIcon = makeSvg(icon);
    labelIcon.classList.add("entry_dropdown_field_icon");
    labelRow.appendChild(labelIcon);

    let labelText = span(null, label);
    labelRow.appendChild(labelText);

    field.appendChild(labelRow);

    let valueRow = div("entry_dropdown_field_value");

    let valueInput = readOnlyInput("entry_dropdown_field_text", value);
    valueRow.appendChild(valueInput);

    if (copyable) {
        let copyButton = createDropdownCopyButton(label, value);
        valueRow.appendChild(copyButton);
    }

    field.appendChild(valueRow);
    return field;
}

function createDropdownMetaItem(label, icon, value, showInput) {
    let item = div("entry_dropdown_meta_item");

    let itemIcon = makeSvg(icon);
    itemIcon.classList.add("entry_dropdown_meta_icon");
    item.appendChild(itemIcon);

    let text = div("entry_dropdown_meta_text");

    let labelText = span("entry_dropdown_meta_label", label);
    text.appendChild(labelText);

    if (showInput) {
        let valueInput = readOnlyInput("entry_dropdown_meta_value", value);
        text.appendChild(valueInput);
    } else {
        let valueText = span("entry_dropdown_meta_value", value);
        valueText.title = value;
        text.appendChild(valueText);
    }

    item.appendChild(text);
    return item;
}

function createDropdownQualitiesRow(entry) {
    let metadata = entry.metadata;
    if (!metadata || !metadata.qualities || metadata.qualities.length === 0) {
        return null;
    }

    let row = div("entry_dropdown_qualities_row");

    let rowLabel = span("entry_dropdown_qualities_label", "Quality");
    row.appendChild(rowLabel);

    let badges = div("entry_dropdown_qualities");
    for (let quality of metadata.qualities) {
        let qualityBadge = span("entry_dropdown_quality_badge", quality);
        badges.appendChild(qualityBadge);
    }
    row.appendChild(badges);

    return row;
}

function createEntryDropdown(entry) {
    let dropdown = div("entry_dropdown");

    let urlField = createDropdownField("URL", "link", entry.url, true);
    dropdown.appendChild(urlField);

    if (entry.referer) {
        let refererField = createDropdownField("Referer", "link", entry.referer, true);
        dropdown.appendChild(refererField);
    }

    dropdown.appendChild(div("entry_dropdown_separator"));

    let metaRow = div("entry_dropdown_meta_row");

    if (entry.origin) {
        let originItem = createDropdownMetaItem("Origin", "link", entry.origin, true);
        metaRow.appendChild(originItem);
    }

    if (entry.extension) {
        let mediaInfo = getMediaTypeInfo(entry.extension);
        let typeLabel = entry.extension.toUpperCase();
        let typeItem = createDropdownMetaItem("Type", mediaInfo.iconKey, typeLabel, false);
        metaRow.appendChild(typeItem);
    }

    let secondsElapsed = Date.now() / 1000 - entry.time / 1000;
    let capturedItem = createDropdownMetaItem("Captured", "history", formatTime(secondsElapsed), false);
    metaRow.appendChild(capturedItem);

    let metaGrid = div("entry_dropdown_meta");
    metaGrid.appendChild(metaRow);
    dropdown.appendChild(metaGrid);

    let qualitiesRow = createDropdownQualitiesRow(entry);
    if (qualitiesRow) {
        dropdown.appendChild(div("entry_dropdown_separator"));
        dropdown.appendChild(qualitiesRow);
    }

    return dropdown;
}

// ---------------------------------------------------------------------------------------------
// Expand/collapse logic
// ---------------------------------------------------------------------------------------------

function toggleExpand(entryEl, entry) {
    if (expandedEntryEl && expandedEntryEl !== entryEl) {
        collapseEntry(expandedEntryEl);
    }

    if (entryEl.classList.contains("expand")) {
        collapseEntry(entryEl);
    } else {
        expandEntry(entryEl, entry);
    }
}

function expandEntry(entryEl, entry) {
    let dropdowns = entryEl.getElementsByClassName("entry_dropdown");
    entryEl.classList.add("expand");

    if (dropdowns.length === 0) {
        let dropdown = createEntryDropdown(entry);
        entryEl.appendChild(dropdown);
        // Reading offsetHeight forces a reflow, so the expand transition plays
        void dropdown.offsetHeight;
    }

    expandedEntryEl = entryEl;
}

function collapseEntry(entryEl) {
    entryEl.classList.remove("expand");

    setTimeout(() => {
        if (!entryEl.classList.contains("expand")) {
            let dropdowns = entryEl.getElementsByClassName("entry_dropdown");
            while (dropdowns.length > 0) {
                dropdowns[0].remove();
            }
        }
    }, DROPDOWN_REMOVE_DELAY);

    if (expandedEntryEl === entryEl) {
        expandedEntryEl = null;
    }
}

// ---------------------------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------------------------

function showContextMenu(event, entryEl, entry) {
    let x = event.pageX;
    let y = event.pageY;
    let bodyWidth = document.body.clientWidth;
    let bodyHeight = document.body.clientHeight;

    if (x + CONTEXT_MENU_WIDTH > bodyWidth) x = bodyWidth - CONTEXT_MENU_WIDTH - 4;
    if (y + CONTEXT_MENU_HEIGHT > bodyHeight) y = bodyHeight - CONTEXT_MENU_HEIGHT - 4;
    if (x < 0) x = 4;
    if (y < 0) y = 4;

    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";
    contextMenu.style.display = "flex";

    let isExpanded = entryEl.classList.contains("expand");
    contextMenuExpandText.textContent = isExpanded ? "Collapse" : "Expand";
    contextMenuExpand.classList.toggle("expanded", isExpanded);

    currentEntry = entry;
    currentEntryEl = entryEl;
}

function hideContextMenu() {
    contextMenu.style.display = "none";
    currentEntry = null;
    currentEntryEl = null;
}

function attachContextMenuLogic() {
    document.addEventListener("click", () => hideContextMenu());
    document.addEventListener("contextmenu", (event) => {
        if (!event.target.closest(".entry")) {
            hideContextMenu();
        }
    });

    contextMenuInsert.onclick = () => {
        if (currentEntry) sendEntryToCurrentTab(currentEntry);
        hideContextMenu();
    };

    contextMenuCopyUrl.onclick = () => {
        if (currentEntry) navigator.clipboard.writeText(currentEntry.url);
        hideContextMenu();
    };

    contextMenuCopyReferer.onclick = () => {
        if (currentEntry && currentEntry.referer) {
            navigator.clipboard.writeText(currentEntry.referer);
        }
        hideContextMenu();
    };

    contextMenuExpand.onclick = () => {
        if (currentEntry && currentEntryEl) {
            toggleExpand(currentEntryEl, currentEntry);
        }
        hideContextMenu();
    };

    contextMenuDelete.onclick = () => {
        if (currentEntry) deleteEntryById(currentEntry.id);
        hideContextMenu();
    };

    contextMenu.oncontextmenu = (event) => {
        event.preventDefault();
        hideContextMenu();
    };
}

// ---------------------------------------------------------------------------------------------
// Search filtering
// ---------------------------------------------------------------------------------------------

function updateSearchResults() {
    let search = searchInput.value.trim().toLowerCase();
    let cards = entryList.getElementsByClassName("entry");
    let visibleCount = 0;

    // allEntries is chronological (oldest first); DOM cards are reversed (newest first)
    for (let i = 0; i < cards.length; i++) {
        let card = cards[i];
        let entry = allEntries[allEntries.length - 1 - i];
        if (!entry) continue;

        if (search === "") {
            card.classList.remove("hide");
            visibleCount++;
        } else {
            let url = (entry.url || "").toLowerCase();
            let referer = (entry.referer || "").toLowerCase();
            let extension = (entry.extension || "").toLowerCase();
            let matches = url.includes(search) || referer.includes(search) || extension.includes(search);
            if (matches) {
                card.classList.remove("hide");
                visibleCount++;
            } else {
                card.classList.add("hide");
            }
        }
    }

    updateEmptyState(visibleCount === 0 && allEntries.length === 0);
}

// ---------------------------------------------------------------------------------------------
// List management
// ---------------------------------------------------------------------------------------------

function updateEmptyState(isEmpty) {
    if (isEmpty) {
        emptyState.classList.remove("hide");
    } else {
        emptyState.classList.add("hide");
    }
}

function updateEntryCount(count) {
    entryCount.textContent = count;
}

function clearEntryList() {
    while (entryList.firstChild) {
        entryList.removeChild(entryList.firstChild);
    }
    expandedEntryEl = null;
}

function populateEntries(entries) {
    allEntries = entries;
    clearEntryList();

    if (entries.length === 0) {
        updateEmptyState(true);
        updateEntryCount(0);
        return;
    }

    updateEmptyState(false);

    // Display newest-first (background stores chronologically, oldest first)
    for (let i = entries.length - 1; i >= 0; i--) {
        let card = createEntryCard(entries[i]);
        entryList.appendChild(card);
    }

    updateEntryCount(entries.length);

    if (searchInput.value.trim() !== "") {
        updateSearchResults();
    }
}

// ---------------------------------------------------------------------------------------------
// Background message handlers
// ---------------------------------------------------------------------------------------------

const GET_ENTRIES         = "get_entries";
const CLEAR_ENTRIES       = "clear_entries";
const INSERT_ENTRIES      = "insert_entries";
const DEDUPLICATE_ENTRIES = "deduplicate_entries";
const DELETE_ENTRY        = "delete_entry";

function clearEntries() {
    browser.runtime.sendMessage({type: CLEAR_ENTRIES});
    allEntries = [];
    clearEntryList();
    updateEmptyState(true);
    updateEntryCount(0);
}

function getEntries() {
    browser.runtime.sendMessage({type: GET_ENTRIES}, (response) => {
        if (!response || !response.entries) {
            updateEmptyState(true);
            updateEntryCount(0);
            return;
        }
        populateEntries(response.entries);
    });
}

function deduplicateEntries() {
    browser.runtime.sendMessage({type: DEDUPLICATE_ENTRIES}, (response) => {
        if (!response || !response.entries) {
            return;
        }
        populateEntries(response.entries);
    });
}

function deleteEntryById(id) {
    browser.runtime.sendMessage({type: DELETE_ENTRY, id: id}, (response) => {
        if (!response) return;
        let cards = entryList.getElementsByClassName("entry");
        // Background returns index in chronological order; display is reversed
        let visualIndex = allEntries.length - 1 - response.index;
        if (visualIndex >= 0 && visualIndex < cards.length) {
            let card = cards[visualIndex];
            if (expandedEntryEl === card) {
                expandedEntryEl = null;
            }
            card.remove();
        }
        allEntries.splice(response.index, 1);
        updateEntryCount(allEntries.length);
        if (allEntries.length === 0) {
            updateEmptyState(true);
        }
    });
}

function sendEntryToCurrentTab(entry) {
    browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
        if (!tabs || tabs.length === 0) return;
        let activeTab = tabs[0];
        browser.tabs.sendMessage(activeTab.id, {type: INSERT_ENTRIES, entry: entry});
    });
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

function main() {
    clearButton.onclick = clearEntries;
    refreshButton.onclick = getEntries;
    deduplicateButton.onclick = deduplicateEntries;
    searchInput.oninput = updateSearchResults;

    attachContextMenuLogic();
    getEntries();
}

main();
