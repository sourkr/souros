const { svg } = await require("A:/apps/libs/image.js");

class Element {
    static #id = 0;
    static #deleted = [];

    #events = new Map();

    children = []

    constructor(tag) {
        if (Element.#deleted.length) this._id = Element.#deleted.shift();
        else this._id = Element.#id++;

        syscall("dom.create", this._id, tag);

        this.css("user-select", "none");
    }

    css(prop, val) {
        syscall("dom.css", this._id, prop, val);
    }

    set text(str) {
        syscall("dom.prop", this._id, "innerText", str);
    }

    append(ele) {
        if (ele.isDeleted) throw new Error("Cannot append deleted element");

        syscall("dom.append", this._id, ele._id);
        this.children.push(ele);
        ele.parent = this;
    }

    remove() {
        syscall("dom.remove", this._id);
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }

    delete() {
        syscall("dom.delete", this._id);
        Element.#deleted.push(this._id);
        this.#events.forEach((eventId) => deleteEvent(eventId));
        this.isDeleted = true;
        remove();
    }

    clear() {
        while(this.children.length) this.children[0].remove()
        // this.children.forEach((child) => child.remove());
    }

    on(event, callback) {
        const eventId = sysevent(callback);
        syscall("dom.on", this._id, event, eventId);
        this.#events.set(callback, eventId);
        return eventId;
    }

    off(event, eventId) {
        syscall("dom.off", this._id, event, eventId);
    }

    set size(dim) {
        this.css("width", dim);
        this.css("height", dim);
    }
}

class FlexBox extends Element {
    constructor(dir = "row") {
        super("div");
        this.css("display", "flex");
        this.css("flex-direction", dir);
        this.css("box-sizing", "border-box");
    }

    set gap(dim) {
        this.css("gap", dim);
    }
}

class Button extends Element {
    constructor(text) {
        super("button");
        this.text = text;
    }
}

class Image extends Element {
    constructor(src) {
        super("img");
    }

    set src(src) {
        if (src.endsWith(".svg")) {
            svg(src).then((src) => syscall("dom.attr", this._id, "src", src));
        } else {
            syscall("dom.attr", this._id, "src", src);
        }
    }
}

class ProgressBar extends Element {
    constructor(progress) {
        super("span");

        this.css("position", "relative");
        this.css("background", "hsl(200 100 85)");
        this.css("height", "20px");
        this.css("border-radius", "10px");
        this.css("width", "150px");
        this.css("overflow", "hidden");

        this.bar = new Element("span");
        this.bar.css("position", "absolute");
        this.bar.css("background", "hsl(200 100 50)");
        this.bar.css("height", "100%");
        this.bar.css("border-radius", "10px");
        this.bar.css("width", `${progress}%`);

        this.append(this.bar);
    }
}

class Input extends Element {
    constructor() {
        super("input");
    }
}

class TextArea extends Element {
    constructor() {
        super("textarea");
    }

    async val(str) {
        if (str) syscall("dom.prop", this._id, "value", str);
        else return await sysget("dom.prop", this._id, "value");
    }
}

class Window {
    static #id = 0;
    static #closed = [];

    #_id;

    constructor(tag) {
        if (Window.#closed.length) this.#_id = Window.#closed.shift();
        else this.#_id = Window.#id++;

        syscall("window.open", this.#_id);
    }

    set title(title) {
        syscall("window.title", this.#_id, title);
    }

    set content(ele) {
        syscall("window.content", this.#_id, ele._id);
    }
}

function hover(ele, intensity = 0.1) {
    ele.css("cursor", "pointer");
    ele.css("transition", "background .25s");

    ele.on("mouseover", () =>
        ele.css("background", `hsl(0 0 50 / ${intensity})`),
    );

    ele.on("mouseout", () => ele.css("background", "transparent"));
}

exports.Window = Window;
exports.Element = Element;

exports.FlexBox = FlexBox;
exports.Button = Button;
exports.Image = Image;
exports.ProgressBar = ProgressBar;
exports.Input = Input;
exports.TextArea = TextArea;

exports.hover = hover;
