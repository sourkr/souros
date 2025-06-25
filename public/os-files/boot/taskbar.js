const { svg } = await require("A:/apps/libs/image.js");

function main() {
    const taskbar = new Taskbar();
}

class Taskbar {
    constructor() {
        this.taskbar = document.createElement("div");
        this.centerContainer = document.createElement("div");
        this.startBtn = document.createElement("img");
        this.startMenu = new StartMenu();
        this.time = document.createElement("div")
        
        this.batteryContainer = document.createElement('div')
        this.batteryNotchBack = document.createElement('div')
        this.batteryBack = document.createElement('div')
        this.battery = document.createElement('div')

        this.taskbar.append(this.centerContainer, this.batteryContainer, this.time);
        this.centerContainer.append(this.startBtn);
        this.batteryContainer.append(this.batteryBack, this.batteryNotchBack)
        this.batteryBack.append(this.battery)
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
        this.taskbar.style.cssText = `
            background: #2c3e50;
            display: flex;
            align-items: center;
            padding: 0 10px;
            box-sizing: border-box;
            gap: 10px;
            user-select: none;
        `;

        this.centerContainer.style.cssText = `
            margin: 0 auto;
            height: 100%;
            display: flex;
            align-items: center;
            gap: 5px;
        `;

        this.startBtn.style.cssText = `
            cursor: pointer;
            width: 30px;
            height: 30px;
            padding: 5px;
        `;

        this.batteryContainer.style.cssText = `
            display: flex;
            align-items: center;
        `
        
        this.batteryBack.style.cssText = `
            display: inline-block;
            border-radius: 6px;
            border: 2px solid white;
            padding: 2px;
        `

        this.batteryNotchBack.style.cssText = `
            display: inline-block;
            background: white;
            width: 3px;
            height: 10px;
            border-radius: 0 10px 10px 0;
        `

        this.battery.style.cssText = `
            background: white;
            border-radius: 3px;
            width: 27px;
            height: 12px;    
        `

        this.time.style.cssText = `
            color: white;
            font-size: 0.7rem;
            text-align: center;
        `
        
        hover(this.startBtn, 0.25);
    }

    async #events() {
        this.startBtn.onclick = () => this.showStartMenu(this.startBtn);

        Window.onopen = (win) => this.addWindow(win);

        setInterval(() => {
            const date = new Date();
            this.time.innerText = `${date.getHours()}:${date.getMinutes()}\n${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        }, 1000)
    }

    addWindow(win) {
        if (!this.seperator) {
            this.seperator = document.createElement("div");
            this.seperator.style.cssText = `
                display: inline-block;
                width: 2px;
                height: 80%;
                background: hsl(0 0 100 / .25);
            `;
            this.centerContainer.append(this.seperator);
        }

        const icon = document.createElement("img");
        icon.src = win.proc.icon;
        icon.width = 30;
        icon.height = 30;
        icon.style.cssText = `
            padding: 5px;
            cursor: pointer;
        `;
        hover(icon, 0.25);

        let window = null;
        let timeout = null;

        icon.onmouseenter = () => {
            const layout = document.createElement("div");
            const titlebar = document.createElement("div");
            const title = document.createElement("div");
            const closeBtn = document.createElement("img");
            const content = document.createElement("div");
            const blocker = document.createElement("div");
            const container = document.createElement("div");

            const iconRect = icon.getBoundingClientRect();
            const contentRect = win.content.getBoundingClientRect();

            const scale = 200 / contentRect.width;

            layout.style.cssText = `
                position: absolute;
                bottom: 5px;
                left: ${Math.max(5, iconRect.x + iconRect.width / 2 - 100)}px;
                width: 200px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 0 5px lightgray;
                border-radius: 10px;
                overflow: hidden;
            `;
            titlebar.style.cssText = `
                background: hsl(30 25 95);
                display: flex;
                align-items: center;
                height: 35px;
                user-select: none;
            `;

            title.style.cssText = `
                flex: 1;
                padding-left: 15px;
            `;

            closeBtn.style.cssText = `
                width: 55px;
                height: 35px;
                padding: 7.5px;
                box-sizing: border-box;
                cursor: pointer;
            `;
            hover(closeBtn);

            container.style.cssText = `
                height: ${contentRect.height * scale}px;
                width: ${contentRect.width * scale}px;
                position: relative;
                background: white;
            `;

            content.style.cssText = `
                height: ${contentRect.height}px;
                width: ${contentRect.width}px;
                scale: ${scale};
                position: absolute;
                bacground: red;
                translate: -25% -25%;
            `;

            blocker.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: transparent;
            `;

            title.innerText = win.title.innerText;
            closeBtn.src = win.closeBtn.src;
            content.innerHTML = win.content.innerHTML;

            layout.append(titlebar, container);
            titlebar.append(title, closeBtn);
            container.append(content, blocker);
            document.getElementById("desktop").append(layout);
            window = layout;

            window.onmouseenter = () => clearTimeout(timeout);
            window.onmouseleave = () => window.remove();
            closeBtn.onclick = () => {
                win.close();
                window.remove();
                icon.remove();
                if (this.taskbar.children.length === 2) {
                    this.seperator.remove();
                }
            };
        };

        icon.onmouseleave = () => {
            timeout = setTimeout(() => {
                window.remove();
            }, 100);
        };

        this.centerContainer.append(icon);
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

        this.startMenu.show(this.startBtn);
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
        this.menu.style.boxShadow = "0 0 5px rgba(0, 0, 0, .1)";
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

        item.onclick = async () => {
            // os.kernel.exec(info.executable)
            const proc = await Process.create(info.executable);
            proc.icon = await svg(info.icon);
            this.hide();
        };
    }

    clear() {
        this.menu.innerHTML = "";
    }

    show(btn) {
        document.getElementById("desktop").append(this.menu);

        requestAnimationFrame(() => {
            const startBtnRect = btn.getBoundingClientRect();
            const rect = this.menu.getBoundingClientRect();
            this.menu.style.left = `${startBtnRect.x + startBtnRect.width/2 - rect.width/2}px`;
        })
        
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