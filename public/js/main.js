async function checkOSInstallationAndRedirect() {
    try {
        const osInstalledFlag = await window.WebOSFileSystem.readFile('A:/system/os_installed.flag');
        if (String(osInstalledFlag) !== 'true') {
            console.log("OS not installed or flag not set. Redirecting to install page. Flag value:", osInstalledFlag, "| Type:", typeof osInstalledFlag);
            if (!window.location.pathname.includes('/install/')) {
                 window.location.href = '/install/';
            }
            return true; // Indicates redirection is happening or should happen
        }
    } catch (error) {
        // This likely means the file doesn't exist, which implies OS is not installed.
        console.warn("Error checking OS installation flag (A:/system/os_installed.flag probably doesn't exist):", error);
        console.log("Assuming OS not installed. Redirecting to install page.");
        if (!window.location.pathname.includes('/install/')) {
            window.location.href = '/install/';
        }
        return true; // Indicates redirection
    }
    return false; // OS is installed, no redirection needed
}

(async () => {
    const shouldStopExecution = await checkOSInstallationAndRedirect();
    if (shouldStopExecution) {
        return;
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
            icon: 'assets/icons/file-lines.svg',
            content: '<textarea style="width:98%; height:95%; border:none; resize:none;"></textarea>'
        },
        {
            id: 'settings',
            name: 'Settings',
            icon: 'assets/icons/gear.svg',
            content: '<p>System settings will go here. Adjust display, sound, etc.</p>'
        },
        {
            id: 'browser',
            name: 'Browser',
            icon: 'assets/icons/globe.svg',
            content: '<iframe src="https://www.google.com/webhp?igu=1" style="width:100%; height:100%; border:none;"></iframe>'
        },
        {
            id: 'fileExplorer',
            name: 'File Explorer',
            icon: 'assets/icons/folder-open.svg',
            js_module: '/js/apps/file_explorer_app.js', // Path to the new module
            initial_window_content: '<div class="file-explorer-main-area" style="width:100%; height:100%;"></div>' // Minimal content for the window
        },
        {
            id: 'osUpdate',
            name: 'OS Update',
            icon: 'assets/icons/cloud-arrow-down.svg',
            js_module: '/js/apps/os_update_app.js' // Path to the new module
        },
        {
            id: 'appStore',
            name: 'App Store',
            icon: 'assets/icons/store.svg',
            js_module: '/js/apps/app_store_app.js' // Path to the new module
        },
        {
            id: 'terminal',
            name: 'Terminal',
            icon: 'assets/icons/puzzle-piece.svg', // Placeholder icon, update if a terminal icon exists
            js_module: '/js/apps/terminal_app.js' // Path to the new module
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
    async function openWindow(app) { // Made async to support dynamic imports
        if (openWindows[app.id]) {
            openWindows[app.id].style.zIndex = ++highestZIndex;
            return;
        }

        highestZIndex++;
        const windowDiv = document.createElement('div');
        windowDiv.className = 'window';
        windowDiv.setAttribute('data-app-id', app.id);
        // Default position and size, can be overridden by app specific settings later
        windowDiv.style.left = Math.random() * (desktop.offsetWidth - 400) + 'px';
        windowDiv.style.top = Math.random() * (desktop.offsetHeight - 340) + 'px'; // Avoid taskbar (40px)
        windowDiv.style.width = '400px';
        windowDiv.style.height = '300px';
        windowDiv.style.zIndex = highestZIndex;

        const header = document.createElement('div');
        header.className = 'window-header';
        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = app.name;
        const controls = document.createElement('div');
        controls.className = 'controls';
        const closeButton = document.createElement('button');
        closeButton.className = 'close-btn';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => closeWindow(app.id));
        controls.appendChild(closeButton);
        header.appendChild(title);
        header.appendChild(controls);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'window-content';

        windowDiv.appendChild(header);
        windowDiv.appendChild(contentDiv);
        windowContainer.appendChild(windowDiv);
        openWindows[app.id] = windowDiv;
        makeDraggable(windowDiv, header);

        windowDiv.addEventListener('mousedown', () => {
            windowDiv.style.zIndex = ++highestZIndex;
        });

        // --- App Content Loading Logic ---
        if (app.js_module) {
            try {
                // Set initial content for apps that define it (e.g. file explorer's main area div)
                if (app.initial_window_content) {
                    contentDiv.innerHTML = app.initial_window_content;
                }

                const module = await import(app.js_module);
                let initFunctionName = '';
                switch (app.id) {
                    case 'osUpdate':
                        initFunctionName = 'initOsUpdateApp';
                        break;
                    case 'appStore':
                        initFunctionName = 'initAppStoreApp';
                        break;
                    case 'fileExplorer':
                        initFunctionName = 'initFileExplorerApp';
                        break;
                    case 'terminal':
                        initFunctionName = 'initTerminalApp';
                        break;
                    default:
                        console.error(`No init function mapping for app: ${app.id}`);
                        contentDiv.innerHTML = `<p>Error: Could not load app module for ${app.name}.</p>`;
                        return;
                }

                if (module[initFunctionName] && typeof module[initFunctionName] === 'function') {
                    // Pass contentDiv (appContainer) and windowDiv (appWindow)
                    // Some apps might only need contentDiv, others might need windowDiv for datasets etc.
                    if (app.id === 'fileExplorer' || app.id === 'terminal') {
                         module[initFunctionName](contentDiv, windowDiv);
                    } else {
                         module[initFunctionName](contentDiv);
                    }
                } else {
                    console.error(`Init function '${initFunctionName}' not found in module ${app.js_module}`);
                    contentDiv.innerHTML = `<p>Error: Could not initialize ${app.name}.</p>`;
                }

            } catch (error) {
                console.error(`Error loading or initializing app module ${app.js_module} for ${app.name}:`, error);
                contentDiv.innerHTML = `<p>Error loading ${app.name}: ${error.message}</p>`;
            }
        } else if (app.content) {
            // For simple apps with direct HTML content
            contentDiv.innerHTML = app.content;
        } else {
            contentDiv.innerHTML = '<p>App content not available.</p>';
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
})();
