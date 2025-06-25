const { Window, Element, FlexBox, Button, Image, hover, Input, TextArea } = await require("A:/apps/libs/gui.js")

const window = new Window()
window.title = "Editor"

const root = new FlexBox("column")
const toolbar = new FlexBox()
const addressBar = new Input()
const saveBtn = new Button("Save")
const content = new TextArea()

root.append(toolbar, content)
window.content = root

saveBtn.onclick = async () => {
	const fd = await sysget("fs.open", addressBar.value, "write")
	await syscall("fs.write", fd, await content.val())
	await syscall("fs.close", fd)
}