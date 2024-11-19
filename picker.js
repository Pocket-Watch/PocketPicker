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

    let urlData = createTdWithDiv(entry.url);
    let refererData = createTdWithDiv(entry.referer)
    let originData = createTdWithDiv(entry.origin)
    let timeData = createTdWithDiv(entry.time)

    tableRow.append(urlData, refererData, originData, timeData)
    entriesTable.appendChild(tableRow)
}


function createTdWithDiv(content) {
    let td = document.createElement("td");
    let div = document.createElement("div");
    div.className = "scrollable"
    div.textContent = content;
    td.appendChild(div);
    return td;
}

function clearEntries() {
    browser.runtime.sendMessage({type: "clearEntries"});
    clearTable();
}

function getEntries() {
    clearTable();
    browser.runtime.sendMessage({type: "getEntries"}, (response) => {
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