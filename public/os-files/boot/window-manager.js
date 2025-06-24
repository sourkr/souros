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

        this.window.append(this.content);
        document.getElementById("desktop").append(this.window);

        this.#init();
        this.#style();
        this.#events();
        this.#addResizeHandles();
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
            min-width: 200px;
            min-height: 150px;
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
    }

    #addResizeHandles() {
        // Create resize handles for all edges and corners
        const handles = [
            { name: 'n', cursor: 'ns-resize', position: 'top: -3px; left: 3px; right: 3px; height: 6px;' },
            { name: 's', cursor: 'ns-resize', position: 'bottom: -3px; left: 3px; right: 3px; height: 6px;' },
            { name: 'e', cursor: 'ew-resize', position: 'right: -3px; top: 3px; bottom: 3px; width: 6px;' },
            { name: 'w', cursor: 'ew-resize', position: 'left: -3px; top: 3px; bottom: 3px; width: 6px;' },
            { name: 'ne', cursor: 'nesw-resize', position: 'top: -3px; right: -3px; width: 6px; height: 6px;' },
            { name: 'nw', cursor: 'nwse-resize', position: 'top: -3px; left: -3px; width: 6px; height: 6px;' },
            { name: 'se', cursor: 'nwse-resize', position: 'bottom: -3px; right: -3px; width: 6px; height: 6px;' },
            { name: 'sw', cursor: 'nesw-resize', position: 'bottom: -3px; left: -3px; width: 6px; height: 6px;' }
        ];

        this.resizeHandles = {};
        
        handles.forEach(handle => {
            const element = document.createElement('div');
            element.className = `resize-handle resize-${handle.name}`;
            element.style.cssText = `
                position: absolute;
                ${handle.position}
                cursor: ${handle.cursor};
                z-index: 10;
            `;
            
            element.onmousedown = (e) => {
                e.stopPropagation();
                this.#startResize(e, handle.name);
            };
            
            this.resizeHandles[handle.name] = element;
            this.window.appendChild(element);
        });
    }

    #startResize(e, direction) {
        const rect = this.window.getBoundingClientRect();
        resizingWindow = {
            window: this.window,
            direction: direction,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            startLeft: rect.left,
            startTop: rect.top
        };
    }

    #titlebar() {
        this.titlebar = document.createElement("div");
        this.title = document.createElement("div");
        this.closeBtn = document.createElement("img");

        this.titlebar.append(this.title, this.closeBtn);
        this.window.append(this.titlebar);
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
        const { window: win, direction, startX, startY, startWidth, startHeight, startLeft, startTop } = resizingWindow;
        const deltaX = ev.clientX - startX;
        const deltaY = ev.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        // Handle horizontal resizing
        if (direction.includes('e')) {
            newWidth = Math.max(200, startWidth + deltaX);
        } else if (direction.includes('w')) {
            newWidth = Math.max(200, startWidth - deltaX);
            newLeft = startLeft + (startWidth - newWidth);
        }
        
        // Handle vertical resizing
        if (direction.includes('s')) {
            newHeight = Math.max(150, startHeight + deltaY);
        } else if (direction.includes('n')) {
            newHeight = Math.max(150, startHeight - deltaY);
            newTop = startTop + (startHeight - newHeight);
        }
        
        win.style.width = `${newWidth}px`;
        win.style.height = `${newHeight}px`;
        win.style.left = `${newLeft}px`;
        win.style.top = `${newTop}px`;
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
