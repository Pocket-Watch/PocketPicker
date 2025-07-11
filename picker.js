// Needs testing on Chromium
if (typeof browser === "undefined") {
    browser = chrome;
}

console.log("FOREGROUND RUNNING!")

const entriesTable = document.getElementById("entries");
const clearButton = document.getElementById("clear");
const refreshButton = document.getElementById("refresh");
const deduplicateButton = document.getElementById("deduplicate");
const contextMenu = document.getElementById("context_menu");

function hideIfShown(element) {
    if (element.style.display !== "none") {
        element.style.display = "none";
    }
}

function attachContextMenuLogic() {
    document.addEventListener("click", _ => {
        hideIfShown(contextMenu);
    })

    document.addEventListener("contextmenu", _ => {
        hideIfShown(contextMenu);
    })

    let insertButton = contextMenu.querySelector('#context_menu_insert');
    insertButton.addEventListener("click", _ => {
        console.info("Sending", currentEntry, "to current tab")
        sendEntryToCurrentTab(currentEntry)
    })
    let deleteButton = contextMenu.querySelector('#context_menu_delete');
    deleteButton.addEventListener("click", _ => {
        console.info("Deleting", currentEntry)
        deleteEntryById(currentEntry.id)
    })
}

let currentEntry = null;

function attachContextMenu(element, entry) {
    element.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.display = 'block';
        currentEntry = entry;
    });
}

function createTableRow(entry) {
    let tableRow = document.createElement("tr");
    attachContextMenu(tableRow, entry);
    let urlData = createTdWithInput(entry.url);
    let refererData = createTdWithInput(entry.referer)
    let extensionData = createTdWithInput(entry.extension)
    let secondsElapsed = Date.now() / 1000 - entry.time / 1000;
    let timeData = createTdWithInput(formatTime(secondsElapsed))

    tableRow.append(urlData, refererData, extensionData, timeData)
    // insertAfter doesn't exist so there's goofy, this basically inserts entries after table header
    let secondChild = entriesTable.firstElementChild.nextSibling;
    if (secondChild) {
        entriesTable.insertBefore(tableRow, secondChild);
    } else {
        entriesTable.appendChild(tableRow);
    }

}

function formatTime(seconds) {
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

    if (seconds > 0) {
        seconds |= 0;
        time += seconds + "s ";
    }
    time += " ago";
    return time;
}

function createTdWithInput(content) {
    let td = document.createElement("td");
    let input = document.createElement("input");
    input.value = content;
    input.readOnly = true;
    input.className = "cell"
    td.appendChild(input);
    return td;
}

const GET_ENTRIES = "get_entries";
const CLEAR_ENTRIES = "clear_entries";
const INSERT_ENTRIES = "insert_entries";
const DEDUPLICATE_ENTRIES = "deduplicate_entries";
const DELETE_ENTRY = "delete_entry";

function clearEntries() {
    browser.runtime.sendMessage({type: CLEAR_ENTRIES});
    clearTable();
}

function getEntries() {
    clearTable();
    browser.runtime.sendMessage({type: GET_ENTRIES}, (response) => {
        let entries = response.entries;
        if (entries.length === 0) {
            return;
        }
        console.log("Background responded with entries:", entries);
        for (let i = 0; i < entries.length; i++) {
            createTableRow(entries[i])
        }
    });
}

function deduplicateEntries() {
    clearTable();
    browser.runtime.sendMessage({type: DEDUPLICATE_ENTRIES}, (response) => {
        let entries = response.entries;
        if (entries.length === 0) {
            return;
        }
        console.log("Background responded with deduplicated entries:", entries);
        for (let i = 0; i < entries.length; i++) {
            createTableRow(entries[i])
        }
    });
}

function deleteEntryById(id) {
    browser.runtime.sendMessage({type: DELETE_ENTRY, id: id}, (response) => {
        console.log("Received index: ", response.index)
        deleteRowAt(response.index, true)
    });
}

function sendEntryToCurrentTab(entry) {
    // When a message is sent to a content script it must be sent through tabs.sendMessage()
    // This will send to current tab anyway
    browser.tabs.query({active: true, currentWindow: true}, function (tabs) {
        let activeTab = tabs[0];
        browser.tabs.sendMessage(activeTab.id, {type: INSERT_ENTRIES, entry: entry});
    })
}

function clearTable() {
    // It is a live collection so it updates as you delete, and it gets angry
    // if you don't use - deleteRow(index), so removeChild() doesn't work
    let rows = entriesTable.getElementsByTagName("tr");
    while (rows.length > 1) {
        entriesTable.deleteRow(rows.length - 1);
    }
}

function deleteRowAt(index, reversed) {
    let rows = entriesTable.getElementsByTagName("tr");
    if (index >= rows.length) {
        return
    }
    if (reversed) {
        index = rows.length-1 - index;
    } else {
        index++;
    }
    entriesTable.deleteRow(index);
}

function main() {
    clearButton.onclick = clearEntries;
    refreshButton.onclick = getEntries;
    deduplicateButton.onclick = deduplicateEntries;
    getEntries()

    // This is a test entry to preview table formatting
    /*createTableRow(new Entry(
        "https://LONG-TEST-ENTRY-URL-TABLE-ROW/ROWS-ENTRY/domain",
        "Origin", "Referer"
    ))*/

    attachContextMenuLogic()
}

// Entry definition mirror
class Entry {
    constructor(url, origin, referer, tabId) {
        this.time = Date.now();
        this.url = url;
        this.origin = origin;
        this.referer = referer;
        this.tabId = tabId;
        this.extension = "";
        this.metadata = null;
        this.id = -1;
    }
}

main();