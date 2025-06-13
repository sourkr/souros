// public/os-files/browser-storage-driver.js
(function() {
    if (!navigator.storage || !window.caches) {
        console.warn("Browser Storage (navigator.storage or Cache API) not supported. browser-storage-driver will not be available.");
        return;
    }

    const CACHE_NAME_PREFIX = 'WebOS_BrowserStorageDriver_'; // Prefix for cache names
    let driveLetterForCache = 'C'; // Default, can be configured if driver is registered with a different letter

    // --- Helper Functions ---
    // Function to get the specific cache name for this drive
    function getCacheName() {
        return CACHE_NAME_PREFIX + driveLetterForCache;
    }

    // Function to format path for use as cache key (URL)
    // Ensures it's a valid URL, perhaps by prefixing with a dummy origin if needed.
    // For simplicity, paths like '/foo/bar.txt' will be used directly as request URLs.
    // Cache API keys are Request objects or URL strings.
    function formatPathToUrl(path) {
        // Basic formatting: ensure leading slash, treat as URL path part
        let p = path.startsWith('/') ? path : '/' + path;
        // Replace with a dummy origin for Request object, or use as is if cache.match allows partial paths (it does)
        // Using relative paths directly as cache keys (URL strings) is fine.
        return p;
    }

    // --- Driver State ---
    let fds = new Map();
    let fdCounter = 0;
    let closedFds = [];
    let metadataStore = new Map(); // In-memory metadata: { path: { type, size, created, modified, accessed } }
                                   // This is a simplification. Ideally, metadata would also be persisted.
                                   // For this version, metadata is ephemeral beyond cache content.

    // Initialize root directory metadata
    function initializeRootMetadata() {
        if (!metadataStore.has('/')) {
            const now = Date.now();
            metadataStore.set('/', { type: 'dir', size: 0, created: now, modified: now, accessed: now, content: '' });
        }
    }
    initializeRootMetadata(); // Call it once at driver setup

    // --- Core Driver Object ---
    const browserStorageDriver = {
        getStorageType: function() { return 'BrowserStorage (CacheAPI)'; },
        _getMetadata: function(path) { return metadataStore.get(this._formatPath(path)); },
        _setMetadata: function(path, meta) { metadataStore.set(this._formatPath(path), meta); },
        _removeMetadata: function(path) { metadataStore.delete(this._formatPath(path)); },
        _formatPath: function(path) { // Internal path normalization for metadata keys
            let p = path.startsWith('/') ? path : '/' + path;
            p = p.replace(/\/+/g, '/'); // No double slashes
            if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1); // No trailing slash for keys, except root
            return p || '/';
        },
        _getParentPath: function(path) {
            const fPath = this._formatPath(path);
            if (fPath === '/') return null;
            const lastSlash = fPath.lastIndexOf('/');
            if (lastSlash === 0) return '/'; // Parent is root
            return fPath.substring(0, lastSlash);
        },
        _getFileName: function(path) {
            const fPath = this._formatPath(path);
            if (fPath === '/') return '/';
            return fPath.substring(fPath.lastIndexOf('/') + 1);
        },

        driveSize: async function() {
            try {
                const estimate = await navigator.storage.estimate();
                return {
                    total: estimate.quota,
                    used: estimate.usage,
                    free: estimate.quota - estimate.usage
                };
            } catch (e) {
                console.error("browserStorageDriver: Error estimating storage quota", e);
                return { total: -1, used: -1, free: -1 }; // Indicate error or unknown
            }
        },

        open: async function(path, ...flags) {
            const fPath = this._formatPath(path);
            const urlPath = formatPathToUrl(fPath); // Path for Cache API

            const cache = await caches.open(getCacheName());
            const match = await cache.match(urlPath);

            let meta = this._getMetadata(fPath);

            if (!match && !meta) {
                console.warn(`browserStorageDriver.open: Path '${fPath}' not found (no cache entry or metadata).`);
                return -1;
            }

            if (!meta && match) {
                const responseBody = await match.text();
                meta = { type: 'file', size: responseBody.length, created: Date.now(), modified: Date.now(), accessed: Date.now() };
                this._setMetadata(fPath, meta);
                console.warn(`browserStorageDriver.open: Reconstructed basic metadata for '${fPath}' from cache.`);
            } else if (meta && !match && meta.type === 'file') {
                 console.warn(`browserStorageDriver.open: Metadata for file '${fPath}' exists, but no cache entry. File might be corrupted or partially deleted.`);
            }


            let fdId;
            if (closedFds.length > 0) {
                fdId = closedFds.shift();
            } else {
                fdId = fdCounter++;
            }
            fds.set(fdId, { path: fPath, flags: flags, metadata: meta, urlPath: urlPath });
            return fdId;
        },

        close: function(fd) {
            if (fds.has(fd)) {
                fds.delete(fd);
                closedFds.push(fd);
                return 0;
            }
            return -1;
        },

        stat: function(fd) {
            const entry = fds.get(fd);
            if (!entry) return null;
            return entry.metadata ? { ...entry.metadata } : null;
        },

        read: async function(fd) {
            const entry = fds.get(fd);
            if (!entry || !entry.metadata) return null;

            if (entry.metadata.type === 'dir') {
                return entry.metadata.content || "";
            }

            if (entry.metadata.type === 'file') {
                try {
                    const cache = await caches.open(getCacheName());
                    const response = await cache.match(entry.urlPath);
                    if (response) {
                        entry.metadata.accessed = Date.now();
                        this._setMetadata(entry.path, entry.metadata);
                        return await response.text();
                    }
                    console.warn(`browserStorageDriver.read: No cache entry for file '${entry.path}'`);
                    return null;
                } catch (e) {
                    console.error(`browserStorageDriver.read: Error reading file '${entry.path}' from cache:`, e);
                    return null;
                }
            }
            return null;
        },

        write: async function(fd, data) {
            const entry = fds.get(fd);
            if (!entry || !entry.metadata) return -1;

            if (entry.metadata.type === 'dir') {
                entry.metadata.content = data; // data is comma-separated child names
                entry.metadata.modified = Date.now();
                this._setMetadata(entry.path, entry.metadata);
                return 0;
            }

            if (entry.metadata.type === 'file') {
                try {
                    const cache = await caches.open(getCacheName());
                    const request = new Request(entry.urlPath);
                    const response = new Response(data);
                    await cache.put(request, response);

                    entry.metadata.size = data.length;
                    entry.metadata.modified = Date.now();
                    this._setMetadata(entry.path, entry.metadata);
                    return data.length;
                } catch (e) {
                    console.error(`browserStorageDriver.write: Error writing file '${entry.path}' to cache:`, e);
                    return -1;
                }
            }
            return -1;
        },

        _updateParentDir: function(parentPath, itemName, action) {
            if (!parentPath) return;
            let parentMeta = this._getMetadata(parentPath);
            if (parentMeta && parentMeta.type === 'dir') {
                let entries = (parentMeta.content || "").split(',').filter(Boolean);
                const initialLength = entries.length;
                if (action === 'add' && !entries.includes(itemName)) {
                    entries.push(itemName);
                } else if (action === 'remove') {
                    entries = entries.filter(name => name !== itemName);
                }

                if (entries.length !== initialLength || (action === 'add' && initialLength === 0 && entries.length === 1) ) {
                    parentMeta.content = entries.join(',');
                    parentMeta.modified = Date.now();
                    this._setMetadata(parentPath, parentMeta);
                }
            } else {
                 console.warn(`_updateParentDir: Parent path '${parentPath}' not found or not a directory during attempt to ${action} '${itemName}'.`);
            }
        },

        mkdir: async function(path) {
            const fPath = this._formatPath(path);
            if (this._getMetadata(fPath)) {
                console.warn(`browserStorageDriver.mkdir: Path '${fPath}' already exists.`);
                return -1;
            }
            const parentPath = this._getParentPath(fPath);
            if (parentPath) { // If not root
                const parentMeta = this._getMetadata(parentPath);
                if (!parentMeta) {
                     console.warn(`browserStorageDriver.mkdir: Parent path '${parentPath}' does not exist.`);
                    return -1;
                }
                if (parentMeta.type !== 'dir') {
                    console.warn(`browserStorageDriver.mkdir: Parent path '${parentPath}' is not a directory.`);
                    return -1;
                }
            }


            const now = Date.now();
            this._setMetadata(fPath, { type: 'dir', size: 0, created: now, modified: now, accessed: now, content: '' });
            if (parentPath) {
                this._updateParentDir(parentPath, this._getFileName(fPath), 'add');
            }
            console.log(`browserStorageDriver.mkdir: Directory '${fPath}' created (metadata only).`);
            return 0;
        },

        create: async function(path) {
            const fPath = this._formatPath(path);
            if (this._getMetadata(fPath)) {
                 console.warn(`browserStorageDriver.create: Path '${fPath}' already exists.`);
                return -1;
            }
            const parentPath = this._getParentPath(fPath);
            if (parentPath) { // If not root
                const parentMeta = this._getMetadata(parentPath);
                if (!parentMeta) {
                    console.warn(`browserStorageDriver.create: Parent path '${parentPath}' does not exist.`);
                    return -1;
                }
                if (parentMeta.type !== 'dir') {
                    console.warn(`browserStorageDriver.create: Parent path '${parentPath}' is not a directory.`);
                    return -1;
                }
            }

            const now = Date.now();
            this._setMetadata(fPath, { type: 'file', size: 0, created: now, modified: now, accessed: now });

            try {
                const cache = await caches.open(getCacheName());
                await cache.put(new Request(formatPathToUrl(fPath)), new Response(''));
            } catch (e) {
                console.error(`browserStorageDriver.create: Failed to create empty cache entry for '${fPath}'`, e);
                this._removeMetadata(fPath);
                return -1;
            }
            if (parentPath) {
                 this._updateParentDir(parentPath, this._getFileName(fPath), 'add');
            }
            console.log(`browserStorageDriver.create: File '${fPath}' created.`);
            return 0;
        },

        delete: async function(path) {
            const fPath = this._formatPath(path);
            const meta = this._getMetadata(fPath);
            if (!meta) {
                console.warn(`browserStorageDriver.delete: Path '${fPath}' not found.`);
                return -1;
            }
            if (meta.type !== 'file') {
                console.warn(`browserStorageDriver.delete: Path '${fPath}' is not a file. This driver's delete only supports files.`);
                return -1;
            }

            try {
                const cache = await caches.open(getCacheName());
                const deleted = await cache.delete(formatPathToUrl(fPath));
                if (!deleted) {
                    console.warn(`browserStorageDriver.delete: Cache entry for '${fPath}' not found or not deleted (may not be an error if it was never written).`);
                }
            } catch (e) {
                console.error(`browserStorageDriver.delete: Error deleting cache entry for '${fPath}'`, e);
                return -1;
            }

            this._removeMetadata(fPath);
            const parentPath = this._getParentPath(fPath);
            if (parentPath) {
                this._updateParentDir(parentPath, this._getFileName(fPath), 'remove');
            }
            console.log(`browserStorageDriver.delete: File '${fPath}' deleted.`);
            return 0;
        },

        readdir: async function(fd) {
            const entry = fds.get(fd);
            if (!entry || !entry.metadata || entry.metadata.type !== 'dir') {
                console.warn("browserStorageDriver.readdir: FD not found or not a directory.");
                return null;
            }
            return (entry.metadata.content || "").split(',').filter(Boolean);
        }
    };

    window.BrowserStorageDriverModule = {
        driver: browserStorageDriver,
        register: function(driveLetterToUse = 'C') {
            driveLetterForCache = driveLetterToUse.toUpperCase();
            initializeRootMetadata(); // Ensure root is there for the specific drive letter cache
            if (window.os && window.os.drives) {
                if (window.FileSystem) {
                    // We register the raw driver object, FileSystem class will wrap it when Drives.addDrive is called
                    window.os.drives.set(driveLetterForCache, browserStorageDriver);
                    console.log(`BrowserStorageDriver (raw) registered for Drive ${driveLetterForCache}. Kernal should use Drives.addDrive.`);
                } else {
                     window.os.drives.set(driveLetterForCache, browserStorageDriver);
                     console.warn(`BrowserStorageDriver registered raw for Drive ${driveLetterForCache}: (FileSystem class not found at registration time)`);
                }
            } else {
                console.error("BrowserStorageDriver: window.os.drives not found. Cannot register.");
            }
        }
    };
    console.log("browser-storage-driver.js loaded. Call BrowserStorageDriverModule.register('DRIVE_LETTER') to activate.");

})();
