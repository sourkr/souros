const { svg } = await require("A:/apps/libs/image.js");

class Element {
    static #id = 0;
    static #deleted = [];

    #events = new Map();

    children = [];

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
        this.children.forEach((child) => child.remove());
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

    size(dim) {
        this.css("width", dim);
        this.css("height", dim);
    }
}

class FlexBox extends Element {
    constructor(dir = "row") {
        super("div");
        this.css("display", "flex");
        this.css("flex-direction", dir);
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
            svg(src).then((src) => syscall("dom.attf", this._id, "src", src));
        }
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

exports.Window = Window;
exports.Element = Element;
exports.FlexBox = FlexBox;
exports.Button = Button;
