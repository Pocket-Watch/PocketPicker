function attachEvents() {
    console.log("Attaching events!")
    let search = document.getElementById("search");
    let i = 0;
    search.addEventListener("click", () => {
        let header = document.createElement("h1")
        header.textContent = "" + i++;
        document.body.appendChild(header)
    })
}

attachEvents();