// ===========================================================================================
// PocketPicker - Foreground popup logic
// Card-based entry layout matching PocketWatch playlist/history style
// ===========================================================================================

if (typeof browser === "undefined") {
    browser = chrome;
}

console.log("FOREGROUND RUNNING!")

// ---------------------------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------------------------

const entryList         = document.getElementById("entry_list");
const emptyState        = document.getElementById("empty_state");
const entryCount        = document.getElementById("entry_count");
const clearButton       = document.getElementById("clear");
const refreshButton     = document.getElementById("refresh");
const deduplicateButton = document.getElementById("deduplicate");
const searchInput       = document.getElementById("search_input");
const contextMenu       = document.getElementById("context_menu");

const contextMenuInsert      = document.getElementById("context_menu_insert");
const contextMenuCopyUrl     = document.getElementById("context_menu_copy_url");
const contextMenuCopyReferer  = document.getElementById("context_menu_copy_referer");
const contextMenuExpand       = document.getElementById("context_menu_expand");
const contextMenuExpandText   = document.getElementById("context_menu_expand_text");
const contextMenuDelete       = document.getElementById("context_menu_delete");

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------

let allEntries = [];
let currentEntry = null;
let currentEntryEl = null;
let expandedEntryEl = null;

const DROPDOWN_REMOVE_DELAY = 300;

// ---------------------------------------------------------------------------------------------
// SVG helper — creates an <svg><use href="icons.svg#..."/></svg> element
// This mirrors PocketWatch's approach: <svg><use href="svg/main_icons.svg#play"/></svg>
// ---------------------------------------------------------------------------------------------

function makeSvg(iconId) {
    let svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    let useEl = document.createElementNS("http://www.w3.org/2000/svg", "use");
    useEl.setAttribute("href", "icons.svg#" + iconId);
    svgEl.appendChild(useEl);
    return svgEl;
}

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
    for (const [type, exts] of Object.entries(MEDIA_TYPES)) {
        if (exts.includes(extension)) {
            // iconKey must match the symbol id in icons.svg
            // ("subtitle" type maps to "subtitles" symbol, "stream" type maps to "tv" symbol)
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

function createEntryCard(entry) {
    let entryEl = document.createElement("div");
    let mediaInfo = getMediaTypeInfo(entry.extension);
    entryEl.className = "entry type-" + mediaInfo.type;

    let top = document.createElement("div");
    top.className = "entry_top";

    // Thumbnail with media-type icon + hover play overlay
    let thumbnail = document.createElement("div");
    thumbnail.className = "entry_thumbnail";
    thumbnail.title = "Insert into current tab";

    let iconSvg = makeSvg(mediaInfo.iconKey);
    iconSvg.classList.add("thumbnail_icon");

    let playSvg = makeSvg("thumbnail_play");
    playSvg.classList.add("thumbnail_overlay");

    thumbnail.appendChild(iconSvg);
    thumbnail.appendChild(playSvg);

    // Info: title (filename) + subtitle (extension badge + referer)
    let info = document.createElement("div");
    info.className = "entry_info";

    let title = document.createElement("div");
    title.className = "entry_title";
    title.textContent = extractFilename(entry.url);
    title.title = entry.url;

    let subtitle = document.createElement("div");
    subtitle.className = "entry_subtitle";

    let badge = document.createElement("span");
    badge.className = "entry_extension_badge";
    badge.textContent = entry.extension || "?";

    let subtitleText = document.createElement("span");
    subtitleText.className = "entry_subtitle_text";
    subtitleText.textContent = entry.referer || "No referer";
    subtitleText.title = entry.referer || "";

    subtitle.appendChild(badge);
    subtitle.appendChild(subtitleText);

    info.appendChild(title);
    info.appendChild(subtitle);

    // Hover-revealed action buttons: copy URL + delete
    let buttons = document.createElement("div");
    buttons.className = "entry_buttons";

    let copyBtn = document.createElement("button");
    copyBtn.className = "entry_button entry_copy_button";
    copyBtn.title = "Copy URL";
    copyBtn.appendChild(makeSvg("copy"));

    let deleteBtn = document.createElement("button");
    deleteBtn.className = "entry_button entry_delete_button";
    deleteBtn.title = "Delete entry";
    deleteBtn.appendChild(makeSvg("delete"));

    buttons.appendChild(copyBtn);
    buttons.appendChild(deleteBtn);

    // Dropdown toggle button
    let dropdownBtn = document.createElement("div");
    dropdownBtn.className = "entry_dropdown_button";
    dropdownBtn.title = "Show more info";
    dropdownBtn.appendChild(makeSvg("dropdown"));

    top.appendChild(thumbnail);
    top.appendChild(info);
    top.appendChild(buttons);
    top.appendChild(dropdownBtn);
    entryEl.appendChild(top);

    // Event handlers
    thumbnail.onclick = () => sendEntryToCurrentTab(entry);
    copyBtn.onclick = () => navigator.clipboard.writeText(entry.url);
    deleteBtn.onclick = () => deleteEntryById(entry.id);
    dropdownBtn.onclick = () => toggleExpand(entryEl, entry);

    entryEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e, entryEl, entry);
    });

    return entryEl;
}

// ---------------------------------------------------------------------------------------------
// Entry dropdown (expanded detail panel)
// ---------------------------------------------------------------------------------------------

function createEntryDropdown(entry) {
    let dropdown = document.createElement("div");
    dropdown.className = "entry_dropdown";

    let secondsElapsed = Date.now() / 1000 - entry.time / 1000;
    let timeStr = formatTime(secondsElapsed);
    let mediaInfo = getMediaTypeInfo(entry.extension);

    // --- Section: Link info (URL + Referer) ---

    let linkFields = [
        { label: "URL",     value: entry.url,             icon: "link", copy: true },
        { label: "Referer", value: entry.referer || "N/A", icon: "link", copy: entry.referer != null },
    ];

    for (let field of linkFields) {
        if (field.value === "N/A" && !field.copy) continue;
        let fieldEl = document.createElement("div");
        fieldEl.className = "entry_dropdown_field";

        let labelRow = document.createElement("div");
        labelRow.className = "entry_dropdown_field_label";

        let labelIcon = makeSvg(field.icon);
        labelIcon.classList.add("entry_dropdown_field_icon");
        labelRow.appendChild(labelIcon);

        let labelText = document.createElement("span");
        labelText.textContent = field.label;
        labelRow.appendChild(labelText);

        fieldEl.appendChild(labelRow);

        let valueRow = document.createElement("div");
        valueRow.className = "entry_dropdown_field_value";

        let valueText = document.createElement("input");
        valueText.className = "entry_dropdown_field_text";
        valueText.readOnly = true;
        valueText.value = field.value;
        valueText.title = field.value;
        valueRow.appendChild(valueText);

        if (field.copy && field.value !== "N/A") {
            let copyBtn = document.createElement("button");
            copyBtn.className = "entry_dropdown_copy_button";
            copyBtn.title = "Copy " + field.label;
            copyBtn.appendChild(makeSvg("copy"));
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(field.value).then(() => {
                    copyBtn.classList.add("copied");
                    copyBtn.innerHTML = "";
                    copyBtn.appendChild(makeSvg("accept"));
                    setTimeout(() => {
                        copyBtn.classList.remove("copied");
                        copyBtn.innerHTML = "";
                        copyBtn.appendChild(makeSvg("copy"));
                    }, 1200);
                });
            };
            valueRow.appendChild(copyBtn);
        }

        fieldEl.appendChild(valueRow);
        dropdown.appendChild(fieldEl);
    }

    // --- Separator ---

    let sep = document.createElement("div");
    sep.className = "entry_dropdown_separator";
    dropdown.appendChild(sep);

    // --- Section: Metadata (Origin, Type, Captured on a single row) ---

    let metaFields = [
        { label: "Origin",   value: entry.origin || "N/A",                              icon: "link",   input: true },
        { label: "Type",     value: entry.extension ? entry.extension.toUpperCase() : "Unknown", icon: mediaInfo.iconKey },
        { label: "Captured", value: timeStr,                                            icon: "history" },
    ];

    let metaGrid = document.createElement("div");
    metaGrid.className = "entry_dropdown_meta";

    let metaRow = document.createElement("div");
    metaRow.className = "entry_dropdown_meta_row";

    for (let meta of metaFields) {
        let metaItem = document.createElement("div");
        metaItem.className = "entry_dropdown_meta_item";

        let metaIcon = makeSvg(meta.icon);
        metaIcon.classList.add("entry_dropdown_meta_icon");
        metaItem.appendChild(metaIcon);

        let metaText = document.createElement("div");
        metaText.className = "entry_dropdown_meta_text";

        let metaLabel = document.createElement("span");
        metaLabel.className = "entry_dropdown_meta_label";
        metaLabel.textContent = meta.label;
        metaText.appendChild(metaLabel);

        if (meta.input) {
            let metaValue = document.createElement("input");
            metaValue.className = "entry_dropdown_meta_value";
            metaValue.readOnly = true;
            metaValue.value = meta.value;
            metaValue.title = meta.value;
            metaText.appendChild(metaValue);
        } else {
            let metaValue = document.createElement("span");
            metaValue.className = "entry_dropdown_meta_value";
            metaValue.textContent = meta.value;
            metaValue.title = meta.value;
            metaText.appendChild(metaValue);
        }

        metaItem.appendChild(metaText);
        metaRow.appendChild(metaItem);
    }

    metaGrid.appendChild(metaRow);
    dropdown.appendChild(metaGrid);

    // --- Section: Quality badges (if available) ---

    if (entry.metadata && entry.metadata.qualities && entry.metadata.qualities.length > 0) {
        let qualSep = document.createElement("div");
        qualSep.className = "entry_dropdown_separator";
        dropdown.appendChild(qualSep);

        let qualRow = document.createElement("div");
        qualRow.className = "entry_dropdown_qualities_row";

        let qualLabel = document.createElement("span");
        qualLabel.className = "entry_dropdown_qualities_label";
        qualLabel.textContent = "Quality";
        qualRow.appendChild(qualLabel);

        let qualitiesWrap = document.createElement("div");
        qualitiesWrap.className = "entry_dropdown_qualities";

        for (let q of entry.metadata.qualities) {
            let qBadge = document.createElement("span");
            qBadge.className = "entry_dropdown_quality_badge";
            qBadge.textContent = q;
            qualitiesWrap.appendChild(qBadge);
        }

        qualRow.appendChild(qualitiesWrap);
        dropdown.appendChild(qualRow);
    }

    return dropdown;
}

// ---------------------------------------------------------------------------------------------
// Expand / collapse logic
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
    let menuWidth = 150;
    let menuHeight = 160;
    let bodyWidth = document.body.clientWidth;
    let bodyHeight = document.body.clientHeight;

    if (x + menuWidth > bodyWidth) x = bodyWidth - menuWidth - 4;
    if (y + menuHeight > bodyHeight) y = bodyHeight - menuHeight - 4;
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
    document.addEventListener("contextmenu", (e) => {
        if (!e.target.closest(".entry")) {
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
            let ext = (entry.extension || "").toLowerCase();
            if (url.includes(search) || referer.includes(search) || ext.includes(search)) {
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