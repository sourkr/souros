// Helper function to get the parent path
// Example: getParentPath('/foo/bar/') returns '/foo/'
// Example: getParentPath('/foo/') returns '/'
// Example: getParentPath('/') returns null (or a special value indicating no parent for drive view)
function getParentPath(pathString) {
    if (!pathString || pathString === '/') {
        return null; // Indicates root, cannot go up further within the drive
    }
    // Ensure trailing slash for consistency before processing
    let path = pathString.endsWith('/') ? pathString : pathString + '/';
    if (path === '/') return null; // Should have been caught, but as a safeguard

    // Remove the last segment (e.g., 'bar/')
    let lastSlashIndex = path.substring(0, path.length - 1).lastIndexOf('/');
    if (lastSlashIndex === -1) { // Should not happen if path starts with / and is not just /
        return '/'; // Or null, depending on desired behavior for unexpected inputs
    }
    if (lastSlashIndex === 0) { // Parent is root
        return '/';
    }
    return path.substring(0, lastSlashIndex + 1);
}


// Original renderFileExplorer function, adapted slightly for module context
// Note: The original function in main.js was named renderFileExplorer(appWindow, currentPathString)
// but then used an undefined pathArray. It seems currentPathString was intended to be pathArray.
// I'll assume currentPathArray is what's passed or derived.
// The function in main.js used a global pathArray for iterations,
// this version will rely on appWindow.dataset.currentPath consistently.

async function _renderFileExplorerInternal(appWindow) { // Made async
    const targetDiv = appWindow.querySelector('.file-explorer-main-area');
    if (!targetDiv) {
        console.error("Target div for file explorer not found in window:", appWindow);
        return;
    }
    targetDiv.innerHTML = ''; // Clear previous content

    let currentPathData;
    try {
        currentPathData = JSON.parse(appWindow.dataset.currentPath);
    } catch (e) {
        console.error("Error parsing currentPath from dataset or path is invalid:", e, appWindow.dataset.currentPath);
        // Reset to drive list if path is corrupted
        currentPathData = { drive: null };
        appWindow.dataset.currentPath = JSON.stringify(currentPathData);
    }

    let html = '<div class="fe-nav" style="padding: 5px; background: #eee; border-bottom: 1px solid #ccc;">';
    let pathDisplay = "Drives";
    let upButtonDisabled = true;

    if (currentPathData.drive === null) { // Drive Listing View
        upButtonDisabled = true;
        pathDisplay = "Available Drives";
        html += `<button class="fe-up-btn" disabled>Up</button> `;
        html += `<span>Path: ${pathDisplay}</span></div>`;
        html += '<ul class="fe-item-list" style="list-style: none; padding: 5px; margin: 0; height: calc(100% - 40px); overflow-y: auto;">';

        try {
            const drives = WebOSFileSystem.getDrives(); // This is synchronous
            const driveLetters = Object.keys(drives);
            if (driveLetters.length === 0) {
                html += '<li>No drives available.</li>';
            } else {
                driveLetters.forEach(driveLetter => {
                    const driveInfo = drives[driveLetter];
                    html += `<li class="fe-item fe-drive-item" data-drive="${driveInfo.letter.substring(0,1)}" style="padding: 3px; cursor: pointer; user-select:none;">`;
                    html += `<span class="fe-item-icon">&#128187;</span> ${driveInfo.letter} (${driveInfo.type})</li>`; // Drive icon
                });
            }
        } catch (error) {
            console.error("Error getting drives:", error);
            html += `<li>Error loading drives: ${error.message}</li>`;
        }
        html += '</ul>';
        targetDiv.innerHTML = html;

        appWindow.querySelectorAll('.fe-drive-item').forEach(itemElem => {
            itemElem.addEventListener('click', () => {
                const driveId = itemElem.getAttribute('data-drive');
                appWindow.dataset.currentPath = JSON.stringify({ drive: driveId, path: '/' });
                _renderFileExplorerInternal(appWindow);
            });
        });

    } else { // Directory Listing View
        const currentDrive = currentPathData.drive;
        let currentPath = currentPathData.path;

        // Ensure path starts with /
        if (!currentPath.startsWith('/')) {
            currentPath = '/' + currentPath;
        }
        // Ensure path ends with / for directories, for consistency with getParentPath
        if (!currentPath.endsWith('/')) {
            currentPath += '/';
        }
        // Update currentPathData and dataset if modified
        if (currentPathData.path !== currentPath) {
            currentPathData.path = currentPath;
            appWindow.dataset.currentPath = JSON.stringify(currentPathData);
        }

        const fullPath = currentDrive + ':' + currentPath;
        upButtonDisabled = false; // Enabled by default, logic below might disable it if at root of drive.
        pathDisplay = `Drive ${currentDrive}: ${currentPath}`;

        html += `<button class="fe-up-btn">Up</button> `;
        html += `<span>Path: ${pathDisplay}</span></div>`;
        html += '<ul class="fe-item-list" style="list-style: none; padding: 5px; margin: 0; height: calc(100% - 40px); overflow-y: auto;">';

        try {
            const items = await WebOSFileSystem.listDirectory(fullPath);
            if (items.length === 0) {
                html += '<li><em>This directory is empty.</em></li>';
            } else {
                items.forEach(item => {
                    const icon = item.type === 'dir' || item.type === 'directory' ? '&#128193;' : '&#128196;'; // Folder and File icons
                    html += `<li class="fe-item fe-fs-item" data-name="${item.name}" data-type="${item.type}" style="padding: 3px; cursor: pointer; user-select:none;">`;
                    html += `<span class="fe-item-icon">${icon}</span> ${item.name}`;
                    html += '</li>';
                });
            }
        } catch (error) {
            console.error(`Error listing directory ${fullPath}:`, error);
            html += `<li>Error loading directory contents: ${error.message}</li>`;
            // Potentially offer a way to go "Up" or retry
        }
        html += '</ul>';
        targetDiv.innerHTML = html;

        appWindow.querySelectorAll('.fe-fs-item').forEach(itemElem => {
            itemElem.addEventListener('click', () => {
                const itemName = itemElem.getAttribute('data-name');
                const itemType = itemElem.getAttribute('data-type');
                let currentPathObj = JSON.parse(appWindow.dataset.currentPath); // {drive, path}

                if (itemType === 'dir' || itemType === 'directory') {
                    let newPath = currentPathObj.path;
                    if (!newPath.endsWith('/')) newPath += '/';
                    newPath += itemName + '/'; // Append folder name and ensure trailing slash
                    currentPathObj.path = newPath;
                    appWindow.dataset.currentPath = JSON.stringify(currentPathObj);
                    _renderFileExplorerInternal(appWindow);
                } else {
                    alert('File clicked: ' + itemName + '\nType: ' + itemType + '\nFull Path: ' + currentPathObj.drive + ':' + currentPathObj.path + itemName);
                }
            });
        });

        const upButton = appWindow.querySelector('.fe-up-btn');
        if (upButton) {
            if (currentPathData.path === '/') { // At the root of the current drive
                 // No explicit disable, click handler will take to drive view
            }
            upButton.addEventListener('click', () => {
                let pathObj = JSON.parse(appWindow.dataset.currentPath);
                if (pathObj.path === '/') {
                    // Already at root of current drive, go to drive listing view
                    appWindow.dataset.currentPath = JSON.stringify({ drive: null });
                } else {
                    const parent = getParentPath(pathObj.path);
                    pathObj.path = parent !== null ? parent : '/'; // Default to root if getParentPath returns null unexpectedly
                    appWindow.dataset.currentPath = JSON.stringify(pathObj);
                }
                _renderFileExplorerInternal(appWindow);
            });
        }
    }
}


export function initFileExplorerApp(appContainer, appWindow) {
    // The appContainer is the content div of the window.
    // Set initial path to show drive list first
    if (!appWindow.dataset.currentPath) {
        appWindow.dataset.currentPath = JSON.stringify({ drive: null });
    // Set initial path to show drive list first
    if (!appWindow.dataset.currentPath) {
        appWindow.dataset.currentPath = JSON.stringify({ drive: null });
    }

    // Ensure the main area exists. If not, create it.
    // This part should ideally be handled by the window creation logic,
    // ensuring the app's predefined HTML structure is present.
    let feMainArea = appContainer.querySelector('.file-explorer-main-area');
    if (!feMainArea) {
        console.warn('File Explorer main area (.file-explorer-main-area) not found in appContainer. Creating it for compatibility.');
        feMainArea = document.createElement('div');
        feMainArea.className = 'file-explorer-main-area'; // Standard class for styling & selection
        feMainArea.style.width = '100%';
        feMainArea.style.height = '100%';
        appContainer.innerHTML = ''; // Clear container before adding
        appContainer.appendChild(feMainArea);
    }

    _renderFileExplorerInternal(appWindow); // Call the main rendering function
}
