// public/os-files/kernal.js
console.log("kernal.js: Loading...");

class Kernal {
    constructor() {
        this.driversLoaded = {
            localStorage: false,
            indexedDB: false,
            browserStorage: false // Placeholder for future driver
        };
        this.coreInitialized = false;
    }

    async initializeCore() {
        console.log("Kernal: Initializing core systems...");

        // Ensure window.os and window.os.drives exist (should be done by os-globals.js or earlier)
        if (!window.os || !window.os.drives) {
            console.error("Kernal: window.os or window.os.drives is not initialized! This should be done by os-globals.js or similar before kernal.js.");
            // Attempt to initialize os.drives as a fallback, though it's better if done earlier.
            window.os = window.os || {};
            window.os.drives = window.os.drives || new Map();
            console.warn("Kernal: Fallback initialization of window.os.drives. Review script load order.");
        }

        // At this point, storage.js should have already loaded and defined WebOSFileSystem and Drives.
        // Drivers (localstorage-driver.js, indexdb-driver.js) should also have been loaded
        // and registered themselves with window.os.drives.

        // Verify Drive A (localStorage) is ready
        if (window.WebOSFileSystem && window.WebOSFileSystem.getDrive('A') && window.WebOSFileSystem.getDrive('A').storage) {
            console.log("Kernal: Drive A (localStorage) is registered and seems ready.");
            this.driversLoaded.localStorage = true;
        } else {
            console.error("Kernal: Drive A (localStorage) not found or not ready! Ensure localstorage-driver.js is loaded before kernal.js and after storage.js.");
        }

        // Verify Drive B (IndexedDB) is ready
        if (window.WebOSFileSystem && window.WebOSFileSystem.getDrive('B') && window.WebOSFileSystem.getDrive('B').storage) {
            console.log("Kernal: Drive B (IndexedDB) is registered and seems ready.");
            this.driversLoaded.indexedDB = true;
        } else {
            console.warn("Kernal: Drive B (IndexedDB) not found or not ready. Ensure indexdb-driver.js is loaded if required.");
        }

        // Register and check BrowserStorageDriver (Drive C by default)
        if (window.BrowserStorageDriverModule && typeof window.BrowserStorageDriverModule.register === 'function') {
            window.BrowserStorageDriverModule.register('C'); // Register as Drive C
            // Note: BrowserStorageDriverModule.register now directly sets on window.os.drives
            // The FileSystem wrapper is applied when Drives.addDrive is called by kernal or relevant module.
            // For the check, we see if the raw driver is on window.os.drives.
            // A more complete check would be window.WebOSFileSystem.getDrive('C') if kernal ensures it's wrapped.
            // For now, this confirms the driver module did its part.
            if (window.os.drives.has('C')) { // Check if raw driver was set by its own register call
                console.log("Kernal: Drive C (BrowserStorage) is registered with os.drives. Kernal should further process it into WebOSFileSystem.");
                // To make it fully usable like other drives through WebOSFileSystem, it needs to be added via Drives.addDrive
                if (window.Drives && typeof window.Drives.addDrive === 'function' && window.os.drives.get('C')) {
                    if (!window.WebOSFileSystem.getDrive('C')) { // Check if not already fully added
                        window.Drives.addDrive('C', window.os.drives.get('C')); // Wrap the raw driver with FileSystem
                        if (window.WebOSFileSystem.getDrive('C') && window.WebOSFileSystem.getDrive('C').storage) {
                             console.log("Kernal: Drive C (BrowserStorage) successfully processed and available via WebOSFileSystem.");
                             this.driversLoaded.browserStorage = true;
                        } else {
                             console.error("Kernal: Drive C (BrowserStorage) failed to become fully available via WebOSFileSystem after addDrive.");
                        }
                    } else {
                         console.log("Kernal: Drive C (BrowserStorage) was already fully available via WebOSFileSystem.");
                         this.driversLoaded.browserStorage = true;
                    }
                } else {
                     console.warn("Kernal: Drives.addDrive not available or raw driver for C not found. Drive C may not be fully operational through WebOSFileSystem.");
                }
            } else {
                console.error("Kernal: Drive C (BrowserStorage) failed to register with os.drives even after calling register.");
            }
        } else {
            console.warn("Kernal: BrowserStorageDriverModule not found. Drive C will not be available. Ensure browser-storage-driver.js is loaded.");
        }

        // Load Desktop environment
        try {
            if (window.DesktopManager && typeof window.DesktopManager === 'function') {
                if (!window.desktopManager) { // Check if desktop.js already self-initialized
                    console.log("Kernal: DesktopManager class found, attempting to initialize...");
                    window.desktopManager = new DesktopManager(); // As per desktop.js's previous structure
                    window.desktopManager.loadDesktop(); // As per desktop.js's previous structure
                    console.log("Kernal: DesktopManager initialized by Kernal.");
                } else {
                     console.log("Kernal: DesktopManager already initialized (likely by desktop.js itself).");
                }
            } else {
                console.warn("Kernal: DesktopManager not found. Desktop environment might not load. Ensure desktop.js is loaded before kernal.js finishes initialization or is loaded by kernal.js.");
            }
        } catch (e) {
            console.error("Kernal: Error initializing desktop environment.", e);
        }

        this.coreInitialized = true;
        console.log("Kernal: Core systems initialization complete.");

        // Emit an event or call a function to signal OS readiness
        const event = new CustomEvent('osready', { detail: { kernal: this } });
        document.dispatchEvent(event);
        console.log("Kernal: 'osready' event dispatched.");
    }

    // Placeholder for other kernal functions, e.g., process management, IPC
}

window.kernal = new Kernal();
// Defer initialization until after the current script execution cycle,
// allowing other scripts that might be loaded in the same batch (like desktop.js) to define their globals.
setTimeout(() => {
    window.kernal.initializeCore().catch(err => {
        console.error("Kernal: Unhandled error during core initialization:", err);
    });
}, 0);

console.log("kernal.js: Loaded and initialization sequence started.");
