const { Window, Element, FlexBox, Button, Image, ProgressBar, hover } =
    await require("A:/apps/libs/gui.js");

const mainContainer = new FlexBox("column");

function main() {
    const window = new Window();
    window.title = "File Explorer";

    const root = new FlexBox("column");
    window.content = root;

    const addressBarContainer = new FlexBox();
    root.append(addressBarContainer);
    addressBarContainer.gap = "5px";

    const upBtn = new Button("up");
    addressBarContainer.append(upBtn);

    // const addressBar = new Element("div");
    // addressBar.css("flex", "1")
    // addressBarContainer.append(addressBar);

    root.append(mainContainer);
    mainContainer.css("flex", "1");

    update();
}

async function update(path) {
    mainContainer.clear();

    if (!path) {
        const driveNames = await sysget("fs.drives");

        driveNames.forEach(async (driveName) => {
            const item = await driveItem(driveName);
            mainContainer.append(item);
            item.on("dblclick", () => update(driveName) + "/");
        });
    } else {
        const dir = await sysget("fs.open", path, "read");
        const entries = await sysget("fs.readdir", dir);
        syscall("fs.close", dir);

        const dirs = new FlexBox("column");
        const files = new FlexBox("column");

        mainContainer.append(dirs);
        mainContainer.append(files);

        entries.forEach(async (name) => {
            const fd = await sysget("fs.open", path + name, "read");
            const stat = await sysget("fs.stat", fd);
            syscall("fs.close", fd);

            if (stat.type === "dir") {
                const item = folderItem(name);
                dirs.append(item);
                item.on("dblclick", () => update(path + name + "/"));
            } else {
                const item = await fileItem(path + name);
                files.append(item);
            }
        });
    }
}

async function driveItem(driveName) {
    const layout = new FlexBox();
    const icon = new Image();
    const name = new Element("span");
    const size = await sysget("fs.drive.size", driveName);
    const used = await sysget("fs.drive.used", driveName);
    const progress = (used / size) * 100;
    const progressBar = new ProgressBar(progress);
    const progressText = new Element("span");

    layout.append(icon);
    layout.append(name);
    layout.append(progressBar);

    layout.css("padding", "10px");
    layout.css("cursor", "pointer");
    layout.css("align-items", "center");
    layout.gap = "10px";

    icon.src = "A:/apps/icons/drive.svg";
    icon.size = "24px";

    name.text = driveName;
    name.css("font-size", "1.2rem");
    name.css("flex", "1");

    progressBar.css("display", "flex");

    progressText.text = `${round(formatBytes(used, "B"))} / ${round(formatBytes(size, "B"))}`;
    progressText.css("padding-left", "10px");
    progressText.css("font-size", ".8rem");
    // progressText.css("color", "hsl(0 0 50)");
    progressText.css("align-self", "center");
    progressBar.append(progressText);

    hover(layout);

    return layout;
}

function folderItem(name) {
    const layout = new FlexBox();
    const icon = new Image();
    const nameEle = new Element("span");

    layout.append(icon);
    layout.append(nameEle);

    layout.css("padding", "10px");
    layout.css("cursor", "pointer");
    layout.css("align-items", "center");
    layout.gap = "10px";

    icon.src = "A:/apps/icons/folder.svg";
    icon.size = "24px";

    nameEle.text = name;

    hover(layout);
    return layout;
}

async function fileItem(path) {
    const name = path.split("/").at(-1);
    const layout = new FlexBox();
    const icon = new Image();
    const nameEle = new Element("span");

    layout.append(icon);
    layout.append(nameEle);

    layout.css("padding", "10px");
    layout.css("cursor", "pointer");
    layout.css("align-items", "center");
    layout.gap = "10px";

    icon.src = "A:/apps/icons/file.svg";
    icon.size = "24px";

    nameEle.text = name;

    hover(layout);

    if (name.endsWith(".wos")) {
        const fd = await sysget("fs.open", path, "read");
        const appStr = await sysget("fs.read", fd);
        syscall("fs.close", fd);
        const app = JSON.parse(appStr);

        if (app.icons.src) {
            icon.src = app.icons.src;
        }
    }

    if (name.endsWith(".svg")) {
        // TODO: fix this
    }

    return layout;
}

function formatBytes(num, unit) {
    if (num < 1024) return `${num} ${unit}`;

    if (unit === "B") return formatBytes(num / 1024, "KB");
    if (unit === "KB") return formatBytes(num / 1024, "MB");
}

function round(unitFormatted) {
    const match = /(\d+(?:\.\d+)?)( \w+)/.exec(unitFormatted);
    if (!match) return unitFormatted;
    return Math.round(parseFloat(match[1])) + match[2];
}

main();
