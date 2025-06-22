class Element {
    static #id = 0;
    static #deleted = [];

    constructor(tag) {
        if (Element.#deleted.length) this._id = Element.#deleted.shift();
        else this._id = Element.#id++;

        syscall("dom.create", this._id, tag);
    }

    css(prop, val) {
        syscall("dom.css", this._id, prop, val);
    }

    set text(str) {
        syscall("dom.prop", this._id, "innerText", str);
    }

    append(ele) {
        syscall("dom.append", this._id, ele._id);
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

exports.Window = Window
exports.Element = Element
exports.FlexBox = FlexBox
