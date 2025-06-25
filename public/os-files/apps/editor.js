
const {
    Window, Element,
    FlexBox, Button, Image
} = await require("A:/apps/libs/gui.js");

let currentFile = null;
let currentFileDescriptor = null;
let isModified = false;

function main() {
    const window = new Window();
    window.title = "Editor";

    const root = new FlexBox("column");
    window.content = root;

    // Menu bar
    const menuBar = new FlexBox();
    menuBar.css("background", "#f0f0f0");
    menuBar.css("padding", "5px");
    menuBar.css("border-bottom", "1px solid #ccc");
    menuBar.gap = "10px";
    root.append(menuBar);

    const newBtn = new Button("New");
    const openBtn = new Button("Open");
    const saveBtn = new Button("Save");
    const saveAsBtn = new Button("Save As");

    menuBar.append(newBtn);
    menuBar.append(openBtn);
    menuBar.append(saveBtn);
    menuBar.append(saveAsBtn);

    // File path display
    const pathDisplay = new Element("div");
    pathDisplay.css("padding", "5px 10px");
    pathDisplay.css("background", "#f8f8f8");
    pathDisplay.css("border-bottom", "1px solid #ddd");
    pathDisplay.css("font-size", "0.9em");
    pathDisplay.css("color", "#666");
    pathDisplay.text = "Untitled";
    root.append(pathDisplay);

    // Editor area
    const editorContainer = new FlexBox("column");
    editorContainer.css("flex", "1");
    editorContainer.css("position", "relative");
    root.append(editorContainer);

    // Line numbers
    const lineNumbers = new Element("div");
    lineNumbers.css("position", "absolute");
    lineNumbers.css("left", "0");
    lineNumbers.css("top", "0");
    lineNumbers.css("width", "50px");
    lineNumbers.css("height", "100%");
    lineNumbers.css("background", "#f8f8f8");
    lineNumbers.css("border-right", "1px solid #ddd");
    lineNumbers.css("padding", "10px 5px");
    lineNumbers.css("font-family", "monospace");
    lineNumbers.css("font-size", "14px");
    lineNumbers.css("line-height", "1.5");
    lineNumbers.css("color", "#999");
    lineNumbers.css("overflow", "hidden");
    lineNumbers.css("user-select", "none");
    editorContainer.append(lineNumbers);

    // Text area
    const textArea = new Element("textarea");
    textArea.css("flex", "1");
    textArea.css("border", "none");
    textArea.css("outline", "none");
    textArea.css("resize", "none");
    textArea.css("font-family", "monospace");
    textArea.css("font-size", "14px");
    textArea.css("line-height", "1.5");
    textArea.css("padding", "10px 10px 10px 60px");
    textArea.css("background", "white");
    textArea.css("color", "#333");
    textArea.css("overflow-y", "auto");
    editorContainer.append(textArea);

    // Status bar
    const statusBar = new FlexBox();
    statusBar.css("background", "#f0f0f0");
    statusBar.css("padding", "5px 10px");
    statusBar.css("border-top", "1px solid #ccc");
    statusBar.css("font-size", "0.9em");
    statusBar.css("color", "#666");
    statusBar.css("justify-content", "space-between");
    root.append(statusBar);

    const statusLeft = new Element("span");
    const statusRight = new Element("span");
    statusBar.append(statusLeft);
    statusBar.append(statusRight);

    // Update line numbers
    function updateLineNumbers() {
        const lines = textArea._element.value.split('\n');
        const lineNumbersText = lines.map((_, i) => i + 1).join('\n');
        lineNumbers.text = lineNumbersText;
        
        // Update status bar
        const cursorPos = textArea._element.selectionStart;
        const textBeforeCursor = textArea._element.value.substring(0, cursorPos);
        const lineNumber = textBeforeCursor.split('\n').length;
        const columnNumber = textBeforeCursor.split('\n').pop().length + 1;
        
        statusLeft.text = isModified ? "Modified" : "Saved";
        statusRight.text = `Line ${lineNumber}, Column ${columnNumber}`;
    }

    // Text change handler
    function onTextChange() {
        isModified = true;
        updateTitle();
        updateLineNumbers();
    }

    // Update window title
    function updateTitle() {
        const fileName = currentFile ? currentFile.split('/').pop() : 'Untitled';
        window.title = `Editor - ${fileName}${isModified ? ' *' : ''}`;
        pathDisplay.text = currentFile || 'Untitled';
    }

    // Access textarea element directly for events
    syscall("dom.on", textArea._id, "input", sysevent(onTextChange));
    syscall("dom.on", textArea._id, "keyup", sysevent(updateLineNumbers));
    syscall("dom.on", textArea._id, "click", sysevent(updateLineNumbers));

    // New file
    newBtn.on("click", () => {
        if (isModified && !confirm("Unsaved changes will be lost. Continue?")) {
            return;
        }
        
        if (currentFileDescriptor !== null) {
            syscall("fs.close", currentFileDescriptor);
        }
        
        currentFile = null;
        currentFileDescriptor = null;
        isModified = false;
        syscall("dom.prop", textArea._id, "value", "");
        updateTitle();
        updateLineNumbers();
    });

    // Open file (simplified - just prompts for path)
    openBtn.on("click", async () => {
        const path = prompt("Enter file path:");
        if (!path) return;

        try {
            const fd = await sysget("fs.open", path, "read");
            if (fd === -1) {
                alert("File not found!");
                return;
            }

            const content = await sysget("fs.read", fd);
            syscall("fs.close", fd);

            if (currentFileDescriptor !== null) {
                syscall("fs.close", currentFileDescriptor);
            }

            currentFile = path;
            currentFileDescriptor = null;
            isModified = false;
            
            syscall("dom.prop", textArea._id, "value", content || "");
            updateTitle();
            updateLineNumbers();
        } catch (error) {
            alert("Error opening file: " + error.message);
        }
    });

    // Save file
    async function saveFile() {
        if (!currentFile) {
            return saveAsFile();
        }

        try {
            const fd = await sysget("fs.open", currentFile, "write");
            if (fd === -1) {
                alert("Cannot save file!");
                return;
            }

            const content = textArea._element.value;
            await syscall("fs.write", fd, content);
            syscall("fs.close", fd);

            isModified = false;
            updateTitle();
            alert("File saved successfully!");
        } catch (error) {
            alert("Error saving file: " + error.message);
        }
    }

    // Save as file
    async function saveAsFile() {
        const path = prompt("Enter file path to save:");
        if (!path) return;

        try {
            const fd = await sysget("fs.open", path, "write");
            if (fd === -1) {
                alert("Cannot create file!");
                return;
            }

            const content = textArea._element.value;
            await syscall("fs.write", fd, content);
            syscall("fs.close", fd);

            if (currentFileDescriptor !== null) {
                syscall("fs.close", currentFileDescriptor);
            }

            currentFile = path;
            currentFileDescriptor = null;
            isModified = false;
            updateTitle();
            alert("File saved successfully!");
        } catch (error) {
            alert("Error saving file: " + error.message);
        }
    }

    saveBtn.on("click", saveFile);
    saveAsBtn.on("click", saveAsFile);

    // Keyboard shortcuts
    syscall("dom.on", textArea._id, "keydown", sysevent((event) => {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 's':
                    event.preventDefault();
                    saveFile();
                    break;
                case 'n':
                    event.preventDefault();
                    newBtn.click();
                    break;
                case 'o':
                    event.preventDefault();
                    openBtn.click();
                    break;
            }
        }
    }));

    // Initialize
    updateLineNumbers();
}

main();
