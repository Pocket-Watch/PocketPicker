// Needs testing on Chromium
if (typeof browser === "undefined") {
    browser = chrome;
}

console.log("FOREGROUND RUNNING!")

const entriesTable = document.getElementById("entries");
const clearButton = document.getElementById("clear");
const refreshButton = document.getElementById("refresh");

function createTableRow(entry) {
    let tableRow = document.createElement("tr");

    let urlData = createTdWithInput(entry.url);
    let refererData = createTdWithInput(entry.referer)
    let originData = createTdWithInput(entry.origin)
    let secondsElapsed = Date.now() / 1000 - entry.time / 1000;
    let timeData = createTdWithInput(formatTime(secondsElapsed))

    tableRow.append(urlData, refererData, originData, timeData)
    entriesTable.appendChild(tableRow)
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

function clearTable() {
    // It is a live collection so it updates as you delete, and it gets angry
    // if you don't use - deleteRow(index), so removeChild() doesn't work
    let rows = entriesTable.getElementsByTagName("tr");
    while (rows.length > 1) {
        entriesTable.deleteRow(rows.length - 1);
    }
}

function main() {
    clearButton.onclick = clearEntries;
    refreshButton.onclick = getEntries;
    getEntries()

    // This is a test entry to preview table formatting
    /*createTableRow(new Entry(
        "https://LONG-TEST-ENTRY-URL-TABLE-ROW/ROWS-ENTRY/domain",
        "Origin", "Referer"
    ))*/
}

class Entry {
    constructor(url, origin, referer) {
        this.time = Date.now();
        this.url = url;
        this.origin = origin;
        this.referer = referer;
    }
}

main();