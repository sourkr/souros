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
        contentDiv.innerHTML = app.content; // In a real app, you'd build this more securely

        windowDiv.appendChild(header);
        windowDiv.appendChild(contentDiv);
        windowContainer.appendChild(windowDiv);

        openWindows[app.id] = windowDiv; // Track open window

        makeDraggable(windowDiv, header);

        windowDiv.addEventListener('mousedown', () => {
             windowDiv.style.zIndex = ++highestZIndex;
        });
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
