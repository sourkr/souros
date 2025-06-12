document.addEventListener('DOMContentLoaded', () => {
    // 1. OS Installation Check
    if (localStorage.getItem('webOsInstalled') !== 'true' && window.location.pathname !== '/install/') {
        // Redirect to installation page if not installed and not already on it
        // Check path to prevent redirect loop if server serves install/index.html on a different route
        if (window.location.pathname.endsWith('/install/') || window.location.pathname.endsWith('/install/index.html')) {
            // Already on an installation page path, do nothing
        } else {
             window.location.href = '/install/'; // Adjust if your server setup is different
             return; // Stop further execution
        }
    }

    const desktop = document.getElementById('desktop');
    const iconGrid = document.getElementById('icon-grid');
    const windowContainer = document.getElementById('window-container');
    let highestZIndex = 100; // For managing window stacking
    let openWindows = {}; // To track open windows and prevent duplicates

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
    // Note: currentPath will be managed per window instance via dataset attributes.

    // --- Sample App Definitions ---
    const apps = [
        {
            id: 'notepad',
            name: 'Notepad',
            icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/svgs/solid/file-lines.svg', // Example icon
            content: '<textarea style="width:98%; height:95%; border:none; resize:none;"></textarea>'
        },
        {
            id: 'settings',
            name: 'Settings',
            icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/svgs/solid/gear.svg',
            content: '<p>System settings will go here. Adjust display, sound, etc.</p>'
        },
        {
            id: 'browser',
            name: 'Browser',
            icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/svgs/solid/globe.svg',
            content: '<iframe src="https://www.google.com/webhp?igu=1" style="width:100%; height:100%; border:none;"></iframe>'
        },
        {
            id: 'fileExplorer',
            name: 'File Explorer',
            icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/svgs/solid/folder-open.svg',
            content: '<div class="file-explorer-main-area" style="width:100%; height:100%;"></div>' // This div will be populated by the file explorer logic
        }
    ];

    // --- Desktop Icon Loading ---
    function loadDesktopIcons() {
        iconGrid.innerHTML = ''; // Clear existing icons
        apps.forEach(app => {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'desktop-icon';
            iconDiv.setAttribute('data-app-id', app.id);

            const img = document.createElement('img');
            img.src = app.icon;
            img.alt = app.name;

            const span = document.createElement('span');
            span.textContent = app.name;

            iconDiv.appendChild(img);
            iconDiv.appendChild(span);

            iconDiv.addEventListener('click', () => openWindow(app));
            iconGrid.appendChild(iconDiv);
        });
    }

    // --- Windowing System ---
    function openWindow(app) {
        if (openWindows[app.id]) {
            // Focus existing window if already open
            openWindows[app.id].style.zIndex = ++highestZIndex;
            return;
        }

        highestZIndex++;
        const windowDiv = document.createElement('div');
        windowDiv.className = 'window';
        windowDiv.setAttribute('data-app-id', app.id);
        windowDiv.style.left = Math.random() * (desktop.offsetWidth - 300) + 'px'; // Random position
        windowDiv.style.top = Math.random() * (desktop.offsetHeight - 250 - 40) + 'px'; // Random position, avoid taskbar
        windowDiv.style.width = '400px'; // Default width
        windowDiv.style.height = '300px'; // Default height
        windowDiv.style.zIndex = highestZIndex;

        // Header
        const header = document.createElement('div');
        header.className = 'window-header';

        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = app.name;

        const controls = document.createElement('div');
        controls.className = 'controls';
        const closeButton = document.createElement('button');
        closeButton.className = 'close-btn';
        closeButton.innerHTML = '&times;'; // '×' character
        closeButton.addEventListener('click', () => closeWindow(app.id));

        controls.appendChild(closeButton);
        header.appendChild(title);
        header.appendChild(controls);

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'window-content';
        // For File Explorer, the content div is initially empty or a placeholder,
        // renderFileExplorer will populate it.
        if (app.id !== 'fileExplorer') {
            contentDiv.innerHTML = app.content; // In a real app, you'd build this more securely
        } else {
            // Ensure the specific div for file explorer is there as defined in apps array
             contentDiv.innerHTML = app.content; // This should create the .file-explorer-main-area
        }

        windowDiv.appendChild(header);
        windowDiv.appendChild(contentDiv);
        windowContainer.appendChild(windowDiv);

        openWindows[app.id] = windowDiv; // Track open window

        makeDraggable(windowDiv, header);

        windowDiv.addEventListener('mousedown', () => {
             windowDiv.style.zIndex = ++highestZIndex;
        });

        if (app.id === 'fileExplorer') {
            windowDiv.dataset.currentPath = JSON.stringify(['root']); // Initial path for this window
            const feMainArea = windowDiv.querySelector('.file-explorer-main-area');
            if (feMainArea) {
                 renderFileExplorer(windowDiv, JSON.parse(windowDiv.dataset.currentPath));
            } else {
                console.error("File Explorer main area not found on window creation.");
            }
        }
    }

    function renderFileExplorer(appWindow, pathArray) {
        const targetDiv = appWindow.querySelector('.file-explorer-main-area');
        if (!targetDiv) {
            console.error("Target div for file explorer not found in window:", appWindow);
            return;
        }

        let currentLevelData = mockFileSystem;
        let validPath = true;
        for (const part of pathArray) {
            if (currentLevelData[part] && currentLevelData[part].type === 'folder') {
                currentLevelData = currentLevelData[part].children;
            } else {
                // Path part not found or not a folder, try to recover or show error
                console.warn('Invalid path segment:', part, 'in', pathArray.join('/'));
                validPath = false;
                break;
            }
        }

        if (!validPath || typeof currentLevelData !== 'object') {
            // Attempt to reset to root if path became invalid
            // Or if currentLevelData is not an object (e.g. points to a file's children)
            pathArray = ['root'];
            appWindow.dataset.currentPath = JSON.stringify(pathArray);
            currentLevelData = mockFileSystem.root.children;
            console.warn('Path was invalid or led to non-folder, reset to root. Displaying root children.');
        }


        let html = '<div class="fe-nav" style="padding: 5px; background: #eee; border-bottom: 1px solid #ccc;">';
        html += `<button class="fe-up-btn" ${pathArray.length <= 1 ? 'disabled' : ''}>Up</button> `;
        html += `<span>Path: /${pathArray.join('/')}</span>`; // Display full path from root
        html += '</div>';
        html += '<ul class="fe-item-list" style="list-style: none; padding: 5px; margin: 0; height: calc(100% - 30px); overflow-y: auto;">';

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
                // Get current path from window dataset
                let currentWindowPath = JSON.parse(appWindow.dataset.currentPath);

                if (itemType === 'folder') {
                    const newPath = [...currentWindowPath, itemName];
                    appWindow.dataset.currentPath = JSON.stringify(newPath);
                    renderFileExplorer(appWindow, newPath);
                } else {
                    // Re-evaluate currentLevel for file content lookup based on currentWindowPath
                    let fileParentLevel = mockFileSystem;
                    for(const part of currentWindowPath) {
                        if(fileParentLevel[part] && fileParentLevel[part].type === 'folder') {
                            fileParentLevel = fileParentLevel[part].children;
                        } else {
                            // Should not happen if path is correct
                            break;
                        }
                    }
                    if (fileParentLevel[itemName] && fileParentLevel[itemName].content) {
                        alert(`File clicked: ${itemName}\nContent: ${fileParentLevel[itemName].content}`);
                    } else {
                         alert(`File clicked: ${itemName}\nContent: Not available or error in path.`);
                    }
                }
            });
        });

        const upButton = appWindow.querySelector('.fe-up-btn');
        if (upButton) {
            upButton.addEventListener('click', () => {
                let currentWindowPath = JSON.parse(appWindow.dataset.currentPath);
                if (currentWindowPath.length > 1) {
                    const newPath = currentWindowPath.slice(0, -1);
                    appWindow.dataset.currentPath = JSON.stringify(newPath);
                    renderFileExplorer(appWindow, newPath);
                }
            });
        }
    }

    function closeWindow(appId) {
        if (openWindows[appId]) {
            windowContainer.removeChild(openWindows[appId]);
            delete openWindows[appId];
        }
    }

    function makeDraggable(element, handle) {
        let isDragging = false;
        let offsetX, offsetY;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            element.style.zIndex = ++highestZIndex; // Bring to front on drag start
            // Disable text selection while dragging
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            // Keep window within desktop bounds (minus taskbar height)
            const taskbarHeight = 40;
            const desktopWidth = desktop.offsetWidth;
            const desktopHeight = desktop.offsetHeight;

            newX = Math.max(0, Math.min(newX, desktopWidth - element.offsetWidth));
            newY = Math.max(0, Math.min(newY, desktopHeight - element.offsetHeight - taskbarHeight));


            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                // Re-enable text selection
                document.body.style.userSelect = '';
            }
        });
    }

    // --- Initialization ---
    loadDesktopIcons();

    // Example: Make Start button do something (placeholder)
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', () => {
            alert('Start Menu clicked! (Not implemented yet)');
        });
    }
});
