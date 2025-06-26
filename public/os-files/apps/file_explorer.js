const { Window, Element, FlexBox, Button, Image, ProgressBar, hover } =
    await require("A:/apps/libs/gui.js");

async function main(args) {
    const isPickerMode = args && args.mode === "picker";
    let selectedFilePath = null;
    let selectedFilePathElement = null;
    const window = new Window();
    window.title = "File Explorer";
    window.minWidth = 400;
    window.minHeight = 300;

    const root = new FlexBox("column");
    window.content = root;

    const addressBarContainer = new FlexBox();
    root.append(addressBarContainer);
    addressBarContainer.gap = "5px";
    addressBarContainer.css("padding", "5px");

    const upBtn = new Button("up");
    addressBarContainer.append(upBtn);

    let selectBtn;
    if (isPickerMode) {
        selectBtn = new Button("Select");
        selectBtn.css("display", "none"); // Hidden until a file is selected
        addressBarContainer.append(selectBtn);

        selectBtn.on("click", () => {
            if (selectedFilePath) {
                syscall("app.respond", selectedFilePath);
                window.close(); // Assuming a window.close() method exists
            }
        });
    }

    const mainContainer = new Element("div");
    root.append(mainContainer);
    mainContainer.css("flex", "1");
    mainContainer.css("display", "grid");
    mainContainer.css("grid-template-columns", "repeat(auto-fill, minmax(120px, 1fr))");
    mainContainer.css("gap", "10px");
    mainContainer.css("padding", "10px");
    mainContainer.css("overflow-y", "auto");

    async function update(path) {
        mainContainer.clear();

        if (!path) {
            mainContainer.css("display", "flex"); // Change to flex for drives
            mainContainer.css("flex-wrap", "wrap");
            mainContainer.css("grid-template-columns", "none"); // Ensure no grid columns
            const driveNames = await sysget("fs.drives");

            driveNames.forEach(async (driveName) => {
                const item = await driveItem(driveName);
                mainContainer.append(item);
                item.on("dblclick", () => update(driveName + "/"));
            });
        } else {
            mainContainer.css("display", "grid"); // Revert to grid for folders/files
            mainContainer.css("grid-template-columns", "repeat(auto-fill, minmax(120px, 1fr))");
            const dir = await sysget("fs.open", path, "read");
            const entries = await sysget("fs.readdir", dir);
            syscall("fs.close", dir);

            entries.forEach(async (name) => {
                const fd = await sysget("fs.open", path + name, "read");
                const stat = await sysget("fs.stat", fd);
                syscall("fs.close", fd);

                if (stat.type === "dir") {
                    const item = folderItem(name);
                    mainContainer.append(item);
                    item.on("dblclick", () => update(path + name + "/"));
                } else {
                    const item = await fileItem(path + name, isPickerMode, selectedFilePath, selectedFilePathElement, selectBtn);
                    mainContainer.append(item);
                }
            });
        }
    }

    upBtn.on("click", () => {
        const currentPath = window.title.replace("File Explorer - ", "");
        if (currentPath === "/") return;
        const parentPath = currentPath.split("/").slice(0, -2).join("/") + "/";
        update(parentPath);
        window.title = `File Explorer - ${parentPath}`;
    });

    update();
    window.title = "File Explorer - /";
}

async function driveItem(driveName) {
    const layout = new FlexBox("row");
    layout.css("align-items", "center");
    layout.css("justify-content", "space-between"); // Distribute space
    layout.css("padding", "10px");
    layout.css("border-radius", "8px");
    layout.css("cursor", "pointer");
    layout.css("gap", "10px"); // Add gap between items in the row
    layout.css("flex-grow", "0"); // Prevent shrinking
    layout.css("flex-shrink", "0"); // Prevent growing
    hover(layout, "#f0f0f0");

    const icon = new Image();
    icon.src = "A:/apps/icons/drive.svg";
    icon.size = "48px";
    layout.append(icon);

    const name = new Element("span");
    name.text = driveName;
    name.css("margin-top", "0px"); // Reset margin-top for horizontal layout

    const infoContainer = new FlexBox("column");
    infoContainer.css("align-items", "flex-start"); // Align text to the start
    infoContainer.append(name);

    // Add drive space information
    const totalSpace = await sysget("fs.drive.size", driveName);
    const usedSpace = await sysget("fs.drive.used", driveName);

    if (totalSpace !== undefined && usedSpace !== undefined) {
        const usagePercentage = (usedSpace / totalSpace) * 100;
        const progressBar = new ProgressBar(usagePercentage);
        progressBar.css("width", "100px"); // Adjust width as needed
        progressBar.css("position", "relative"); // Ensure positioning context for text
        infoContainer.append(progressBar);

        const progressBarText = new Element("span");
        progressBarText.text = `${formatBytes(usedSpace)} / ${formatBytes(totalSpace)}`;
        progressBarText.css("position", "absolute");
        progressBarText.css("width", "100%");
        progressBarText.css("text-align", "center");
        progressBarText.css("color", "black"); // Or a color that contrasts with the bar
        progressBarText.css("font-size", "10px");
        progressBarText.css("line-height", "20px"); // Center vertically if bar height is 20px
        progressBar.append(progressBarText);

        const spaceText = new Element("span");
        spaceText.text = ``; // Clear this text as it's now in the progress bar
        spaceText.css("font-size", "12px");
        infoContainer.append(spaceText);
    }

    layout.append(icon);
    layout.append(infoContainer);

    return layout;
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function folderItem(name) {
    const layout = new FlexBox("column");
    layout.css("align-items", "center");
    layout.css("text-align", "center");
    layout.css("padding", "10px");
    layout.css("border-radius", "8px");
    layout.css("cursor", "pointer");
    hover(layout, "#f0f0f0");

    const icon = new Image();
    icon.src = "A:/apps/icons/folder.svg";
    icon.size = "48px";
    layout.append(icon);

    const nameEle = new Element("span");
    nameEle.text = name;
    nameEle.css("margin-top", "5px");
    layout.append(nameEle);

    return layout;
}

async function fileItem(path, isPickerMode, selectedFilePath, selectedFilePathElement, selectBtn) {
    const name = path.split("/").at(-1);
    const layout = new FlexBox("column");
    layout.css("align-items", "center");
    layout.css("text-align", "center");
    layout.css("padding", "10px");
    layout.css("border-radius", "8px");
    layout.css("cursor", "pointer");
    hover(layout, "#f0f0f0");

    const icon = new Image();
    icon.size = "48px";
    layout.append(icon);

    const nameEle = new Element("span");
    nameEle.text = name;
    nameEle.css("margin-top", "5px");
    layout.append(nameEle);

    if (isPickerMode) {
        layout.on("click", () => {
            if (selectedFilePathElement) {
                selectedFilePathElement.css("background", "transparent");
            }
            selectedFilePath = path;
            selectedFilePathElement = layout;
            layout.css("background", "#cceeff"); // Highlight selected file
            selectBtn.css("display", "block");
        });
    } else {
        layout.on("dblclick", () => {
            // Original double-click behavior for opening files
            // This part needs to be handled by the OS, e.g., by launching another app
            console.log(`Opening file: ${path}`);
        });
    }

    if (name.endsWith(".wos")) {
        const fd = await sysget("fs.open", path, "read");
        const appStr = await sysget("fs.read", fd);
        syscall("fs.close", fd);
        const app = JSON.parse(appStr);
        if (app.icons && app.icons.src) {
            icon.src = app.icons.src;
        } else {
            icon.src = "A:/apps/icons/file.svg";
        }
    } else if (name.endsWith(".svg")) {
        icon.src = path;
    } else {
        icon.src = "A:/apps/icons/file.svg";
    }

    return layout;
}

main();
