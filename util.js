// ===========================================================================================
// PocketPicker - Shared helpers
// ===========================================================================================

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** @param {string} varName @param {string} [unitStrip] @returns {number} */
export function getCssNumber(varName, unitStrip = "") {
    const rootStyle = getComputedStyle(document.documentElement);
    const property = rootStyle.getPropertyValue(varName);
    const stripped = property.trim().replace(unitStrip, "");
    return Number(stripped);
}

/** @param {string} id @returns {HTMLElement} */
export function getById(id) {
    let element = document.getElementById(id);
    if (!element) {
        console.error("ERROR: The element is with id =", id, "is missing!");
    }

    return element;
}

/** @param {HTMLElement} element */
export function show(element) {
    element.classList.add("show");
    element.classList.remove("hide");
}

/** @param {HTMLElement} element */
export function hide(element) {
    element.classList.add("hide");
    element.classList.remove("show");
}

/** @param {HTMLElement} element */
export function clearContent(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/** @param {string} className @param {string} [textContent] */
export function div(className, textContent) {
    let element = document.createElement("div");
    if (className) {
        element.className = className;
    }

    element.textContent = textContent;
    return element;
}

/** @param {string} className @param {string} [textContent] */
export function span(className, textContent) {
    let element = document.createElement("span");
    if (className) {
        element.className = className;
    }

    element.textContent = textContent;
    return element;
}

/** @param {string} className @param {string} [title] */
export function button(className, title = "") {
    let element = document.createElement("button");
    element.className = className;
    element.title = title;
    return element;
}

/** @param {string} className @param {string} value */
export function readOnlyInput(className, value) {
    let element = document.createElement("input");
    element.className = className;
    element.readOnly = true;
    element.value = value;
    element.title = value;
    return element;
}

// PocketPicker renders all icons from a single sprite, so the file reference is prepended.
/** @param {string} iconId @returns {SVGElement} */
export function makeSvg(iconId) {
    let svgElement = document.createElementNS(SVG_NAMESPACE, "svg");
    let useElement = document.createElementNS(SVG_NAMESPACE, "use");
    useElement.setAttribute("href", "icons.svg#" + iconId);
    svgElement.appendChild(useElement);
    return svgElement;
}

const TIME_UNITS = [
    { name: "year",   seconds: 3600 * 24 * 365 },
    { name: "day",    seconds: 3600 * 24       },
    { name: "hour",   seconds: 3600            },
    { name: "minute", seconds: 60              },
];

/** @param {Date} date @returns {string | null} */
export function getTimeAgo(date) {
    let diff = new Date().valueOf() - date.valueOf();
    let seconds = diff / 1000.0;

    for (let timeUnit of TIME_UNITS) {
        if (seconds >= timeUnit.seconds) {
            let unitName = timeUnit.name;
            let count = Math.floor(seconds / timeUnit.seconds);
            if (count >= 2) {
                unitName = unitName + "s";
            }
            return count + " " + unitName + " ago";
        }
    }

    if (seconds >= 3) {
        return (seconds | 0) + " seconds ago";
    }

    if (seconds >= 0) {
        return "now";
    }
    return null;
}
