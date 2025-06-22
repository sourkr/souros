const elements = new Map();

os.registerSyscall("element.create", (proc, id, tag) => {
    const element = document.createElement(tag);

    if (!elements.has(proc.id)) elements.set(proc.id, new Map());
    elements.get(proc.id).set(id, element);

    proc.onclose(() => elements.get(proc.id).delete(id));
});

os.registerSyscall("element.append", (proc, id, childId) => {
    const element = elements.get(proc.id).get(id);
    const child = elements.get(proc.id).get(childId);

    element.append(child);
    proc.keepAlive(() => element.removeChild(child));
});

os.registerSyscall(
    "element.prop",
    (proc, id, prop, value) => (elements.get(proc.id).get(id)[prop] = value),
);

os.registerSyscall("element.attr", (proc, id, attr, value) =>
    elements.get(proc.id).get(id).setAttribute(attr, value),
);

os.registerSyscall("element.css", (proc, id, prop, value) =>
    elements.get(proc.id).get(id).style.setProperty(prop, value),
);

function main() {
    new Desktop();
}

class Desktop {
    constructor() {
        this.display = document.createElement("div");
        this.desktop = document.createElement("div");

        this.display.id = "display";
        this.desktop.id = "desktop";

        this.display.append(this.desktop);
        document.body.append(this.display);

        this.#styles();
    }

    #styles() {
        document.body.style.padding = "0";
        document.body.style.margin = "0";
        document.body.style.overflow = "hidden";

        this.display.style.display = "flex";
        this.display.style.flexDirection = "column";
        this.display.style.overflow = "hidden";
        this.display.style.height = "100vh";
        this.display.style.width = "100vw";

        this.desktop.style.flexGrow = "1";
        this.desktop.style.position = "relative";
    }
}

main();
