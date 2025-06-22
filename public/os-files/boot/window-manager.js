const windows = new Map();

os.registerSyscall("window.open", (proc, id) => {
    if (!windows.has(proc.id)) windows.set(proc.id, new Map());
    windows.get(proc.id).set(id, new Window());

    proc.post({
        cmd: "proc.keep_alive",
        onclose: { name: "window.close", args: [id] },
    });
});

os.registerSyscall("window.close", (proc, id) => {
    windows.get(proc).get(id).close();
    windows.get(proc).delete(id);
});

os.registerSyscall(
    "window.title",
    (proc, id, title) => (windows.get(proc).get(id).title.innerText = title),
);

os.registerSyscall("window.content", (proc, id, content) =>
    windows.get(proc).get(id).content.append(content),
);

class Window {
    constructor() {
        this.window = document.createElement("div");
        this.content = document.createElement("div");
        this.#titlebar();

        this.window.append(this.content);
        document.getElementById("desktop").append(this.window);

        this.#style();
        this.#events();
    }

    close() {
        this.window.remove();
    }

    #style() {
        this.window.style.position = "absolute";
        this.window.style.width = "400px";
        this.window.style.height = "300px";
        this.window.style.border = "1px solid #ccc";
        this.window.style.backgroundColor = "#fff";
        this.window.style.display = "flex";
        this.window.style.flexDirection = "column";
        this.window.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
        this.window.style.borderRadius = "4px";
        this.window.style.overflow = "hidden";

        this.content.style.flexGrow = "1";
        this.content.style.padding = "10px";
        this.content.style.overflow = "auto";

        this.titlebar.style.backgroundColor = "#eee";
        this.titlebar.style.padding = "8px 10px";
        this.titlebar.style.cursor = "move";
        this.titlebar.style.display = "flex";
        this.titlebar.style.alignItems = "center";
        this.titlebar.style.justifyContent = "space-between";

        this.title.style.flexGrow = "1";
        this.title.style.fontWeight = "bold";

        this.closeBtn.style.width = "20px";
        this.closeBtn.style.height = "20px";
        this.closeBtn.style.borderRadius = "50%";
        this.closeBtn.style.backgroundColor = "#f44336";
        this.closeBtn.style.color = "#fff";
        this.closeBtn.style.display = "flex";
        this.closeBtn.style.alignItems = "center";
        this.closeBtn.style.justifyContent = "center";
        this.closeBtn.style.cursor = "pointer";
    }

    #events() {
        this.titlebar.onmousedown = (ev) => {
            this.moving = Point2D.fromEvent(ev);
        };

        this.titlebar.onmousemove = (ev) => {
            if (this.moving) {
                const pos = Point2D.fromEvent(ev);
                const delta = pos.subtract(this.moving);
                this.moving = pos;

                this.window.style.left = `${parseInt(this.window.style.left) || 0}px`;
                this.window.style.top = `${parseInt(this.window.style.top) || 0}px`;
            }
        };

        this.titlebar.onmouseup = () => {
            this.moving = null;
        };

        this.closeBtn.onclick = () => {
            os.win.closeWindow(id);
        };
    }

    #titlebar() {
        this.titlebar = document.createElement("div");
        this.title = document.createElement("div");
        this.closeBtn = document.createElement("div");

        this.closeBtn.innerText = "x";

        this.titlebar.append(this.title, this.closeBtn);
        this.window.append(this.titlebar);
    }
}

class Point2D {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    static fromEvent(e) {
        return new Point2D(e.clientX, e.clientY);
    }
}
