const elements = new Map();

os.registerSyscall("dom.create", (proc, id, tag) => {
    const element = document.createElement(tag);

    if (!elements.has(proc)) elements.set(proc, new Map());
    elements.get(proc).set(id, element);

    proc.onclose(() => elements.get(proc).delete(id));
});

os.registerSyscall("dom.append", (proc, id, childId) => {
    const element = elements.get(proc).get(id);
    const child = elements.get(proc).get(childId);

    element.append(child);
    // proc.keepAlive(() => element.removeChild(child));
    proc.onclose(() => {
        // child.remove()
        elements.get(proc).delete(childId);
        if (elements.get(proc).size == 0) elements.delete(proc);
    });
});

os.registerSyscall(
    "dom.prop",
    (proc, id, prop, value) => (elements.get(proc).get(id)[prop] = value),
);

os.registerSyscall("dom.attr", (proc, id, attr, value) =>
    elements.get(proc).get(id).setAttribute(attr, value),
);

os.registerSyscall("dom.css", (proc, id, prop, value) =>
    elements.get(proc).get(id).style.setProperty(prop, value),
);

os.gui = {
    elements: elements,
};

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
