const windowId = window.os.win.openWindow({
width: '600px',
height: '400px'
});

if (windowId === -1) {
console.error('File Explorer: Failed to open window.');
}

window.os.win.setTitle(windowId, 'File Explorer');

// Main container for the app's UI
const appContainer = document.createElement('div');
appContainer.className = 'file-explorer-container';
// Inline styles for flex, height are kept as they are fundamental structure

// --- Style Element ---
const styleElement = document.createElement('style');
styleElement.textContent = `
.file-explorer-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #f0f0f0;
}
.file-explorer-address-bar {
    display: flex;
    align-items: center;
    padding: 5px;
    background-color: #fff;
    border-bottom: 1px solid #ccc;
}
.file-explorer-address-bar button {
    margin-right: 5px;
    padding: 3px 8px;
    border: 1px solid #ccc;
    background-color: #e0e0e0;
    cursor: pointer;
}
.file-explorer-address-bar button:hover {
    background-color: #d0d0d0;
}
.file-explorer-address-bar input[type='text'] {
    flex-grow: 1;
    padding: 4px;
    border: 1px solid #ccc;
}
.file-explorer-content {
    flex-grow: 1;
    padding: 10px;
    overflow-y: auto;
    background-color: #fff;
}
.file-explorer-item {
    display: flex;
    align-items: center;
    padding: 6px;
    cursor: default;
    border-radius: 4px;
}
.file-explorer-item:hover {
    background-color: #e6f3ff;
}
.file-explorer-item.folder { /* Combined selector for folder-specific hover */
        cursor: pointer;
}
.file-explorer-item-icon {
    margin-right: 8px;
    width: 20px;
    text-align: center;
}
.file-explorer-item-name {
    /* flex-grow: 1; // If you want names to take up remaining space */
}
`;
appContainer.appendChild(styleElement); // Prepend style to the container

// --- Address Bar ---
const addressBarContainer = document.createElement('div');
addressBarContainer.className = 'file-explorer-address-bar';

const upButton = document.createElement('button');
upButton.textContent = '↑'; // Using an arrow character for 'Up'
// Styles for button are now in CSS

const pathInput = document.createElement('input');
pathInput.type = 'text';
pathInput.value = 'A:/'; // Default path
pathInput.readOnly = true; // For now
// Styles for input are now in CSS

addressBarContainer.appendChild(upButton);
addressBarContainer.appendChild(pathInput);

// --- Main Content Area (File/Folder Listing) ---
const mainContentArea = document.createElement('div');
mainContentArea.className = 'file-explorer-content';
mainContentArea.innerHTML = ''; // Clear placeholder

// --- Assemble App UI ---
appContainer.appendChild(addressBarContainer);
appContainer.appendChild(mainContentArea);

// Set the assembled UI as the window's content
const success = window.os.win.setContent(windowId, appContainer);
if (!success) {
console.error('File Explorer: Failed to set content for window ' + windowId);
// Optionally close the window if content setting fails
// window.os.win.closeWindow(windowId);
}

// --- Navigation Logic ---
async function navigateTo(path) {
if (!window.os || !window.os.fs) {
    mainContentArea.innerHTML = '<p style="color: red;">Error: File system API not available.</p>';
    pathInput.value = path;
    return;
}
pathInput.value = path;
mainContentArea.innerHTML = '<p><em>Loading...</em></p>'; // Show loading message

let dirFd = -1; // Initialize to an invalid state
try {
    dirFd = await window.os.fs.open(path);

    if (typeof dirFd !== 'number' || dirFd < 0) {
    mainContentArea.innerHTML = `<p style="color: red;">Error: Could not open directory '${path}'. Invalid file descriptor: ${dirFd}</p>`;
    console.error(`navigateTo: Invalid file descriptor ${dirFd} for path ${path}`);
    if (typeof dirFd === 'number' && dirFd >= 0) { // Should not happen if check above is correct, but good practice
        await window.os.fs.close(dirFd); // Attempt to close if it's a valid number but error reported elsewhere
    }
    return;
    }

    const entries = await window.os.fs.readdir(dirFd);

    // It's important to close the directory handle after reading.
    // Consider if close should be in a finally block if readdir can throw before open error.
    // For now, assuming readdir is called only on valid fd.
    const closeStatus = await window.os.fs.close(dirFd);
    if(closeStatus < 0) { // Or however your fs.close indicates an error
        console.warn(`File Explorer: Error closing directory handle for ${path}. Status: ${closeStatus}`);
        // Not necessarily a fatal error for display, but good to log.
    }
    dirFd = -1; // Mark as closed


    mainContentArea.innerHTML = ''; // Clear "Loading..." or previous content

    if (entries.length === 0) {
    mainContentArea.innerHTML = '<p><em>Directory is empty.</em></p>';
    } else {
    entries.forEach(entryName => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'file-explorer-item';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'file-explorer-item-icon';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-explorer-item-name';
        nameSpan.textContent = entryName;

        // Simple heuristic for folder/file distinction
        const isLikelyFolder = !entryName.includes('.') || entryName.endsWith('.') || entryName === '..';
        iconSpan.innerHTML = isLikelyFolder ? '&#128193;' : '&#128196;'; // Folder or File icon

        if (isLikelyFolder) {
        itemDiv.classList.add('folder'); // Add 'folder' class for specific styling/cursor
        itemDiv.ondblclick = () => {
            let currentPath = path;
            if (!currentPath.endsWith('/')) {
            currentPath += '/';
            }
            // Avoid double slashes if entryName is '..' and path is already root-like 'A:/'
            let newPath = (currentPath + entryName).replace(/\/\//g, '/');
            if (!newPath.endsWith('/')) {
            newPath += '/';
            }
            navigateTo(newPath);
        };
        }

        itemDiv.appendChild(iconSpan);
        itemDiv.appendChild(nameSpan);
        mainContentArea.appendChild(itemDiv);
    });
    }
} catch (error) {
    mainContentArea.innerHTML = `<p style="color: red;">Error reading directory '${path}': ${error.message}</p>`;
    console.error(`navigateTo: Error for path ${path}`, error);
    if (typeof dirFd === 'number' && dirFd >= 0) { // If an error occurred after open but before explicit close
    try {
        await window.os.fs.close(dirFd);
        console.log(`navigateTo: Successfully closed directory handle ${dirFd} in error handler.`);
    } catch (closeError) {
        console.error(`navigateTo: Error closing directory handle ${dirFd} in error handler:`, closeError);
    }
    }
}
}

upButton.onclick = () => {
let currentPath = pathInput.value;
// Ensure it ends with a slash for consistent processing, unless it's just "A:"
if (!currentPath.endsWith('/') && currentPath.length > 2) {
    currentPath += '/';
} else if (currentPath.length === 2 && currentPath.endsWith(':')) {
    currentPath += '/'; // Ensure "A:" becomes "A:/"
}


if (currentPath === 'A:/') {
    navigateTo('A:/'); // Already at root, can't go up further than the drive root
    return;
}

// Remove the last segment (e.g., "folder/")
// Path: "A:/foo/bar/" -> parts ["A:", "foo", "bar", ""] -> after pop ["A:", "foo", "bar"] -> join "A:/foo/bar"
// Need to remove the last directory name.
// "A:/foo/bar/" -> "A:/foo/"
// "A:/foo/" -> "A:/"

let parts = currentPath.substring(0, currentPath.length -1).split('/'); // Remove trailing / then split
parts.pop(); // Remove the last directory name part

if (parts.length === 1 && parts[0].endsWith(':')) { // Only "A:" left
    navigateTo(parts[0] + '/');
} else if (parts.length > 1) {
    navigateTo(parts.join('/') + '/');
} else {
    navigateTo('A:/'); // Fallback or if parts is empty
}
};

navigateTo('A:/');