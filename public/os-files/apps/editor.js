const { Window, Element, FlexBox, Button, Image, hover, Input, TextArea } = await require("A:/apps/libs/gui.js")

const window = new Window()
window.title = "Editor"

const root = new FlexBox("column")
const toolbar = new FlexBox()
const openBtn = new Button("Open")
const saveBtn = new Button("Save")
const content = new TextArea()
content.css("flex", "1") // Make content take up remaining space

let currentFilePath = null;

toolbar.append(openBtn)
toolbar.append(saveBtn)
root.append(toolbar)
root.append(content)
window.content = root

openBtn.onclick = async () => {
    const selectedFilePath = await sysget("app.launch", "A:/apps/file_explorer.js", { mode: "picker" });
    if (selectedFilePath) {
        const fd = await sysget("fs.open", selectedFilePath, "read")
        const fileContent = await sysget("fs.read", fd)
        await content.val(fileContent)
        await syscall("fs.close", fd)
        currentFilePath = selectedFilePath;
        window.title = `Editor - ${currentFilePath}`;
    }
}

saveBtn.onclick = async () => {
    if (currentFilePath) {
        const fd = await sysget("fs.open", currentFilePath, "write")
        await syscall("fs.write", fd, await content.val())
        await syscall("fs.close", fd)
    } else {
        // If no file is open, prompt to save as new file (future enhancement)
        console.log("No file open to save. Use 'Open' to select a file first.");
    }
}