const { svg } = await require("A:/apps/libs/image.js");

function main() {
    const taskbar = new Taskbar();
}

class Taskbar {
    constructor() {
        this.taskbar = document.createElement("div");
        this.startBtn = document.createElement("img");
        this.startMenu = new StartMenu();

        this.taskbar.append(this.startBtn);
        document.getElementById("display").append(this.taskbar);

        this.#init();
    }

    async #init() {
        this.taskbar.id = "taskbar";
        this.startBtn.src = await svg("A:/apps/icons/start.svg");

        this.#style();
        this.#events();
    }

    #style() {
        this.taskbar.style.background = "#2c3e50";
        this.taskbar.style.display = "flex";
        this.taskbar.style.alignItems = "center";
        this.taskbar.style.padding = "0 10px";
        this.taskbar.style.boxSizing = "border-box";

        this.startBtn.style.cursor = "pointer";
        this.startBtn.style.width = "30px";
        this.startBtn.style.height = "30px";
        this.startBtn.style.padding = "5px";

        hover(this.startBtn, 0.25);
    }

    #events() {
        this.startBtn.onclick = () => this.showStartMenu();
    }

    async showStartMenu() {
        this.startMenu.clear();

        const fd = await os.fs.open("A:/apps/info", "read");
        const apps = await os.fs.readdir(fd);
        await os.fs.close(fd);

        apps.forEach(async (name) => {
            const fd = await os.fs.open(`A:/apps/info/${name}`, "read");
            const info = JSON.parse(await os.fs.read(fd));
            await os.fs.close(fd);

            this.startMenu.addApp(info);
        });

        this.startMenu.show();
    }
}

class StartMenu {
    constructor() {
        this.menu = document.createElement("div");

        this.#style();
    }

    #style() {
        this.menu.style.position = "absolute";
        this.menu.style.bottom = "10px";
        this.menu.style.left = "10px";
        this.menu.style.display = "flex";
        this.menu.style.flexDirection = "column";
        this.menu.style.padding = "10px 0";
        this.menu.style.background = "white";
        this.menu.style.boxShadow = "0 0 10px rgba(0, 0, 0, .5)";
        this.menu.style.borderRadius = "10px";
    }

    addApp(info) {
        const item = document.createElement("div");
        item.innerText = info.name;

        item.style.padding = "10px";
        item.style.width = "100%";
        item.style.boxSizing = "border-box";

        this.menu.append(item);

        hover(item);

        item.onclick = () => {
            // os.kernel.exec(info.executable)
            Process.create(info.executable);
            this.hide();
        };
    }

    clear() {
        this.menu.innerHTML = "";
    }

    show() {
        document.getElementById("desktop").append(this.menu);

        // close if clicked outside
        document.addEventListener(
            "mousedown",
            (e) => {
                if (!this.menu.contains(e.target)) this.hide();
            },
            { once: true, capture: true },
        );
    }

    hide() {
        this.menu.remove();
    }
}

function hover(ele, intensity = 0.1) {
    ele.style.cursor = "pointer";
    ele.style.transition = "background .25s";

    ele.onmouseenter = () =>
        (ele.style.background = `hsl(0 0 50 / ${intensity})`);
    ele.onmouseout = () => (ele.style.background = "transparent");
}

main();
