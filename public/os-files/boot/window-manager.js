const { svg } = await require("A:/apps/libs/image.js");

const windows = new Map();

os.registerSyscall("window.open", (proc, id) => {
    if (!windows.has(proc)) windows.set(proc, new Map());
    windows.get(proc).set(id, new Window(proc, id));

    proc.keepAlive(close);
});

os.registerSyscall("window.close", close);

os.registerSyscall(
    "window.title",
    (proc, id, title) => (windows.get(proc).get(id).title.innerText = title),
);

os.registerSyscall("window.content", (proc, id, content) =>
    windows
        .get(proc)
        .get(id)
        .content.append(os.gui.elements.get(proc).get(content)),
);

function close(proc, id) {
    windows.get(proc).get(id).window.remove();
    windows.get(proc).delete(id);
    proc.kill();
}

let movingWindow = null;
let resizingWindow = null;

class Window {
    constructor(proc, id) {
        this.proc = proc;
        this.id = id;

        this.window = document.createElement("div");
        this.content = document.createElement("div");
        this.#titlebar();
        this.#resizeHandles();

        this.window.append(this.content);
        document.getElementById("desktop").append(this.window);

        this.#init();
        this.#style();
        this.#events();
    }

    async #init() {
        this.closeBtn.src = await svg("A:/apps/icons/close.svg");
    }

    close() {
        close(this.proc, this.id);
    }

    #style() {
        this.window.style.cssText = `
            position: absolute;
            width: 400px;
            height: 300px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 0 5px lightgray;
            border-radius: 10px;
            overflow: hidden;
        `;

        this.content.style.flex = "1";
        this.content.style.overflow = "auto";

        this.titlebar.style.cssText = `
            background: hsl(30 25 95);
            cursor: move;
            display: flex;
            align-items: center;
            height: 35px;
            user-select: none;
        `;

        this.title.style.cssText = `
            flex: 1;
            padding-left: 15px;
        `;

        this.closeBtn.style.cssText = `
            width: 55px;
            height: 35px;
            padding: 7.5px;
            box-sizing: border-box;
            cursor: pointer;
        `;

        // Style resize handles
        this.resizeHandles.se.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 10px;
            height: 10px;
            cursor: se-resize;
            background: transparent;
        `;

        this.resizeHandles.s.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 10px;
            right: 10px;
            height: 5px;
            cursor: s-resize;
            background: transparent;
        `;

        this.resizeHandles.e.style.cssText = `
            position: absolute;
            top: 35px;
            right: 0;
            bottom: 5px;
            width: 5px;
            cursor: e-resize;
            background: transparent;
        `;

        hover(this.closeBtn);
    }

    #events() {
        this.titlebar.onmousedown = (ev) => {
            movingWindow = {
                window: this.window,
                pos: Point2D.fromEvent(ev),
            };
        };

        this.closeBtn.onclick = () => close(this.proc, this.id);

        // Resize event listeners
        Object.keys(this.resizeHandles).forEach(direction => {
            this.resizeHandles[direction].onmousedown = (ev) => {
                ev.stopPropagation();
                const rect = this.window.getBoundingClientRect();
                resizingWindow = {
                    window: this.window,
                    direction: direction,
                    startPos: Point2D.fromEvent(ev),
                    startSize: { width: rect.width, height: rect.height },
                    startPosition: { x: rect.x, y: rect.y }
                };
            };
        });
    }

    #titlebar() {
        this.titlebar = document.createElement("div");
        this.title = document.createElement("div");
        this.closeBtn = document.createElement("img");

        this.titlebar.append(this.title, this.closeBtn);
        this.window.append(this.titlebar);
    }

    #resizeHandles() {
        this.resizeHandles = {
            se: document.createElement("div"), // bottom-right
            s: document.createElement("div"),  // bottom
            e: document.createElement("div"),  // right
        };

        // Style resize handles
        Object.keys(this.resizeHandles).forEach(direction => {
            const handle = this.resizeHandles[direction];
            handle.className = `resize-handle resize-${direction}`;
            this.window.append(handle);
        });
    }
}

window.onmousemove = (ev) => {
    if (movingWindow) {
        const pos = Point2D.fromEvent(ev);
        const delta = pos.subtract(movingWindow.pos);
        movingWindow.pos = pos;

        const rect = movingWindow.window.getBoundingClientRect();
        movingWindow.window.style.left = `${rect.x + delta.x}px`;
        movingWindow.window.style.top = `${rect.y + delta.y}px`;
    }
    
    if (resizingWindow) {
        const pos = Point2D.fromEvent(ev);
        const delta = pos.subtract(resizingWindow.startPos);
        const minWidth = 200;
        const minHeight = 150;

        switch (resizingWindow.direction) {
            case 'se': // bottom-right
                const newWidth = Math.max(minWidth, resizingWindow.startSize.width + delta.x);
                const newHeight = Math.max(minHeight, resizingWindow.startSize.height + delta.y);
                resizingWindow.window.style.width = `${newWidth}px`;
                resizingWindow.window.style.height = `${newHeight}px`;
                break;
            case 's': // bottom
                const heightS = Math.max(minHeight, resizingWindow.startSize.height + delta.y);
                resizingWindow.window.style.height = `${heightS}px`;
                break;
            case 'e': // right
                const widthE = Math.max(minWidth, resizingWindow.startSize.width + delta.x);
                resizingWindow.window.style.width = `${widthE}px`;
                break;
        }
    }
};

window.onmouseup = () => {
    movingWindow = null;
    resizingWindow = null;
};

class Point2D {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static fromEvent(e) {
        return new Point2D(e.clientX, e.clientY);
    }

    subtract(p) {
        return new Point2D(this.x - p.x, this.y - p.y);
    }
}

function hover(ele) {
    ele.style.cursor = "pointer";
    ele.style.transition = "background .25s";

    ele.onmouseenter = () => (ele.style.background = "hsl(0 0 50 / .1)");
    ele.onmouseout = () => (ele.style.background = "transparent");
}
