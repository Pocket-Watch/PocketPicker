# Best coding practices

## General guidance
Before writing any code, read all relevant files and understand the existing patterns - your changes must blend in with the surrounding codebase.
If the change is large or introduces a new pattern, **PAUSE and ask the user for confirmation** before proceeding.
When a task requires changes, present your proposed solution first or ask for clarification before proceeding.
If you believe the request cannot be fulfilled, explain why.
Don’t default to hacky workarounds just to force a result.


1. Avoid use of en dash or em dash, use hyphen.
2. Never manually execute `git` or `gh` commands without confirmation.
3. Don't create random scripts unless explicitly asked.
4. Don't try to run the program or run tests unless explicitly asked.
5. When asked to verify a code path read the code and analyze instead of executing the program.
6. Use clean, descriptive, self-explanatory function and variable names (prefer camelCase). Watch out for JSON fields which are usually snake_case.
7. Prefer native tooling for reading, writing, editing files rather than using `cat` or `sed`.
8. After completing a bug fix or feature implementation, suggest a concise commit message the user could use.
9. Never introduce new dependencies without explicit user approval. If a dependency is required, justify its necessity over standard library solutions.
10. Use only printable ASCII characters in source-code comments.

## Code Documentation Guidelines

### Comment Only When Necessary

Write comments only when code is **vague, counterintuitive, or implements unexpected behavior**.
Do not comment routine logic, function signatures, or branches already explained by a header comment.
Do no write inline comments for individual statements or conditions.

### Derive from Logic Alone
Comments must reflect **what the code actually does**, not what someone claims it does or what the conversation suggested.

### Document Code Behavior, Not History

Don't explain why a choice was made unless the code itself would otherwise appear buggy or incorrect.
Never narrate how the code came to be:
- Don't say "this was a bug that was fixed by..."
- Don't say "this handles an edge case where..."
- Don't justify past decisions

Document **what the code does** based on its logic alone—completely independent of conversation context or implementation history.

### Keep Comments Concise

- One or two sentences maximum
- No bloat
- No essays
- If it needs extensive explanation, refactor the code instead

## JavaScript practices
### Use Descriptive Functions Over Large Anonymous Declarations
**Why**: Readability and maintainability. Large anonymous data structures are harder to understand and modify.

Avoid:
```js
let animals = [
  { label: "cat", icon: "icons.svg/cat", age: "3" },
  { label: "dog", icon: "icons.svg/dog", age: "6" }
]
```
Prefer:
```js
function newAnimal(label, icon, age) {
  return { label, icon, age };
}

let entries = [
  newEntry("cat", "icons.svg/2321", "2321"),
  newEntry("dog", "icons.svg/4521", "4521")
];
```

Use a class when multiple functions must interact with the structure:
```js
class Agent {
   constructor(label, icon, type, timeout = 5000, retries = 3) {
      this.label = label;
      this.icon = icon;
      this.type = type;
      this.timeout = timeout;
      this.retries = retries;
   }

   shouldRetry(attemptNumber) {
      return attemptNumber < this.retries;
   }
}

const agents = [
   new Agent("Claude", "🤖", "ai"),
   new Agent("Tool", "🔧", "tool", 3000, 1)
];
```

### Use Helper Functions for DOM Queries and Creation

**Why**: Reduces boilerplate, centralizes cross-browser compatibility, and makes refactoring easier.

Avoid:
```js
let div = document.createElement("div");
div.id = "main";
div.className = "container";
```

Prefer:
```js
function div(id, className) {
  let element = document.createElement("div");
  if (id) element.id = id;
  if (className) element.className = className;
  return element;
}

let container = div("main", "container");
```

Similarly, replace `document.getElementById()` with `getById()`.

### Avoid Recently Released JS/CSS Features Without Compatibility Checks

**Why**: Ensures your code works across supported browsers and environments.

Best Practice: Check for feature support before using newer APIs:
```js
if (!window.AudioContext) {
  console.warn("AudioContext not supported");
  return;
}
// Use the feature safely
const audioContext = new window.AudioContext();
```
Use Mozilla's compatibility tables (example: https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event#browser_compatibility) 
or check the **Can I Use** database when in doubt.

### Avoid Large Blocks of Code - Extract Into Functions

**Why**: Large blocks of repetitive code are hard to read, debug, and maintain. 
Extracting into well-named functions improves readability, saves review time and prevents duplicate logic.

Bad - verbose and repetitive:

```js
const menu = document.createElement("div");
menu.className = "menu";

const copyButton = document.createElement("button");
copyButton.className = "button copy_button";
copyButton.title = "Copy";

const deleteBtn = document.createElement("button");
deleteBtn.className = "button delete_button";
deleteBtn.title = "Delete";

buttons.appendChild(copyButton);
buttons.appendChild(deleteBtn);

const info = document.createElement("div");
info.className = "info";

const title = document.createElement("div");
title.className = "title";
title.textContent = extractFilename(file.url);
title.title = file.url;

view.appendChild(menu);
view.appendChild(info);
```

Good - clean and composable:
```js
function button(className, title) {
   let btn = document.createElement("button");
   btn.className = className;
   btn.title = title;
   return btn;
}

function div(className, textContent) {
   let el = document.createElement("div");
   el.className = className;
   if (textContent) el.textContent = textContent;
   return el;
}

function buildMenu() {
   let menu = div("menu");
   menu.appendChild(button("button copy_button", "Copy"));
   menu.appendChild(button("button delete_button", "Delete"));
   return menu;
}

function buildFileView(file) {
   let info = div("info")
   let title = div("title", extractFilename(file.url));
   title.title = file.url;
   info.appendChild(title);
   return info;
}

// Now simply compose
view.appendChild(buildMenu());
view.appendChild(buildFileView(file));
```


### Avoid Complex or Functional Ternary Statements - Use If Statements Instead
**Why**: Ternary operators are meant for simple, readable assignments. 
Complex logic in ternaries reduces readability and makes debugging or modifications harder.

Good:
```js
div.className = toggled ? "show" : "hide";
```

Bad
```js
div.className = toggled ? textContent.slice(CUT_OFF_POINT) : document.getElementById("header").innerText; 
```

Alternatively extract into a function for reusability:
```js
function getClassName(toggled, textContent) {
  if (toggled) {
    return textContent.slice(CUT_OFF_POINT);
  }
  return document.getElementById("header").innerText;
}
```


