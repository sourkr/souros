// Enhanced localStorage Wrapper
const localStorageWrapper = {
    getItem: function(key) {
        return localStorage.getItem(key);
    },
    setItem: function(key, value) {
        localStorage.setItem(key, value);
    },
    removeItem: function(key) {
        localStorage.removeItem(key);
    },
    clear: function() {
        localStorage.clear();
    },
    key: function(index) {
        return localStorage.key(index);
    },
    length: function() {
        return localStorage.length;
    },
    getAllItems: function() {
        let items = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            items[key] = localStorage.getItem(key);
        }
        return items;
    }
};

// Persistent Storage Manager (for navigator.storage API)
const persistentStorageManager = {
    isPersistent: async function() {
        if (navigator.storage && navigator.storage.persisted) {
            return await navigator.storage.persisted();
        }
        console.warn("Persistent Storage API (persisted) not supported.");
        return false;
    },
    requestPersistence: async function() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const result = await navigator.storage.persist();
                console.log("Persistence requested, result:", result);
                return result;
            } catch (error) {
                console.error("Error requesting persistence:", error);
                return false;
            }
        }
        console.warn("Persistent Storage API (persist) not supported.");
        return false;
    },
    getEstimate: async function() {
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                console.log("Storage estimate:", estimate);
                return estimate;
            } catch (error) {
                console.error("Error getting storage estimate:", error);
                return { usage: 0, quota: 0, error: error.message };
            }
        }
        console.warn("Persistent Storage API (estimate) not supported.");
        return { usage: 0, quota: 0, warning: "API not supported" };
    }
};

// Wrapper for Persistent Storage API to be used by FileSystem (Drive C:)
const persistentStorageApiWrapper = {
    // Define a basePath similar to FileSystem for path normalization, though not strictly used by getItem itself yet
    basePath: 'C:/',

    getItem: async function(key) {
        // Normalize key: remove drive letter, ensure no leading/trailing slashes for direct comparison
        const normalizedKey = key.startsWith(this.basePath) ? key.substring(this.basePath.length) : key.replace(/^\/?/, '').replace(/\/$/, '');

        if (normalizedKey === 'quota.txt') {
            const estimate = await persistentStorageManager.getEstimate();
            return JSON.stringify(estimate, null, 2);
        }
        if (normalizedKey === 'status.txt') {
            const isPersistent = await persistentStorageManager.isPersistent();
            return `Persistence Status: ${isPersistent ? 'Enabled' : 'Disabled/Not Granted'}\n\nTo request persistence, you can call:\nnavigator.storage.persist().then(granted => console.log('Persistence granted:', granted));`;
        }
        // This is for FileSystem.listDirectory to recognize the root "directory"
        if (key === this.basePath || key === this.basePath.slice(0, -1) || normalizedKey === '') {
             return JSON.stringify({type: "directory", entries: {'quota.txt': {type: 'file'}, 'status.txt': {type: 'file'}}, created: Date.now()});
        }
        console.log(`persistentStorageApiWrapper: getItem(${key}) normalized to '${normalizedKey}' - not found`);
        return null;
    },
    setItem: function(key, value) {
        console.warn(`Drive C: (${key}) is informational and read-only. SetItem is not supported.`);
        return Promise.resolve();
    },
    removeItem: function(key) {
        console.warn(`Drive C: (${key}) is informational and read-only. RemoveItem is not supported.`);
        return Promise.resolve();
    },
    clear: function() {
        console.warn("Drive C: is informational and read-only. Clear is not supported.");
        return Promise.resolve();
    },
    getAllItems: async function() {
        const estimate = await persistentStorageManager.getEstimate();
        const isPersistent = await persistentStorageManager.isPersistent();
        return {
            // These keys are relative to the root of the drive.
            'quota.txt': JSON.stringify(estimate, null, 2),
            'status.txt': `Persistence Status: ${isPersistent ? 'Enabled' : 'Disabled/Not Granted'}`
        };
    },
    key: function(index) {
        if (index === 0) return 'quota.txt';
        if (index === 1) return 'status.txt';
        return null;
    },
    length: function() {
        return 2;
    }
};

// IndexedDB Wrapper
const indexedDBWrapper = {
    dbName: 'WebOS_FS_IndexedDB',
    storeName: 'filesStore',
    db: null,

    openDB: function() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = (event) => reject('Error opening IndexedDB: ' + event.target.errorCode);
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    },

    setItem: async function(id, value) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ id: id, value: value });
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error writing to IndexedDB: ' + event.target.errorCode);
        });
    },

    getItem: async function(id) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = (event) => resolve(event.target.result ? event.target.result.value : null);
            request.onerror = (event) => reject('Error reading from IndexedDB: ' + event.target.errorCode);
        });
    },

    removeItem: async function(id) {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error deleting from IndexedDB: ' + event.target.errorCode);
        });
    },

    clear: async function() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error clearing IndexedDB: ' + event.target.errorCode);
        });
    },

    getAllItems: async function() {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll(); // Use getAll() for simplicity
            request.onsuccess = (event) => {
                const items = {};
                event.target.result.forEach(item => {
                    items[item.id] = item.value;
                });
                resolve(items);
            };
            request.onerror = (event) => reject('Error getting all items from IndexedDB: ' + event.target.errorCode);
        });
    }
};

// Persistent Storage Wrapper (using localStorage by default, can be configured)
const persistentStorageWrapper = {
    driver: localStorageWrapper, // Default to localStorage

    setDriver: function(driverInstance) {
        this.driver = driverInstance;
        console.log(`Persistent storage driver set to: ${driverInstance === localStorageWrapper ? 'localStorage' : 'IndexedDB'}`);
    },

    isUsingLocalStorage: function() {
        return this.driver === localStorageWrapper;
    },

    isUsingIndexedDB: function() {
        return this.driver === indexedDBWrapper;
    },

    getItem: function(key) {
        return this.driver.getItem(key);
    },

    setItem: function(key, value) {
        return this.driver.setItem(key, value);
    },

    removeItem: function(key) {
        return this.driver.removeItem(key);
    },

    clear: function() {
        return this.driver.clear();
    },

    // Note: key() and length() are synchronous for localStorage but would need to be async for IndexedDB.
    // For simplicity, these might need adjustment or careful handling if directly exposing them.
    // For now, they reflect localStorage's behavior.
    key: function(index) {
        if (typeof this.driver.key === 'function') {
            return this.driver.key(index);
        }
        console.warn('key(index) is not directly supported by the current persistent storage driver.');
        return null;
    },

    length: function() {
        if (typeof this.driver.length === 'function') {
            return this.driver.length();
        }
        console.warn('length() is not directly supported by the current persistent storage driver. Use getAllItems and check its size.');
        return 0;
    },

    getAllItems: function() {
        if (typeof this.driver.getAllItems === 'function') {
            return this.driver.getAllItems();
        }
        console.warn('getAllItems() is not directly supported by the current persistent storage driver.');
        return {};
    }
};


// --- Unified FileSystem API ---
class FileSystem {
    constructor(driveLetter, storageAdapter) {
        this.driveLetter = driveLetter.toUpperCase();
        if (!/^[A-Z]:$/.test(this.driveLetter)) {
            throw new Error("Invalid drive letter format. Must be a single letter followed by a colon (e.g., 'A:').");
        }
        this.storage = storageAdapter;
        this.basePath = this.driveLetter + '/';
        this._initializeDrive();
    }

    _getStorageKey(normalizedPath) {
        if (this.storage === localStorageWrapper) {
            if (normalizedPath === this.basePath) { // e.g. "A:/"
                return ""; // Root directory listing key for localStorage
            }
            // Strips "A:/" prefix to get "foo/bar.txt" or "foo/"
            return normalizedPath.substring(this.basePath.length);
        }
        return normalizedPath; // For other adapters, path is the key
    }

    async _initializeDrive() {
        // Check if the drive has a root directory structure. If not, create it.
        // This is more conceptual for flat key-value stores but good for path logic.
        const storageKey = this._getStorageKey(this.basePath);
        const rootDir = await this.storage.getItem(storageKey);
        if (!rootDir) {
            // For localStorage/IndexedDB, we might store a marker or a serialized directory object.
            // For simplicity, we'll assume paths are keys and their content is the value.
            // A "directory" can be represented by a key ending in '/' or a special value.
            // We'll implicitly create directories as needed by writeFile.
            // For now, just log initialization.
            console.log(`Drive ${this.driveLetter} initialized with ${this.storage === localStorageWrapper ? 'localStorage' : 'IndexedDB'}.`);
        }
    }

    _normalizePath(path) {
        if (!path.startsWith(this.basePath)) {
            if (path.startsWith('/')) {
                path = this.basePath + path.substring(1);
            } else {
                path = this.basePath + path;
            }
        }
        // Remove trailing slashes unless it's the root itself
        // For localStorage, keys for directories should end with '/', except for the root "" key.
        if (this.storage === localStorageWrapper && path === this.basePath) {
             // Root of Drive A, _getStorageKey handles this to ""
        } else if (path !== this.basePath && path.endsWith('/')) {
           // For files or non-root directories, _normalizePath might remove trailing slash.
           // Let's ensure createDirectory adds it back before calling _getStorageKey if needed.
           // For files, it should be removed.
           // The _getStorageKey method expects normalizedPath which has this logic.
        }
         // This normalization is tricky. Let's simplify: _normalizePath always ensures / for dirs except root.
         // And _getStorageKey handles the final transformation.
        // The existing _normalizePath seems mostly fine, but let's re-evaluate its interaction with _getStorageKey.
        // _normalizePath: "A:/foo/" -> "A:/foo/" ; "A:/file.txt" -> "A:/file.txt" ; "A:/" -> "A:/"
        // _getStorageKey will then convert these.
        // If path is "A:/foo/" (directory), normalizedPath is "A:/foo". _getStorageKey needs to handle this.
        // Let's adjust _normalizePath for directories to consistently end with /
        // and for files to not end with /.
        // However, the current _normalizePath is used by many places.
        // Let's stick to the defined _normalizePath and make _getStorageKey robust.
        // _normalizePath removes trailing slash for non-root.
        // So "A:/foo/" becomes "A:/foo". We need to add it back for directory keys in localStorage.
        // This is getting complex. Let's assume _normalizePath is as is.
        // _getStorageKey needs to be smart.
        // Let's reconsider: _normalizePath for a directory path "A:/foo/" results in "A:/foo".
        // This is what we want for `createDirectory` to then append a slash to before calling `_getStorageKey`.
        // For writeFile, "A:/foo/file.txt" is fine.
        // For readFile for a directory "A:/foo/", it will be "A:/foo".
        // This might be okay if directory data is stored under the key "foo" not "foo/".
        // The current code stores directory JSON under "A:/foo/" (full path).
        // This needs to be consistent.

        // Simpler: _normalizePath for "A:/foo/" -> "A:/foo".
        // If we intend it as a directory key, we add "/" back before _getStorageKey.
        // This is what createDirectory does.
        // For writeFile, it will be "A:/foo/file.txt".
        // For readFile, for "A:/foo/file.txt", it's "A:/foo/file.txt". For dir "A:/foo/", it's "A:/foo".

        // The current _normalizePath:
        // - "A:/foo/" -> "A:/foo" (if not this.basePath)
        // - "A:/" -> "A:/"
        // - "A:/file.txt" -> "A:/file.txt"
        // This is problematic for directory keys if we expect them to end with '/'.
        // Let's refine _normalizePath slightly for directories.

        if (path !== this.basePath && path.endsWith('/') && this.storage !== localStorageWrapper) { // Keep trailing slash for non-LS directory paths
            // For LS, we handle slash in _getStorageKey or rely on createDirectory adding it.
            // Actually, _getStorageKey should get the pure path.
            // The calling function (e.g. createDirectory) should ensure dirPath ends with / if that's the convention.
        } else if (path !== this.basePath && path.endsWith('/')) {
             path = path.slice(0, -1); // Original behavior
        }
        return path.replace(/\/\//g, '/'); // Replace double slashes
    }

    async writeFile(filePath, content) {
        const normalizedPath = this._normalizePath(filePath); // e.g. A:/foo/bar.txt
        const storageKey = this._getStorageKey(normalizedPath); // e.g. foo/bar.txt

        if (typeof content !== 'string') {
            try {
                content = JSON.stringify(content);
            } catch (e) {
                console.error("Failed to stringify content for writeFile:", e);
                throw new Error("Content must be a string or JSON serializable object.");
            }
        }
        try {
            await this.storage.setItem(storageKey, content);
            console.log(`File written: ${normalizedPath} (key: ${storageKey})`);

            // Update parent directory listing if we implement directory tracking
            // For now, this is a simplified model.
            this._updateDirectoryListing(normalizedPath, 'file');

        } catch (error) {
            console.error(`Error writing file ${normalizedPath}:`, error);
            throw error;
        }
    }

    async readFile(filePath) {
        const normalizedPath = this._normalizePath(filePath); // e.g. A:/foo/bar.txt or A:/foo (for dir)
        const storageKey = this._getStorageKey(normalizedPath); // e.g. foo/bar.txt or foo
        try {
            const content = await this.storage.getItem(storageKey);
            if (content === null) {
                console.warn(`File not found: ${normalizedPath} (key: ${storageKey})`);
                return null; // Or throw new Error('File not found');
            }
            console.log(`File read: ${normalizedPath}`);
            // Attempt to parse if it looks like JSON, otherwise return as string
            try {
                return JSON.parse(content);
            } catch (e) {
                return content;
            }
        } catch (error) {
            console.error(`Error reading file ${normalizedPath}:`, error);
            throw error;
        }
    }

    async deleteFile(filePath) {
        const normalizedPath = this._normalizePath(filePath); // e.g. A:/foo/bar.txt or A:/foo (for dir)
        const storageKey = this._getStorageKey(normalizedPath); // e.g. foo/bar.txt or foo
        try {
            // If it's a directory for localStorage, the key might need a trailing slash.
            // The createDirectory ensures keys for directories end with '/' (except root).
            // deleteFile for a directory "A:/foo/" -> normalized "A:/foo" -> key "foo"
            // We need to ensure we try deleting "foo/" if it was a directory.
            // This implies _getStorageKey or the caller needs to handle this.
            // Let's assume createDirectory stores "foo/" for "A:/foo/"
            // So, if filePath is "A:/foo/", normalizedPath is "A:/foo".
            // _getStorageKey("A:/foo") is "foo".
            // We need to decide if deleteFile("A:/foo/") should delete key "foo" or "foo/"
            // For now, let's assume it implies deleting the item itself.
            // If it's a directory, its *contents* are not handled here, only the directory marker.
            // The `rename` logic for directories handles recursive deletion of contents.
            // This is simplified for now. A specific deleteDirectory would be better.

            let keyToDelete = storageKey;
            if (this.storage === localStorageWrapper && filePath.endsWith('/')) {
                 // If original path indicated directory, ensure storage key for LS also implies directory
                 if (normalizedPath !== this.basePath && !keyToDelete.endsWith('/')) {
                    keyToDelete += '/';
                 }
            }

            await this.storage.removeItem(keyToDelete);
            console.log(`File/Dir deleted: ${normalizedPath} (key: ${keyToDelete})`);
            // Update parent directory listing
             this._removeDirectoryEntry(normalizedPath); // Uses full normalizedPath
        } catch (error) {
            console.error(`Error deleting file ${normalizedPath}:`, error);
            throw error;
        }
    }

    async createFile(filePath, content = '') { // Similar to writeFile, but maybe for empty files
        return this.writeFile(filePath, content);
    }

    async createDirectory(dirPath) {
        let normalizedPath = this._normalizePath(dirPath);
        // Ensure directory paths end with a slash for consistency in this model
        let dirPathForStorage = normalizedPath;
        if (!dirPathForStorage.endsWith('/')) {
            dirPathForStorage += '/';
        }
        // dirPathForStorage is now e.g. "A:/foo/" or "A:/"

        const storageKey = this._getStorageKey(dirPathForStorage); // e.g. "foo/" or ""

        // In a key-value store, a directory can be an empty string or a special marker.
        // Or, its existence is implied by files within it.
        // We'll store a marker to signify it's a directory.
        try {
            const existing = await this.storage.getItem(storageKey);
            if (existing !== null) {
                // Potentially check if it's already a directory marker
                // For now, if it exists, we assume it's fine or was intended.
                console.log(`Directory already exists or path conflict: ${normalizedPath} (key: ${storageKey})`);
                return;
            }
            await this.storage.setItem(storageKey, JSON.stringify({type: "directory", created: Date.now()}));
            console.log(`Directory created: ${normalizedPath} (key: ${storageKey})`);

            this._updateDirectoryListing(dirPathForStorage, 'directory'); // Use path that ends with /
        } catch (error) {
            console.error(`Error creating directory ${normalizedPath}:`, error);
            throw error;
        }
    }

    async _updateDirectoryListing(itemPath, itemType) { // itemPath is full path e.g. A:/foo/bar.txt or A:/foo/
        const parentPath = this._getParentPath(itemPath); // e.g. A:/foo/ or A:/
        if (!parentPath) return;

        const storageParentPath = this._getStorageKey(parentPath); // e.g. foo/ or ""

        let parentDirContent = await this.storage.getItem(storageParentPath);
        let dirListing;
        try {
            dirListing = parentDirContent ? JSON.parse(parentDirContent) : { type: "directory", entries: {}, created: Date.now() };
            if(dirListing.type !== "directory") {
                console.warn(`Path ${parentPath} (key: ${storageParentPath}) was a file, converting to directory to add entries.`);
                dirListing = { type: "directory", entries: {}, created: Date.now() };
            }
        } catch(e) {
             dirListing = { type: "directory", entries: {}, created: Date.now() };
        }

        if(!dirListing.entries) dirListing.entries = {};

        // itemPath could be "A:/foo/bar.txt" or "A:/foo/" (if it's a directory being created)
        // parentPath is "A:/foo/" or "A:/"
        // itemName should be "bar.txt" or "foo" (if itemPath is "A:/foo/")
        let itemName = itemPath.substring(parentPath.length).replace(/^\//, '');
        if(itemPath.endsWith('/')) itemName = itemName.slice(0,-1);


        dirListing.entries[itemName] = { type: itemType };

        await this.storage.setItem(storageParentPath, JSON.stringify(dirListing));
        console.log(`Updated dir listing for ${parentPath} (key: ${storageParentPath}) - added ${itemName}`);
    }

    async _removeDirectoryEntry(itemPath) { // itemPath is full path e.g. A:/foo/bar.txt or A:/foo/
        const parentPath = this._getParentPath(itemPath); // e.g. A:/foo/ or A:/
        if (!parentPath) return;

        const storageParentPath = this._getStorageKey(parentPath); // e.g. foo/ or ""

        let parentDirContent = await this.storage.getItem(storageParentPath);
        if (!parentDirContent) return;

        let dirListing;
        try {
            dirListing = JSON.parse(parentDirContent);
            if(dirListing.type !== "directory" || !dirListing.entries) return;
        } catch(e) {
            return;
        }

        let itemName = itemPath.substring(parentPath.length).replace(/^\//, '');
        if(itemPath.endsWith('/')) itemName = itemName.slice(0,-1);

        if (dirListing.entries[itemName]) {
            delete dirListing.entries[itemName];
            await this.storage.setItem(storageParentPath, JSON.stringify(dirListing));
            console.log(`Updated dir listing for ${parentPath} (key: ${storageParentPath}) - removed ${itemName}`);
        }
    }


    _getParentPath(filePath) {
        const normalizedPath = this._normalizePath(filePath);
        if (normalizedPath === this.basePath || normalizedPath === this.basePath.slice(0,-1)) { // Root directory
            return null;
        }
        // For "A:/foo/bar.txt", parent is "A:/foo/"
        // For "A:/foo/", parent is "A:/"
        let lastSlash = normalizedPath.lastIndexOf('/');
        if (lastSlash === -1 || lastSlash === normalizedPath.length -1) { // if path is "A:/foo" or "A:/foo/"
             lastSlash = normalizedPath.slice(0, normalizedPath.length -1).lastIndexOf('/');
        }


        if (lastSlash <= this.basePath.length -1) { // Parent is root
            return this.basePath;
        }
        return normalizedPath.substring(0, lastSlash + 1);
    }


    async listDirectory(dirPath = '') {
        const normalizedDirPath = this._normalizePath(dirPath + '/'); // Ensure it ends with a slash for dir
        console.log(`Listing directory: ${normalizedDirPath} using adapter type ${this.getStorageType()}`);

        // Handle Drive C (PersistentStorageAPI) specifically for listing
        if (this.storage === persistentStorageApiWrapper) {
            // persistentStorageApiWrapper.getAllItems() returns an object like {'quota.txt': "...", 'status.txt': "..."}
            // These are all considered to be in the "root" of this informational drive.
            // We only list items if the requested path is the root of Drive C.
            if (normalizedDirPath === this.basePath) { // e.g., C:/
                const items = await this.storage.getAllItems(); // This gets {'quota.txt': ..., 'status.txt': ...}
                return Object.keys(items).map(key => ({
                    name: key, // 'quota.txt', 'status.txt'
                    type: 'file' // All items in persistentStorageApiWrapper are virtual files
                }));
            } else {
                // No subdirectories are defined or supported for this drive type
                console.log(`No subdirectories supported for Drive C. Path: ${normalizedDirPath}`);
                return [];
            }
        }

        // Attempt to read the directory object itself first
        // normalizedDirPath is full path e.g. A:/foo/ or A:/
        const storageDirPathKey = this._getStorageKey(normalizedDirPath); // e.g. foo/ or ""
        const dirObjectString = await this.storage.getItem(storageDirPathKey);

        if (dirObjectString) {
            try {
                const dirObject = JSON.parse(dirObjectString);
                if (dirObject && dirObject.type === "directory" && dirObject.entries) {
                     console.log(`Listing from directory object for ${normalizedDirPath} (key: ${storageDirPathKey}):`, dirObject.entries);
                    return Object.keys(dirObject.entries).map(name => ({
                        name,
                        type: dirObject.entries[name].type
                    }));
                }
            } catch (e) {
                 console.warn(`Could not parse directory object for ${normalizedDirPath} (key: ${storageDirPathKey}), falling back to prefix scan if applicable. Error:`, e);
            }
        }

        // Fallback: Scan all keys (primarily for localStorageWrapper if explicit dir objects aren't perfectly maintained or for initial migration)
        if (this.storage === localStorageWrapper) {
            const allItems = await this.storage.getAllItems(); // These keys are already stripped for LS
            if (!allItems) return [];
            const entries = new Set();
            // storageDirPathKey is like "foo/" or "" (for root)

            for (const key in allItems) { // key is like "foo/bar.txt" or "config.json" or "foo/"
                if (storageDirPathKey === "") { // Root directory listing
                    if (!key.includes('/')) { // File or empty dir marker at root
                        if (key.endsWith('/')) { // "somedir/"
                             entries.add(JSON.stringify({ name: key.slice(0,-1), type: 'directory' }));
                        } else { // "file.txt"
                             entries.add(JSON.stringify({ name: key, type: 'file' }));
                        }
                    } else { // "foo/bar.txt" or "foo/subdir/" -> "foo" is a directory at root
                        entries.add(JSON.stringify({ name: key.substring(0, key.indexOf('/')), type: 'directory' }));
                    }
                } else { // Subdirectory listing, storageDirPathKey is "foo/"
                    if (key.startsWith(storageDirPathKey) && key !== storageDirPathKey) {
                        const relativePath = key.substring(storageDirPathKey.length); // "bar.txt" or "subdir/" or "subdir/file.txt"
                        const firstSlashIndex = relativePath.indexOf('/');
                        let entryName = relativePath;
                        let type = 'file';

                        if (firstSlashIndex !== -1) { // "subdir/file.txt" or "subdir/"
                            entryName = relativePath.substring(0, firstSlashIndex);
                            type = 'directory';
                        } else if (relativePath.endsWith('/')) { // "subdir/" (empty directory marker)
                             type = 'directory';
                             entryName = relativePath.slice(0,-1);
                        }
                        // else it's a file like "bar.txt"

                        if(entryName) entries.add(JSON.stringify({ name: entryName, type }));
                    }
                }
            }
            const parsedEntries = Array.from(entries).map(item => JSON.parse(item));
            console.log(`Directory listing for ${normalizedDirPath} (localStorage prefix scan, key: ${storageDirPathKey}):`, parsedEntries);
            return parsedEntries;
        } else {
             // For other adapters like IndexedDB, the getItem(normalizedDirPath) for dir object is expected to work.
             // If not, their getAllItems() would return full paths, requiring different prefix logic.
             // The current code assumes non-localStorage adapters use the explicit dir object model primarily.
            console.log(`No directory object found for ${normalizedDirPath} and prefix scan not implemented for this adapter type.`);
            return [];
        }
    }

     async exists(path) {
        const normalizedPath = this._normalizePath(path); // e.g. A:/foo/bar.txt or A:/foo
        const storageKey = this._getStorageKey(normalizedPath); // e.g. foo/bar.txt or foo

        let item = await this.storage.getItem(storageKey);
        if (item !== null) return true;

        // If it's potentially a directory for localStorage, the key might need a trailing slash
        if (this.storage === localStorageWrapper && !storageKey.endsWith('/') && normalizedPath !== this.basePath) {
            const dirStorageKey = storageKey + '/';
            item = await this.storage.getItem(dirStorageKey);
            if (item !== null) return true;
        } else if (this.storage !== localStorageWrapper) {
            // For other storages, if path was "A:/foo", normalizedPath is "A:/foo".
            // If a directory marker is stored with "A:/foo/", we need to check that.
            const directoryMarkerPath = normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/';
            if (normalizedPath !== directoryMarkerPath) { // Avoid re-checking same key if already ends with /
                 const dirStorageKey = this._getStorageKey(directoryMarkerPath); // Should be same as normalizedPath if not LS
                 item = await this.storage.getItem(dirStorageKey);
                 if (item !== null) return true;
            }
        }
        return false;
    }

    async rename(oldPath, newPath) {
        const normalizedOldPath = this._normalizePath(oldPath); // e.g. A:/foo/bar.txt or A:/foo
        const normalizedNewPath = this._normalizePath(newPath); // e.g. A:/foo/baz.txt or A:/bar

        if (normalizedOldPath === normalizedNewPath) return;

        // Determine if renaming a directory based on original path ending with /
        // or by trying to read its content as a directory object.
        let isDirectory = oldPath.endsWith('/');
        let content = await this.readFile(normalizedOldPath); // readFile uses _getStorageKey

        if (!isDirectory && content && typeof content === 'object' && content.type === 'directory') {
            isDirectory = true; // It's a directory object, even if path didn't end with /
        }
         if (content === null && !isDirectory) { // If content is null, and not explicitly a dir path, it might be an empty dir marker
            if(await this.exists(oldPath + '/')) isDirectory = true;
         }


        if (isDirectory) {
            let oldDirPathFull = oldPath; // Original full path for listDirectory
            if(!oldDirPathFull.endsWith('/')) oldDirPathFull += '/';

            let newDirPathFull = newPath;
            if(!newDirPathFull.endsWith('/')) newDirPathFull += '/';

            // Storage keys for the directory markers themselves
            const storageOldDirPath = this._getStorageKey(oldDirPathFull); // e.g. foo/ or olddir/
            const storageNewDirPath = this._getStorageKey(newDirPathFull); // e.g. bar/ or newdir/

            await this.createDirectory(newDirPathFull); // Create new directory marker (uses _getStorageKey internally)

            const entries = await this.listDirectory(oldDirPathFull); // listDirectory uses full paths
            for (const entry of entries) {
                const oldEntryFullPath = oldDirPathFull + entry.name + (entry.type === 'directory' ? '/' : '');
                const newEntryFullPath = newDirPathFull + entry.name + (entry.type === 'directory' ? '/' : '');
                await this.rename(oldEntryFullPath, newEntryFullPath); // Recursive call with full paths
            }

            await this.storage.removeItem(storageOldDirPath); // Delete old directory marker (using its storage key)
            this._removeDirectoryEntry(oldDirPathFull);
            this._updateDirectoryListing(newDirPathFull, 'directory');

        } else { // It's a file
            if (content === null) throw new Error(`Source file does not exist: ${oldPath}`);
            const storageOldFilePath = this._getStorageKey(normalizedOldPath);
            const storageNewFilePath = this._getStorageKey(normalizedNewPath);

            const contentToWrite = typeof content === 'string' ? content : JSON.stringify(content);
            await this.storage.setItem(storageNewFilePath, contentToWrite);
            await this.storage.removeItem(storageOldFilePath);

            this._removeDirectoryEntry(normalizedOldPath);
            this._updateDirectoryListing(normalizedNewPath, 'file');
        }
        console.log(`Renamed ${oldPath} to ${newPath}`);
    }

    getDriveLetter() {
        return this.driveLetter;
    }

    getStorageType() {
        if (this.storage === localStorageWrapper) return 'localStorage';
        if (this.storage === indexedDBWrapper) return 'IndexedDB';
        if (this.storage === persistentStorageApiWrapper) return 'PersistentStorageAPI';
        return 'unknown';
    }
}


// --- Drive Management ---
const Drives = {
    A: new FileSystem('A:', localStorageWrapper), // Drive A uses localStorage
    B: window.indexedDB ? new FileSystem('B:', indexedDBWrapper) : null, // Drive B uses IndexedDB, if available
    C: (navigator.storage && navigator.storage.estimate) ? new FileSystem('C:', persistentStorageApiWrapper) : null,

    getDrive: function(letter) {
        const drive = letter.toUpperCase();
        if (this[drive]) {
            return this[drive];
        }
        console.warn(`Drive ${drive} not found or not initialized.`);
        return null;
    },

    addDrive: function(letter, storageAdapter) {
        const drive = letter.toUpperCase();
        if (this[drive]) {
            console.warn(`Drive ${drive} already exists. Cannot overwrite.`);
            return null;
        }
        if (!/^[A-Z]$/.test(drive)) {
            console.error("Invalid drive letter for addDrive. Must be a single letter.");
            return null;
        }
        this[drive] = new FileSystem(drive + ':', storageAdapter);
        console.log(`Drive ${drive}: added with ${storageAdapter === localStorageWrapper ? 'localStorage' : storageAdapter === indexedDBWrapper ? 'IndexedDB' : 'custom adapter'}.`);
        return this[drive];
    }
};

// Expose the FileSystem API globally, namespaced under WebOS
window.WebOSFileSystem = {
    // Unified access methods, defaults to Drive A if not specified
    // Or requires full path like 'A:/file.txt'
    _getDriveAndPath: function(fullPath) {
        if (!fullPath || typeof fullPath !== 'string' || fullPath.indexOf(':') === -1) {
            throw new Error("Invalid path. Must include drive letter (e.g., 'A:/path/to/file.txt').");
        }
        const driveLetter = fullPath.substring(0, 1).toUpperCase();
        const path = fullPath.substring(2); // Remove 'A:' part

        const drive = Drives.getDrive(driveLetter);
        if (!drive) {
            throw new Error(`Drive ${driveLetter} not available.`);
        }
        return { drive, path };
    },

    writeFile: async function(fullPath, content) {
        const { drive, path } = this._getDriveAndPath(fullPath);
        return drive.writeFile(path, content);
    },

    readFile: async function(fullPath) {
        const { drive, path } = this._getDriveAndPath(fullPath);
        return drive.readFile(path);
    },

    deleteFile: async function(fullPath) {
        const { drive, path } = this._getDriveAndPath(fullPath);
        return drive.deleteFile(path);
    },

    createFile: async function(fullPath, content = '') {
        const { drive, path } = this._getDriveAndPath(fullPath);
        return drive.createFile(path, content);
    },

    createDirectory: async function(fullPath) {
        const { drive, path } = this._getDriveAndPath(fullPath);
        return drive.createDirectory(path);
    },

    listDirectory: async function(fullPath = 'A:/') { // Default to listing root of A:
        const { drive, path } = this._getDriveAndPath(fullPath);
        return drive.listDirectory(path);
    },

    exists: async function(fullPath) {
        const { drive, path } = this._getDriveAndPath(fullPath);
        return drive.exists(path);
    },

    rename: async function(oldFullPath, newFullPath) {
        const { drive: oldDrive, path: oldPath } = this._getDriveAndPath(oldFullPath);
        const { drive: newDrive, path: newPath } = this._getDriveAndPath(newFullPath);

        if (oldDrive !== newDrive) {
            // Cross-drive rename: read from old, write to new, then delete old.
            // This is a copy then delete operation.
            console.log(`Performing cross-drive rename from ${oldFullPath} to ${newFullPath}`);
            const content = await oldDrive.readFile(oldPath); // Assuming readFile handles directory content appropriately if needed
            // Or, if it's a directory, need to recursively copy contents.
            // For simplicity, this example might only handle files for cross-drive rename directly.
            // A full implementation would check if oldPath is a dir and copy recursively.
            if (oldFullPath.endsWith('/')) { // Heuristic for directory
                 console.warn("Cross-drive rename of directories needs recursive copy. This basic version may not fully support it.");
                 await newDrive.createDirectory(newPath); // Create target directory
                 // Implement recursive copy logic here
                 const entries = await oldDrive.listDirectory(oldPath);
                 for (const entry of entries) {
                     const oldEntryFullPath = oldFullPath + entry.name + (entry.type === 'directory' ? '/' : '');
                     const newEntryFullPath = newFullPath + entry.name + (entry.type === 'directory' ? '/' : '');
                     await this.rename(oldEntryFullPath, newEntryFullPath); // Recursive call
                 }
                 await oldDrive.deleteFile(oldPath); // Or a specific deleteDirectory if available

            } else {
                await newDrive.writeFile(newPath, content); // Assumes writeFile stringifies if needed
                await oldDrive.deleteFile(oldPath);
            }

        } else {
            // Same drive rename
            return oldDrive.rename(oldPath, newPath);
        }
    },

    getDrive: function(letter) {
        return Drives.getDrive(letter);
    },

    getDrives: function() {
        const driveInfo = {};
        for (const key in Drives) {
            if (Drives.hasOwnProperty(key) && Drives[key] instanceof FileSystem) {
                driveInfo[key] = {
                    letter: Drives[key].getDriveLetter(),
                    type: Drives[key].getStorageType()
                };
            }
        }
        return driveInfo;
    },
    // Utility to switch persistentStorageWrapper's driver
    switchToIndexedDBForPersistentStorage: function() {
        if (window.indexedDB) {
            persistentStorageWrapper.setDriver(indexedDBWrapper);
            console.log("Switched persistentStorageWrapper to use IndexedDB.");
        } else {
            console.warn("IndexedDB is not available. persistentStorageWrapper remains on localStorage.");
        }
    },
    switchToLocalStorageForPersistentStorage: function() {
        persistentStorageWrapper.setDriver(localStorageWrapper);
        console.log("Switched persistentStorageWrapper to use localStorage.");
    }
};


// --- Example Usage (logging to console) ---
(async () => {
    if (typeof window === 'undefined' || (window.location && (window.location.pathname.includes('install.html') || window.location.pathname.includes('installer.html')))) {
        // Don't run example usage if not in the main app context or if it's the installer itself
        return;
    }
    console.log("--- FileSystem API Example Usage ---");

    // To use Drive B (IndexedDB) for some operations:
    if (Drives.B) {
        console.log("Drive B (IndexedDB) is available.");
        // Example: Switch persistentStorageWrapper to use IndexedDB if desired
        // WebOSFileSystem.switchToIndexedDBForPersistentStorage();
    } else {
        console.log("Drive B (IndexedDB) is not available/initialized for these examples.");
    }

    try {
        // Create a directory
        await WebOSFileSystem.createDirectory('A:/mydocs');
        await WebOSFileSystem.createDirectory('A:/mydocs/textfiles');
        if (Drives.B) await WebOSFileSystem.createDirectory('B:/mydata');

        // Write a file
        await WebOSFileSystem.writeFile('A:/mydocs/textfiles/example.txt', 'Hello World from FileSystem API!');
        await WebOSFileSystem.writeFile('A:/mydocs/config.json', { settings: { theme: 'dark' } });

        // Read a file
        const content = await WebOSFileSystem.readFile('A:/mydocs/textfiles/example.txt');
        console.log('Read from A:/mydocs/textfiles/example.txt:', content);

        const config = await WebOSFileSystem.readFile('A:/mydocs/config.json');
        console.log('Read from A:/mydocs/config.json:', config);


        // List root directory of A:
        let rootFilesA = await WebOSFileSystem.listDirectory('A:/');
        console.log('Files in A:/ (root):', rootFilesA);

        // List a specific directory
        let mydocsFiles = await WebOSFileSystem.listDirectory('A:/mydocs/');
        console.log('Files in A:/mydocs/:', mydocsFiles);

        let textFiles = await WebOSFileSystem.listDirectory('A:/mydocs/textfiles/');
        console.log('Files in A:/mydocs/textfiles/:', textFiles);


        // Check existence
        console.log('Exists A:/mydocs/textfiles/example.txt:', await WebOSFileSystem.exists('A:/mydocs/textfiles/example.txt'));
        console.log('Exists A:/mydocs/nonexistent.txt:', await WebOSFileSystem.exists('A:/mydocs/nonexistent.txt'));
        console.log('Exists A:/mydocs/textfiles/ (directory):', await WebOSFileSystem.exists('A:/mydocs/textfiles/'));


        // Rename a file
        await WebOSFileSystem.rename('A:/mydocs/textfiles/example.txt', 'A:/mydocs/textfiles/renamed_example.txt');
        console.log('Renamed example.txt. Listing A:/mydocs/textfiles/ again:');
        console.log(await WebOSFileSystem.listDirectory('A:/mydocs/textfiles/'));

        // Rename a directory
        await WebOSFileSystem.rename('A:/mydocs/textfiles/', 'A:/mydocs/renamed_textfiles/');
        console.log('Renamed textfiles directory. Listing A:/mydocs/ again:');
        console.log(await WebOSFileSystem.listDirectory('A:/mydocs/'));
        console.log('Listing A:/mydocs/renamed_textfiles/:');
        console.log(await WebOSFileSystem.listDirectory('A:/mydocs/renamed_textfiles/'));


        if (Drives.B) {
            await WebOSFileSystem.writeFile('B:/mydata/test_b_drive.txt', 'Data on Drive B (IndexedDB)');
            const bContent = await WebOSFileSystem.readFile('B:/mydata/test_b_drive.txt');
            console.log('Read from B:/mydata/test_b_drive.txt:', bContent);
            let bFiles = await WebOSFileSystem.listDirectory('B:/mydata/');
            console.log('Files in B:/mydata/:', bFiles);

             // Test cross-drive rename (file)
            // await WebOSFileSystem.rename('B:/mydata/test_b_drive.txt', 'A:/test_b_moved_to_a.txt');
            // console.log('Moved test_b_drive.txt from B: to A:. Check A:/ and B:/mydata/');
            // console.log("A:/ listing:", await WebOSFileSystem.listDirectory('A:/'));
            // console.log("B:/mydata listing:", await WebOSFileSystem.listDirectory('B:/mydata/'));
        }

        // Delete a file
        // await WebOSFileSystem.deleteFile('A:/mydocs/renamed_textfiles/renamed_example.txt');
        // console.log('Deleted renamed_example.txt. Listing A:/mydocs/renamed_textfiles/ again:');
        // console.log(await WebOSFileSystem.listDirectory('A:/mydocs/renamed_textfiles/'));

        // Delete a directory (and its contents, if implemented recursively or by deleting marker)
        // For this simplified FS, deleting a directory might just remove its marker,
        // or require it to be empty. A robust deleteDirectory would handle contents.
        // For now, let's assume deleteFile can remove the directory marker if it's empty or represented as a file.
        // await WebOSFileSystem.deleteFile('A:/mydocs/renamed_textfiles/'); // If dir is just a key
        // console.log('Attempted to delete directory A:/mydocs/renamed_textfiles/. Listing A:/mydocs/:');
        // console.log(await WebOSFileSystem.listDirectory('A:/mydocs/'));


        console.log("--- End of FileSystem API Example Usage ---");
    } catch (error) {
        console.error("Error during FileSystem API example usage:", error);
    }

    // Example: How an app might use persistentStorageWrapper directly
    // (This part is for demonstration; actual apps would use WebOSFileSystem)
    console.log("--- persistentStorageWrapper Example ---");
    persistentStorageWrapper.setItem('app_preference_theme', 'dark');
    console.log('Theme preference:', persistentStorageWrapper.getItem('app_preference_theme'));
    // persistentStorageWrapper.clear(); // Be careful with clear, it wipes the entire chosen storage
    console.log("--- End of persistentStorageWrapper Example ---");


    // Log available drives
    console.log("Available drives:", WebOSFileSystem.getDrives());

})();

// Ensure Drives.B is initialized if IndexedDB is available but wasn't auto-initialized at Drives object creation
// This is more of a fallback if the initial check for window.indexedDB was premature (e.g. in a non-browser env then moved to browser)
if (!Drives.B && window.indexedDB) {
    console.log("Late initialization of Drive B (IndexedDB)");
    Drives.addDrive('B', indexedDBWrapper);
}
