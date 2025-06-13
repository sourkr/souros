async function checkOSInstallationAndRedirect() {
    try {
        const osInstalledFlag = await window.WebOSFileSystem.readFile('A:/system/os_installed.flag');
        if (osInstalledFlag !== 'true') {
            console.log("OS not installed or flag not set. Redirecting to install page.");
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

    // Note: currentPath will be managed per window instance via dataset attributes.
    // mockFileSystem has been removed as we are now using WebOSFileSystem.

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
            content: '<div class="file-explorer-main-area" style="width:100%; height:100%;"></div>' // This div will be populated by the file explorer logic
        },
        {
            id: 'osUpdate',
            name: 'OS Update',
            icon: 'assets/icons/cloud-arrow-down.svg',
            content: `
                <div style="padding: 15px; font-family: sans-serif; color: #333;">
                    <h2>OS Update</h2>
                    <p>Current OS Version: <span id="osUpdateCurrentVersion">1.0.0</span> (from A:/system/os_config.json)</p>
                    <p>Available Version: <span id="osUpdateAvailableVersion">-</span></p>
                    <button id="osCheckForUpdatesBtn" style="padding: 8px 12px; margin-right: 10px;">Check for Updates</button>
                    <button id="osApplyUpdateBtn" style="padding: 8px 12px;" disabled>Apply Update</button>
                    <p id="osUpdateStatus" style="margin-top: 10px;"></p>
                    <script>
                        // Script for OS Update App functionality (will be enhanced later)
                        (function() {
                            const currentVersionElem = document.getElementById('osUpdateCurrentVersion');
                            const availableVersionElem = document.getElementById('osUpdateAvailableVersion');
                            const checkForUpdatesBtn = document.getElementById('osCheckForUpdatesBtn');
                            const applyUpdateBtn = document.getElementById('osApplyUpdateBtn');
                            const statusElem = document.getElementById('osUpdateStatus');

                            let latestServerVersionInfo = null; // To store fetched update info

                            async function fetchCurrentOSVersion() {
                                if (window.WebOSFileSystem) {
                                    try {
                                        const configStr = await window.WebOSFileSystem.readFile('A:/system/os_config.json');
                                        if (configStr) {
                                            const config = JSON.parse(configStr);
                                            currentVersionElem.textContent = config.version || '1.0.0';
                                            return config.version || '1.0.0';
                                        }
                                    } catch (e) {
                                        console.error('Error reading OS config for version:', e);
                                        currentVersionElem.textContent = 'Error';
                                    }
                                }
                                return '1.0.0'; // Default if not found
                            }

                            fetchCurrentOSVersion(); // Load on app open

                            checkForUpdatesBtn.addEventListener('click', async () => {
                                statusElem.textContent = 'Checking for updates...';
                                applyUpdateBtn.disabled = true;
                                latestServerVersionInfo = null;
                                const currentVersion = await fetchCurrentOSVersion();

                                try {
                                    const response = await fetch('/api/os_update_info.json');
                                    if (!response.ok) {
                                        throw new Error(\`HTTP error! status: \${response.status}\`);
                                    }
                                    const data = await response.json();
                                    latestServerVersionInfo = data; // Store fetched info

                                    availableVersionElem.textContent = data.latestVersion;
                                    // Basic version comparison (can be improved for semantic versioning)
                                    if (data.latestVersion > currentVersion) {
                                        statusElem.textContent = `Update available: ${data.latestVersion} - ${data.description}`;
                                        applyUpdateBtn.disabled = false;
                                    } else {
                                        statusElem.textContent = 'Your OS is up to date.';
                                    }
                                } catch (error) {
                                    console.error('Error fetching update info:', error);
                                    statusElem.textContent = 'Error checking for updates. Please try again.';
                                    availableVersionElem.textContent = '-';
                                }
                            });

                            applyUpdateBtn.addEventListener('click', async () => {
                                if (!latestServerVersionInfo) {
                                    statusElem.textContent = 'No update information available. Please check for updates first.';
                                    return;
                                }

                                statusElem.textContent = `Applying update to ${latestServerVersionInfo.latestVersion}...`;
                                applyUpdateBtn.disabled = true;

                                // Mock apply
                                setTimeout(async () => {
                                    if (window.WebOSFileSystem) {
                                        const newConfig = {
                                            version: latestServerVersionInfo.latestVersion,
                                            installedDate: new Date().toISOString(),
                                            lastUpdateCheck: new Date().toISOString() // Add more info if needed
                                        };
                                        try {
                                            await window.WebOSFileSystem.writeFile('A:/system/os_config.json', JSON.stringify(newConfig));
                                            currentVersionElem.textContent = newConfig.version;
                                            availableVersionElem.textContent = '-'; // Clear available version
                                            latestServerVersionInfo = null; // Clear fetched info
                                            statusElem.textContent = `OS updated successfully to ${newConfig.version}! Restart might be required (not simulated).`;
                                        } catch (e) {
                                            console.error('Error writing updated OS config:', e);
                                            statusElem.textContent = 'Update failed (Error writing config).';
                                            applyUpdateBtn.disabled = false; // Re-enable button on failure
                                        }
                                    } else {
                                        statusElem.textContent = 'Update failed (FileSystem not available).';
                                        applyUpdateBtn.disabled = false; // Re-enable button on failure
                                    }
                                }, 1500); // Simulate delay
                            });
                        })();
                    </script>
                </div>
            `
        },
        {
            id: 'appStore',
            name: 'App Store',
            icon: 'assets/icons/store.svg',
            content: `
                <div style="padding: 15px; font-family: sans-serif; color: #333; height: 100%; display: flex; flex-direction: column;">
                    <h2>App Store</h2>
                    <div id="appStoreAvailableApps" style="flex-grow: 1; overflow-y: auto; border: 1px solid #eee; padding: 10px; margin-bottom: 10px;">
                        <p>Loading apps...</p>
                    </div>
                    <div id="appStoreStatus" style="margin-top: 10px; min-height: 20px;"></div>
                    <script>
                        // Script for App Store App functionality (will be enhanced later)
                        (function() {
                            const availableAppsContainer = document.getElementById('appStoreAvailableApps');
                            const statusElem = document.getElementById('appStoreStatus');
                            let installedApps = {};
                            let catalogApps = []; // To store apps from API

                            async function loadInstalledAppsManifest() {
                                if (window.WebOSFileSystem) {
                                    try {
                                        if (!window.WebOSFileSystem.getDrive('B')) {
                                            console.warn('Drive B (IndexedDB) not available for App Store manifest.');
                                        } else {
                                            await window.WebOSFileSystem.createDirectory('B:/apps');
                                        }
                                        const manifestStr = await window.WebOSFileSystem.readFile('B:/apps/installed_manifest.json');
                                        if (manifestStr) {
                                            installedApps = JSON.parse(manifestStr);
                                        }
                                    } catch (e) {
                                        console.log('No app manifest found or error reading it (B:/apps/installed_manifest.json). Assuming no apps installed via store yet.', e);
                                        installedApps = {};
                                        if (window.WebOSFileSystem.getDrive('B')) {
                                           try {
                                               await window.WebOSFileSystem.writeFile('B:/apps/installed_manifest.json', JSON.stringify({}));
                                           } catch (initError) {
                                               console.error("Failed to initialize app manifest on Drive B:", initError);
                                           }
                                        }
                                    }
                                }
                            }

                            async function saveInstalledAppsManifest() {
                                if (window.WebOSFileSystem && window.WebOSFileSystem.getDrive('B')) {
                                    try {
                                        await window.WebOSFileSystem.writeFile('B:/apps/installed_manifest.json', JSON.stringify(installedApps));
                                    } catch (saveError) {
                                        console.error("Failed to save app manifest on Drive B:", saveError);
                                        statusElem.textContent = 'Error saving app installation status.';
                                    }
                                }
                            }

                            function renderApps() {
                                availableAppsContainer.innerHTML = '';
                                if (catalogApps.length === 0) {
                                    // This message will be shown if catalog is empty or failed to load
                                    // The catch block in the IIFE will set a more specific error message in statusElem if fetch fails
                                    availableAppsContainer.innerHTML = '<p>No apps available at the moment. Check status below.</p>';
                                    return;
                                }
                                catalogApps.forEach(app => {
                                    const appEntry = document.createElement('div');
                                    appEntry.style.borderBottom = '1px solid #eee';
                                    appEntry.style.paddingBottom = '10px';
                                    appEntry.style.marginBottom = '10px';

                                    let appIconHtml = app.icon ? `<img src="${app.icon}" alt="${app.name}" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 10px;">` : '';

                                    appEntry.innerHTML = `
                                        ${appIconHtml}
                                        <strong>${app.name}</strong> (v${app.version}) <em style="font-size:0.8em; color: #555;">by ${app.developer || 'Unknown Dev'}</em>
                                        <p style="font-size: 0.9em; margin: 5px 0;">${app.description}</p>
                                        <p style="font-size: 0.8em; color: #777;">Permissions: ${app.permissions && app.permissions.length > 0 ? app.permissions.join(', ') : 'none'}</p>
                                    `;

                                    const installButton = document.createElement('button');
                                    installButton.style.padding = '5px 10px';

                                    if (installedApps[app.id]) {
                                        if (installedApps[app.id] < app.version) {
                                            installButton.textContent = 'Update to v' + app.version;
                                            installButton.onclick = () => handleInstallOrUpdate(app, true);
                                        } else {
                                            installButton.textContent = 'Installed (v' + installedApps[app.id] + ')';
                                            installButton.disabled = true;
                                        }
                                    } else {
                                        installButton.textContent = 'Install';
                                        installButton.onclick = () => handleInstallOrUpdate(app, false);
                                    }

                                    appEntry.appendChild(installButton);
                                    availableAppsContainer.appendChild(appEntry);
                                });
                            }

                            async function handleInstallOrUpdate(app, isUpdate) {
                                if (!window.WebOSFileSystem.getDrive('B')) {
                                    statusElem.textContent = 'Drive B (for app installations) is not available.';
                                    console.error('Drive B not available for app installation/update.');
                                    return;
                                }
                                statusElem.textContent = `${isUpdate ? 'Updating' : 'Installing'} ${app.name}...`;
                                setTimeout(async () => {
                                    installedApps[app.id] = app.version;
                                    await saveInstalledAppsManifest();
                                    statusElem.textContent = `${app.name} ${isUpdate ? 'updated' : 'installed'} successfully to v${app.version}! (Restart WebOS or App Store to see changes in main app list - not simulated).`;
                                    renderApps();
                                    console.warn("App '" + app.name + "' processed. Manual refresh or advanced inter-app communication needed to see it live in desktop.");
                                }, 1500);
                            }

                            (async () => { // Main IIFE for the app
                                await loadInstalledAppsManifest();
                                try {
                                    const response = await fetch('/api/app_store_catalog.json');
                                    if (!response.ok) {
                                        throw new Error(\`HTTP error! status: \${response.status}\`);
                                    }
                                    catalogApps = await response.json();
                                } catch (error) {
                                    console.error('Error fetching app catalog:', error);
                                    statusElem.textContent = 'Could not load app catalog: ' + error.message;
                                    catalogApps = []; // Ensure it's an empty array on error
                                }
                                renderApps();
                            })();
                        })();
                    </script>
                </div>
            `
        },
        {
            id: 'terminal',
            name: 'Terminal',
            icon: 'assets/icons/puzzle-piece.svg', // Placeholder icon, consider changing
            content: `
                <div class="terminal-output" style="height: calc(100% - 30px); overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; background-color: #1e1e1e; color: #d4d4d4; padding: 5px;"></div>
                <div class="terminal-input-line" style="display: flex; height: 25px; background-color: #1e1e1e; border-top: 1px solid #333;">
                    <span class="terminal-prompt" style="color: #569cd6; padding: 2px 5px;"></span>
                    <input type="text" class="terminal-input" style="flex-grow: 1; background-color: transparent; color: #d4d4d4; border: none; outline: none; font-family: monospace; padding: 2px 5px;">
                </div>
            `
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
            windowDiv.dataset.currentPath = ""; // Initial path signifies drive listing view
            const feMainArea = windowDiv.querySelector('.file-explorer-main-area');
            if (feMainArea) {
                 renderFileExplorer(windowDiv, windowDiv.dataset.currentPath);
            } else {
                console.error("File Explorer main area not found on window creation.");
            }
        } else if (app.id === 'terminal') {
            initializeTerminal(windowDiv);
        }
    }

    function initializeTerminal(appWindow) {
        const outputElement = appWindow.querySelector('.terminal-output');
        const inputElement = appWindow.querySelector('.terminal-input');
        const promptElement = appWindow.querySelector('.terminal-prompt');

        appWindow.dataset.terminalCwd = "A:/";
        appWindow.dataset.terminalHistory = JSON.stringify([]);
        appWindow.dataset.terminalHistoryIndex = "-1";

        const appendOutput = (text, type = 'info') => {
            const line = document.createElement('div');
            if (type === 'command') {
                line.textContent = `${promptElement.textContent}${text}`;
                line.style.color = "#80ccff"; // Light blue for commands
            } else if (type === 'error') {
                line.textContent = `Error: ${text}`;
                line.style.color = "#ff8080"; // Light red for errors
            } else if (type === 'system') {
                 line.textContent = `SYSTEM: ${text}`;
                 line.style.color = "#a0a0a0"; // Grey for system messages
            }
             else {
                line.textContent = text;
            }
            outputElement.appendChild(line);
            outputElement.scrollTop = outputElement.scrollHeight;
        };

        const updatePrompt = () => {
            promptElement.textContent = `${appWindow.dataset.terminalCwd}> `;
        };

        const resolvePath = (path) => {
            if (!path || path.trim() === '') return appWindow.dataset.terminalCwd;
            if (path.includes(':')) return path.endsWith('/') ? path : path + '/'; // Absolute path

            let currentCwd = appWindow.dataset.terminalCwd; // e.g., "A:/" or "A:/folder/"
            if (!currentCwd.endsWith('/')) currentCwd += '/';

            if (path === '.') return currentCwd;
            if (path === '..') {
                if (currentCwd.endsWith(':/')) return currentCwd; // Already at root of drive
                return currentCwd.substring(0, currentCwd.slice(0, -1).lastIndexOf('/') + 1);
            }
            return currentCwd + path + (path.endsWith('/') ? '' : '/');
        };


        const executeCommand = async (fullCommand) => {
            appendOutput(fullCommand, 'command');
            const [command, ...args] = fullCommand.trim().split(/\s+/);
            const history = JSON.parse(appWindow.dataset.terminalHistory);
            if (fullCommand.trim() !== "" && (history.length === 0 || history[history.length -1] !== fullCommand.trim())) {
                 history.push(fullCommand.trim());
            }
            appWindow.dataset.terminalHistory = JSON.stringify(history);
            appWindow.dataset.terminalHistoryIndex = history.length;


            switch (command.toLowerCase()) {
                case 'help':
                    appendOutput("Available commands:\n" +
                        "  help                       - Shows this help message\n" +
                        "  ls [path]                  - Lists directory contents\n" +
                        "  cat <filePath>             - Displays file content\n" +
                        "  echo [text ...]            - Displays text\n" +
                        "  clear                      - Clears the terminal output\n" +
                        "  cd <path>                  - Changes current directory");
                    break;
                case 'ls':
                    try {
                        const targetPath = args.length > 0 ? resolvePath(args.join(' ')) : appWindow.dataset.terminalCwd;
                        const items = await WebOSFileSystem.listDirectory(targetPath);
                        if (items.length === 0) {
                            appendOutput("Directory is empty.");
                        } else {
                            items.forEach(item => appendOutput(`${item.type === 'directory' ? '[D]' : '[F]'} ${item.name}`));
                        }
                    } catch (e) {
                        appendOutput(e.message, 'error');
                    }
                    break;
                case 'cat':
                    if (args.length === 0) {
                        appendOutput("Usage: cat <filePath>", 'error');
                        break;
                    }
                    try {
                        const filePath = resolvePath(args.join(' ')).replace(/\/$/, ''); // remove trailing slash for files
                        const content = await WebOSFileSystem.readFile(filePath);
                        if (typeof content === 'object') {
                           appendOutput(JSON.stringify(content, null, 2));
                        } else {
                           appendOutput(content);
                        }
                    } catch (e) {
                        appendOutput(e.message, 'error');
                    }
                    break;
                case 'echo':
                    appendOutput(args.join(' '));
                    break;
                case 'clear':
                    outputElement.innerHTML = '';
                    break;
                case 'cd':
                    if (args.length === 0) {
                        appendOutput("Usage: cd <path>", 'error');
                        break;
                    }
                    try {
                        const newPathArg = args.join(' ');
                        let newPotentialPath = resolvePath(newPathArg);
                        if (!newPotentialPath.endsWith('/')) newPotentialPath += '/';

                        // Check if path exists and is a directory
                        // WebOSFileSystem.exists might need to understand directory paths (ending with /)
                        // A simple way: try to list it. If it fails, or lists nothing and it's not the same path, it's an issue.
                        // Or, if WebOSFileSystem.exists can confirm a directory, use that.
                        // For now, we assume any path given to cd could be valid and just set it.
                        // A robust 'cd' would verify the path is a valid directory.
                        // Let's try a pseudo-validation: list and see if it errors or is a known file

                        if (newPathArg.includes(':') && newPathArg.endsWith(':') && newPathArg.length === 2) { // e.g. "A:"
                             appWindow.dataset.terminalCwd = newPathArg + "/";
                        } else if (await WebOSFileSystem.exists(newPotentialPath) || await WebOSFileSystem.exists(newPotentialPath.slice(0,-1))) {
                            // Try listing to confirm it's directory-like.
                            // This is a bit of a hack. A proper 'isDirectory' or 'stat' function in FileSystem would be better.
                            let isDir = false;
                            try {
                                await WebOSFileSystem.listDirectory(newPotentialPath); // Throws if it's a file or invalid
                                isDir = true;
                            } catch(e_isDir) {
                                // If newPotentialPath is "C:/quota.txt/", listDirectory would fail.
                                // If it was "C:/", listDirectory on persistentStorageApiWrapper would work.
                                // If it was "A:/file.txt/", listDirectory would fail.
                                // We also need to handle if the path *is* a file.
                                const fileContent = await WebOSFileSystem.readFile(newPotentialPath.slice(0,-1));
                                if(fileContent !== null) { // It's a file
                                     isDir = false;
                                     appendOutput(`Path is a file: ${newPotentialPath.slice(0,-1)}`, 'error');
                                } else {
                                     isDir = true; // If readFile is null, it might be a dir or non-existent
                                }
                            }

                            if(isDir){
                                appWindow.dataset.terminalCwd = newPotentialPath;
                            }
                        } else {
                             appendOutput(`Path not found: ${newPotentialPath}`, 'error');
                        }
                    } catch (e) {
                        appendOutput(e.message, 'error');
                    }
                    break;
                default:
                    if (command.trim() !== '') {
                        appendOutput(`Unknown command: ${command}`, 'error');
                    }
            }
            updatePrompt();
            inputElement.value = '';
            inputElement.focus();
        };

        inputElement.addEventListener('keydown', (e) => {
            const history = JSON.parse(appWindow.dataset.terminalHistory);
            let historyIndex = parseInt(appWindow.dataset.terminalHistoryIndex, 10);

            if (e.key === 'Enter') {
                e.preventDefault();
                executeCommand(inputElement.value);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (history.length > 0 && historyIndex > 0) {
                    historyIndex--;
                } else if (history.length > 0 && historyIndex <= 0) {
                    historyIndex = 0; // Stay on the first item
                }
                 if(history[historyIndex]) inputElement.value = history[historyIndex];
                 appWindow.dataset.terminalHistoryIndex = historyIndex;
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (history.length > 0 && historyIndex < history.length - 1) {
                    historyIndex++;
                     if(history[historyIndex]) inputElement.value = history[historyIndex];
                } else {
                    historyIndex = history.length; // Point after last item
                    inputElement.value = ''; // Clear for new command
                }
                appWindow.dataset.terminalHistoryIndex = historyIndex;
            }
        });

        updatePrompt();
        inputElement.focus();
        appendOutput("Sour OS Terminal [Version 1.0.0]", "system");
        appendOutput("Type 'help' for a list of commands.", "system");
    }

    async function renderFileExplorer(appWindow, currentPathString) {
        const targetDiv = appWindow.querySelector('.file-explorer-main-area');
        if (!targetDiv) {
            console.error("Target div for file explorer not found in window:", appWindow);
            return;
        }

        appWindow.dataset.currentPath = currentPathString; // Update current path in DOM

        let html = '<div class="fe-nav" style="padding: 5px; background: #eee; border-bottom: 1px solid #ccc;">';
        let pathDisplayName = "";
        let items = []; // To store {name, type, fullPath (for files/folders)} or {name, type (drive), driveLetter}

        if (currentPathString === "") { // Drive listing view
            pathDisplayName = "Drives";
            html += `<button class="fe-up-btn" disabled>Up</button> `; // Disabled at drive list
            const drives = await WebOSFileSystem.getDrives(); // Assuming this returns an object like { A: { letter: 'A:', type: 'localStorage' }, ... }
            for (const driveKey in drives) {
                items.push({ name: `${drives[driveKey].letter} (${drives[driveKey].type})`, type: 'drive', driveLetter: drives[driveKey].letter });
            }
        } else { // Directory listing view
            pathDisplayName = currentPathString;
            html += `<button class="fe-up-btn">Up</button> `;
            try {
                const directoryContents = await WebOSFileSystem.listDirectory(currentPathString);
                directoryContents.forEach(item => {
                    items.push({
                        name: item.name,
                        type: item.type, // 'file' or 'directory'
                        // Construct full path for easy access, ensuring no double slashes if currentPathString ends with /
                        fullPath: (currentPathString.endsWith('/') ? currentPathString : currentPathString + '/') + item.name
                    });
                });
            } catch (error) {
                console.error(`Error listing directory ${currentPathString}:`, error);
                items.push({ name: `Error: ${error.message}`, type: 'error' });
                // Optionally, navigate up or to drive list on error
                // currentPathString = ""; // Go to drive list
                // pathDisplayName = "Drives (Error occurred)";
                // html = html.replace('<button class="fe-up-btn">Up</button>', '<button class="fe-up-btn" disabled>Up</button>');
            }
        }

        html += `<span>Path: ${pathDisplayName}</span></div>`;
        html += '<ul class="fe-item-list" style="list-style: none; padding: 5px; margin: 0; height: calc(100% - 30px); overflow-y: auto;">';

        if (items.length === 0 && currentPathString !== "") {
            html += '<li style="padding: 3px; color: #777;"><em>Empty directory</em></li>';
        } else if (items.length === 0 && currentPathString === "") {
             html += '<li style="padding: 3px; color: #777;"><em>No drives available.</em></li>';
        }


        items.forEach(item => {
            const icon = item.type === 'folder' || item.type === 'directory' ? '&#128193;' : (item.type === 'drive' ? '&#128187;' : '&#128196;'); // Folder, Drive, File icons
            html += `<li class="fe-item" data-name="${item.name}" data-type="${item.type}" ${item.driveLetter ? `data-drive-letter="${item.driveLetter}"` : ''} ${item.fullPath ? `data-full-path="${item.fullPath}"` : ''} style="padding: 3px; cursor: pointer; user-select:none;">`;
            html += `<span class="fe-item-icon">${icon}</span> ${item.name}`;
            html += '</li>';
        });
        html += '</ul>';
        targetDiv.innerHTML = html;

        // Add event listeners
        appWindow.querySelectorAll('.fe-item').forEach(itemElem => {
            itemElem.addEventListener('click', async () => {
                const itemName = itemElem.getAttribute('data-name');
                const itemType = itemElem.getAttribute('data-type');
                const currentPath = appWindow.dataset.currentPath; // Get current path from dataset

                if (itemType === 'drive') {
                    const driveLetter = itemElem.getAttribute('data-drive-letter');
                    renderFileExplorer(appWindow, driveLetter + '/'); // Navigate to root of the drive
                } else if (itemType === 'folder' || itemType === 'directory') {
                    const folderPath = itemElem.getAttribute('data-full-path');
                    renderFileExplorer(appWindow, folderPath + '/'); // Ensure trailing slash for directories
                } else if (itemType === 'file') {
                    const filePath = itemElem.getAttribute('data-full-path');
                    try {
                        const content = await WebOSFileSystem.readFile(filePath);
                        // For Drive C, content might be JSON or plain text.
                        let displayContent = content;
                        if (typeof content === 'object') { // For JSON objects from Drive C files like quota.txt
                            displayContent = JSON.stringify(content, null, 2);
                        }
                        alert(`File: ${itemName}\n\n${displayContent}`);
                    } catch (error) {
                        console.error(`Error reading file ${filePath}:`, error);
                        alert(`Error reading file ${itemName}: ${error.message}`);
                    }
                }
            });
        });

        const upButton = appWindow.querySelector('.fe-up-btn');
        if (upButton && !upButton.disabled) {
            upButton.addEventListener('click', () => {
                let currentPath = appWindow.dataset.currentPath;
                let newPath = ""; // Default to drive listing
                if (currentPath.endsWith('/')) { // Remove trailing slash for processing
                    currentPath = currentPath.slice(0, -1);
                }

                if (currentPath.includes('/')) { // If it's a path like "A:/folder" or "A:/folder/sub"
                    newPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                     // If newPath becomes "A:/", it's fine. If "A:", it should become "A:/" for consistency (or handled by listDirectory)
                } else if (currentPath.endsWith(':')) { // If it's a drive root like "A:"
                    newPath = ""; // Go to drive listing
                }
                // If currentPath is already "", up button should be disabled, so no specific handling needed here.
                renderFileExplorer(appWindow, newPath);
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
})();
