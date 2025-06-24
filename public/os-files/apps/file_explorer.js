const { Window, Element, FlexBox, Button } =
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
    // addressBar.css("flex", "1");
    // addressBarContainer.append(addressBar);

    root.append(mainContainer);
    mainContainer.css("flex", "1");

    update();
}

async function update(path) {
    if (!path) {
        const driveNames = await sysget("fs.drives");

        mainContainer.clear();

        driveNames.forEach((driveName) => {
            const drive = new Element("div");
            mainContainer.append(drive);

            drive.text = driveName;
            drive.on("dblclick", () => update(driveName + "/"));
            // drive.on("dblclick", () =>
            //     postMessage({ cmd: "log", msg: driveName + " clicked!" }),
            // );
        });
    } else {
        const dir = await sysget("fs.open", path, "read");
        const entries = await sysget("fs.readdir", dir);
        
        syscall("fs.close", dir);
        mainContainer.clear();

        entries.forEach((entry) => {
            const item = new Element("div");
            mainContainer.append(item);
            item.text = entry;
            item.on("dblclick", () => update(path + entry + "/"));
        });
    }
}

main();
