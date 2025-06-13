// Mock file system (local to this module for now)
const mockFileSystem = {
    'root': {
        type: 'folder',
        children: {
            'Documents': { type: 'folder', children: {
                'Report.docx': { type: 'file', content: 'This is a Word document.' },
                'Presentation.pptx': { type: 'file', content: 'This is a PowerPoint presentation.' }
            }},
            'Pictures': { type: 'folder', children: {
                'Vacation.jpg': { type: 'file', content: 'Image data' },
                'Family.png': { type: 'file', content: 'Image data' }
            }},
            'README.txt': { type: 'file', content: 'Welcome to WebOS!' }
        }
    }
};

// Original renderFileExplorer function, adapted slightly for module context
// Note: The original function in main.js was named renderFileExplorer(appWindow, currentPathString)
// but then used an undefined pathArray. It seems currentPathString was intended to be pathArray.
// I'll assume currentPathArray is what's passed or derived.
// The function in main.js used a global pathArray for iterations,
// this version will rely on appWindow.dataset.currentPath consistently.

function _renderFileExplorerInternal(appWindow) {
    const targetDiv = appWindow.querySelector('.file-explorer-main-area');
    if (!targetDiv) {
        console.error("Target div for file explorer not found in window:", appWindow);
        return;
    }

    let pathArray;
    try {
        pathArray = JSON.parse(appWindow.dataset.currentPath);
        if (!Array.isArray(pathArray)) throw new Error("Path is not an array.");
    } catch (e) {
        console.error("Error parsing currentPath from dataset or path is invalid:", e, appWindow.dataset.currentPath);
        // Reset to root if path is corrupted
        pathArray = ['root'];
        appWindow.dataset.currentPath = JSON.stringify(pathArray);
    }

    let currentLevelData = mockFileSystem;
    let validPath = true;
    // Traverse the pathArray to get to the current directory's data
    for (const part of pathArray) {
        if (part === 'root' && currentLevelData === mockFileSystem && mockFileSystem.root && mockFileSystem.root.type === 'folder') {
            currentLevelData = mockFileSystem.root.children;
        } else if (currentLevelData[part] && currentLevelData[part].type === 'folder') {
            currentLevelData = currentLevelData[part].children;
        } else { // Covers invalid segment or if path is like ['root'] and mockFileSystem.root is not a folder (already handled by validPath check later)
            console.warn('Invalid path segment:', part, 'in', pathArray.join('/'));
            validPath = false;
            break;
        }
    }

    if (!validPath || typeof currentLevelData !== 'object' || currentLevelData === null) {
        console.warn('Path was invalid or led to non-folder, attempting to reset to root. Path array:', pathArray);
        pathArray = ['root'];
        appWindow.dataset.currentPath = JSON.stringify(pathArray);
        currentLevelData = mockFileSystem.root.children; // Reset to root children
        if (typeof currentLevelData !== 'object' || currentLevelData === null) {
            console.error("Failed to reset to a valid root directory. Displaying empty.");
            targetDiv.innerHTML = '<p>Error: Cannot display file system.</p>';
            return;
        }
    }

    let html = '<div class="fe-nav" style="padding: 5px; background: #eee; border-bottom: 1px solid #ccc;">';
    // Disable "Up" button if at 'root' or if pathArray is just ['root']
    html += `<button class="fe-up-btn" ${pathArray.length <= 1 && pathArray[0] === 'root' ? 'disabled' : ''}>Up</button> `;
    html += `<span>Path: /${pathArray.join('/')}</span>`;
    html += '</div>';
    html += '<ul class="fe-item-list" style="list-style: none; padding: 5px; margin: 0; height: calc(100% - 40px); overflow-y: auto;">'; // Adjusted height

    for (const itemName in currentLevelData) {
        const item = currentLevelData[itemName];
        const icon = item.type === 'folder' ? '&#128193;' : '&#128196;'; // Folder and File icons
        html += `<li class="fe-item" data-name="${itemName}" data-type="${item.type}" style="padding: 3px; cursor: pointer; user-select:none;">`;
        html += `<span class="fe-item-icon">${icon}</span> ${itemName}`;
        html += '</li>';
    }
    html += '</ul>';
    targetDiv.innerHTML = html;

    // Add event listeners
    appWindow.querySelectorAll('.fe-item').forEach(itemElem => {
        itemElem.addEventListener('click', () => {
            const itemName = itemElem.getAttribute('data-name');
            const itemType = itemElem.getAttribute('data-type');
            let currentWindowPath = JSON.parse(appWindow.dataset.currentPath);

            if (itemType === 'folder') {
                const newPath = [...currentWindowPath, itemName];
                appWindow.dataset.currentPath = JSON.stringify(newPath);
                _renderFileExplorerInternal(appWindow); // Recursive call
            } else {
                // Logic for file click (e.g., open with associated app or show info)
                // Re-evaluate currentLevel for file content lookup based on currentWindowPath
                let fileParentLevelData = mockFileSystem;
                for(const part of currentWindowPath) {
                    if (part === 'root' && fileParentLevelData === mockFileSystem && mockFileSystem.root && mockFileSystem.root.type === 'folder') {
                        fileParentLevelData = mockFileSystem.root.children;
                    } else if (fileParentLevelData[part] && fileParentLevelData[part].type === 'folder') {
                        fileParentLevelData = fileParentLevelData[part].children;
                    } else {
                        // This break is important: if the segment isn't a folder, or doesn't exist,
                        // fileParentLevelData remains the parent of the item we're trying to access.
                        break;
                    }
                }
                if (fileParentLevelData && fileParentLevelData[itemName] && fileParentLevelData[itemName].content) {
                    alert('File clicked: ' + itemName + '\\nContent: ' + fileParentLevelData[itemName].content);
                } else {
                     alert('File clicked: ' + itemName + '\\nContent: Not available or error in path.');
                }
            }
        });
    });

    const upButton = appWindow.querySelector('.fe-up-btn');
    if (upButton) {
        upButton.addEventListener('click', () => {
            let currentWindowPath = JSON.parse(appWindow.dataset.currentPath);
            if (currentWindowPath.length > 1) { // Can only go up if not at root level
                const newPath = currentWindowPath.slice(0, -1);
                appWindow.dataset.currentPath = JSON.stringify(newPath);
                _renderFileExplorerInternal(appWindow); // Recursive call
            }
        });
    }
}

export function initFileExplorerApp(appContainer, appWindow) {
    // The appContainer is the content div of the window.
    // The File Explorer's HTML structure is minimal, defined in main.js's app definition
    // as '<div class="file-explorer-main-area" style="width:100%; height:100%;"></div>'
    // This structure should be created by openWindow in main.js.
    // initFileExplorerApp then populates it using _renderFileExplorerInternal.

    // Set initial path if not already set (e.g. by openWindow)
    if (!appWindow.dataset.currentPath) {
        appWindow.dataset.currentPath = JSON.stringify(['root']);
    }

    // Ensure the main area exists. If not, create it.
    let feMainArea = appContainer.querySelector('.file-explorer-main-area');
    if (!feMainArea) {
        console.warn('File Explorer main area not found in appContainer, creating it.');
        feMainArea = document.createElement('div');
        feMainArea.className = 'file-explorer-main-area';
        feMainArea.style.width = '100%';
        feMainArea.style.height = '100%';
        appContainer.appendChild(feMainArea);
    }

    _renderFileExplorerInternal(appWindow);
}
