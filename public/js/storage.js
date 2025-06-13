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
    driver: window.indexedDB ? indexedDBWrapper : null, // Default to IndexedDB if available, else null

    setDriver: function(driverInstance) {
        this.driver = driverInstance;
        if (driverInstance === indexedDBWrapper) {
            console.log("Persistent storage driver set to: IndexedDB");
        } else if (driverInstance === null) {
            console.log("Persistent storage driver set to: null");
        } else {
            console.log("Persistent storage driver set to: custom (unknown type)");
        }
    },

    isUsingLocalStorage: function() {
        // localStorageWrapper will be removed, so this method might become obsolete or always false
        return false;
    },

    isUsingIndexedDB: function() {
        return this.driver === indexedDBWrapper;
    },

    getItem: function(key) {
        if (!this.driver) { console.error('No persistent storage driver set for getItem.'); return null; }
        return this.driver.getItem(key);
    },

    setItem: function(key, value) {
        if (!this.driver) { console.error('No persistent storage driver set for setItem.'); return; }
        return this.driver.setItem(key, value);
    },

    removeItem: function(key) {
        if (!this.driver) { console.error('No persistent storage driver set for removeItem.'); return; }
        return this.driver.removeItem(key);
    },

    clear: function() {
        if (!this.driver) { console.error('No persistent storage driver set for clear.'); return; }
        return this.driver.clear();
    },

    key: function(index) {
        if (!this.driver) { console.warn('No persistent storage driver set for key.'); return null; }
        if (typeof this.driver.key === 'function') {
            return this.driver.key(index);
        }
        console.warn('key(index) is not directly supported by the current persistent storage driver.');
        return null;
    },

    length: function() {
        if (!this.driver) { console.warn('No persistent storage driver set for length.'); return 0; }
        if (typeof this.driver.length === 'function') {
            return this.driver.length();
        }
        console.warn('length() is not directly supported by the current persistent storage driver. Use getAllItems and check its size.');
        return 0;
    },

    getAllItems: function() {
        if (!this.driver) { console.warn('No persistent storage driver set for getAllItems.'); return {}; }
        if (typeof this.driver.getAllItems === 'function') {
            return this.driver.getAllItems();
        }
        console.warn('getAllItems() is not directly supported by the current persistent storage driver.');
        return {};
    }
};

// Initial check for persistentStorageWrapper driver
if (!persistentStorageWrapper.driver) {
    console.warn("PersistentStorageWrapper initialized without a default driver. Explicitly set a driver using setDriver().");
}


// --- Unified FileSystem API ---
class FileSystem {
    constructor(driveLetter, storageAdapter) {
        this.driveLetter = driveLetter.toUpperCase();
        if (!/^[A-Z]:$/.test(this.driveLetter)) {
            throw new Error("Invalid drive letter format. Must be a single letter followed by a colon (e.g., 'A:').");
        }
        this.storage = storageAdapter;
        this.basePath = this.driveLetter + '/';

        // Flag to indicate if using the new os.drives.get('A:') localStorage driver
        this.isNewLocalStorageDriver = this.driveLetter === 'A:' &&
                                     this.storage &&
                                     typeof this.storage.open === 'function' && // Check for a unique method of the new driver
                                     typeof this.storage.close === 'function' &&
                                     typeof this.storage.read === 'function' &&
                                     typeof this.storage.write === 'function' &&
                                     typeof this.storage.stat === 'function';

        if (!this.isNewLocalStorageDriver) {
            this._initializeDrive(); // Old drivers might need this
        } else {
            console.log(`Drive ${this.driveLetter} is using the new localStorage driver.`);
            // New driver initializes itself via its IIFE and loadDriveData()
        }
    }

    // Helper to get path relative to drive root, starting with /
    _getDriverPath(rawPath) {
        let path = rawPath;
        // Remove drive letter prefix if present (e.g., "A:/foo/bar" -> "/foo/bar")
        if (path.startsWith(this.basePath)) {
            path = path.substring(this.basePath.length -1); // Keep leading slash
        }
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        // Replace multiple slashes with a single slash
        path = path.replace(/\/+/g, '/');
        // Ensure it's not empty or just "//" -> "/"
        if (path === '//') {
            path = '/';
        }
        // If it became empty (e.g. from "A:/"), ensure it's "/"
        if (path === '') {
            path = '/';
        }
        return path;
    }


    _getStorageKey(normalizedPath) {
        // This method is now simplified as localStorageWrapper specific logic is removed.
        return normalizedPath;
    }

    async _initializeDrive() {
        // This method is for potentially other future non-new-driver types
        if (this.isNewLocalStorageDriver) return; // New driver handles its own initialization

        const storageKey = this._getStorageKey(this.basePath);
        const rootDir = await this.storage.getItem(storageKey);
        if (!rootDir) {
            // Simplified logging
            console.log(`Drive ${this.driveLetter} initialized with ${this.storage === indexedDBWrapper ? 'IndexedDB' : 'a custom adapter'}.`);
        }
    }

    _normalizePath(path) {
        // This normalization is mainly for the old system.
        // The new driver paths are handled by _getDriverPath.
        if (!path.startsWith(this.basePath)) {
            if (path.startsWith('/')) {
                path = this.basePath + path.substring(1);
            } else {
                path = this.basePath + path;
            }
        }
        // Remove trailing slashes unless it's the root itself
        // For localStorage, keys for directories should end with '/', except for the root "" key.
        // if (this.storage === localStorageWrapper && path === this.basePath) { // Condition removed
        //      // Root of Drive A, _getStorageKey handles this to ""
        // } else
        if (path !== this.basePath && path.endsWith('/')) { // Adjusted condition (no more localStorageWrapper check here)
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

        // if (path !== this.basePath && path.endsWith('/') && this.storage !== localStorageWrapper) { // Condition removed
        // Keep trailing slash for non-LS directory paths
        // For LS, we handle slash in _getStorageKey or rely on createDirectory adding it.
        // Actually, _getStorageKey should get the pure path.
        // The calling function (e.g. createDirectory) should ensure dirPath ends with / if that's the convention.
        // } else
        if (path !== this.basePath && path.endsWith('/')) { // Adjusted, was else if
             path = path.slice(0, -1); // Original behavior for trailing slash removal on non-base paths
        }
        return path.replace(/\/\//g, '/'); // Replace double slashes
    }

    async writeFile(filePath, content) {
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(filePath);
            let stringContent = content;
            if (typeof content !== 'string') {
                try {
                    stringContent = JSON.stringify(content);
                } catch (e) {
                    console.error("Failed to stringify content for writeFile:", e);
                    throw new Error("Content must be a string or JSON serializable object.");
                }
            }

            let fd = -1;
            try {
                // Create the file entry first.
                // The localstorage-driver's create() method handles metadata and parent directory listing.
                // It returns 0 on success, -1 on error (e.g., already exists as different type, or parent path issue).
                const createResult = this.storage.create(driverPath);
                if (createResult === -1) {
                    // Check if it already exists as a file, which might be okay for overwriting.
                    // Open + stat to check. This is a bit complex if create itself doesn't allow re-creation of files.
                    // For now, let's assume create() is okay or subsequent open for write handles it.
                    // If create fails because it *is* a file, open 'write' should proceed.
                    // If create fails for other reasons (e.g. parent not dir), then it's an error.
                    // The driver's create() logs "File already exists" and returns 0 if it's a file.
                    // It returns -1 if parent is not a dir or path is invalid.
                    // So a -1 from create() is a more serious error.
                    // Let's assume if createResult is -1, it's a hard error.
                    // Re-checking localstorage-driver.js: create() returns 0 if already exists as file or successfully created.
                    // Returns -1 if parent path doesn't exist or isn't a directory.
                    if (createResult === -1) { // Strict check, means parent path issue or invalid path
                        throw new Error(`Failed to create file entry (metadata) for: ${driverPath}. Parent directory might not exist.`);
                    }
                }

                fd = this.storage.open(driverPath, 'write'); // Open for writing
                if (fd === -1) throw new Error(`Failed to open file for writing: ${driverPath}`);

                // The localstorage-driver's write(fd, data) returns bytes written or -1 on error.
                const bytesWritten = this.storage.write(fd, stringContent);
                if (bytesWritten < 0) throw new Error(`Failed to write to file: ${driverPath}`);

                this.storage.close(fd);
                fd = -1; // Mark as closed
                console.log(`File written (new driver): ${driverPath}`);
            } catch (error) {
                if (fd !== -1) {
                    try { this.storage.close(fd); } catch (e) { console.error("Error closing fd during error handling:", e); }
                }
                console.error(`Error writing file ${driverPath} (new driver):`, error);
                throw error;
            }
        } else {
            // Old logic for localStorageWrapper or other adapters
            const normalizedPath = this._normalizePath(filePath);
            const storageKey = this._getStorageKey(normalizedPath);
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
                this._updateDirectoryListing(normalizedPath, 'file');
            } catch (error) {
                console.error(`Error writing file ${normalizedPath}:`, error);
                throw error;
            }
        }
    }

    async readFile(filePath) {
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(filePath);
            let fd = -1; // Outer fd, correctly declared
            try { // Outer try
                // let fd = -1; // This is the duplicated declaration to be removed
                try { // Inner try
                    fd = this.storage.open(driverPath, 'r'); // read-only
                if (fd === -1) {
                    // console.warn(`File not found or could not be opened for reading (new driver): ${driverPath}`);
                    // Standard behavior is often to throw an error or return null.
                    // Let's be consistent with old logic: return null.
                    return null;
                }

                const stat = this.storage.stat(fd);
                if (!stat) { // stat itself failed or returned nullish
                    this.storage.close(fd);
                    fd = -1;
                    console.warn(`Stat failed after open (new driver): ${driverPath}`);
                    // This case implies an issue with an opened file, potentially.
                    // Or stat is designed to be called on an fd that might be invalid after all.
                    // Driver's stat(fd) returns table entry or null if fd is not in fds map.
                    // If open succeeded, fd should be in fds map.
                    return null;
                }

                if (stat.type !== 'file') {
                    this.storage.close(fd);
                    fd = -1;
                    console.warn(`Not a file (new driver): ${driverPath}, type: ${stat.type}`);
                    return null; // Or throw error, as it's not a file
                }

                // The localstorage-driver's read(fd) returns the content string or null on error.
                const content = this.storage.read(fd);

                this.storage.close(fd);
                fd = -1; // Mark as closed

                if (content === null) { // Check for read error from driver
                    console.warn(`Failed to read file content (new driver): ${driverPath}`);
                    return null;
                }

                console.log(`File read (new driver): ${driverPath}`);
                try {
                    // Attempt to parse if content looks like JSON, otherwise return as string
                    // This is the same behavior as the old logic branch.
                    if (typeof content === 'string' && ((content.startsWith('{') && content.endsWith('}')) || (content.startsWith('[') && content.endsWith(']')))) {
                        return JSON.parse(content);
                    }
                    return content;
                } catch (e) {
                    // If JSON.parse fails, return the original content string
                    return content;
                } catch (innerError) { // <<<< THIS TRY NEEDS A CATCH
                    console.error(`Inner error in readFile for ${driverPath} (new driver):`, innerError);
                    if (fd !== -1) {
                        try { this.storage.close(fd); } catch (closeError) {
                            console.error(`Error closing fd during innerError handling for ${driverPath}:`, closeError);
                        }
                    }
                    throw innerError;
                }
            } catch (error) { // Outer catch
                // ... existing outer catch logic ...
                // Note: The original outer catch already handles closing fd if necessary
                // and logs the error. We ensure the fd is closed by the inner catch if an error occurs there.
                if (fd !== -1) { // This check might be redundant if inner catch always closes, but good for safety.
                    try { this.storage.close(fd); } catch (e) { console.error("Error closing fd in outer catch (should have been closed by inner if error originated there):", e); }
                }
                console.error(`Error reading file ${driverPath} (new driver) - Outer catch:`, error);
                throw error; // Re-throw original error
            }
        } else {
            // Old logic
            const normalizedPath = this._normalizePath(filePath);
            const storageKey = this._getStorageKey(normalizedPath);
            try {
                const content = await this.storage.getItem(storageKey);
                if (content === null) {
                    console.warn(`File not found: ${normalizedPath} (key: ${storageKey})`);
                    return null;
                }
                console.log(`File read: ${normalizedPath}`);
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
    }

    async deleteFile(filePath) { // filePath can be for a file or a directory
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(filePath);
            try {
                // Assuming this.storage.delete(path) returns 0 for success, -1 for error.
                const result = this.storage.delete(driverPath);
                if (result === -1) {
                    // The driver's delete method should log specific errors.
                    // We can throw a generic error here or rely on driver logs.
                    console.error(`Failed to delete file/directory (new driver): ${driverPath}. Driver indicated failure.`);
                    throw new Error(`Deletion failed for ${driverPath}.`);
                }
                console.log(`File/directory deleted (new driver): ${driverPath}`);
                // Note: The new driver's delete method is responsible for updating parent dir listings.
                // No need for _removeDirectoryEntry here for the new driver.
            } catch (error) {
                console.error(`Error during deleteFile operation for ${driverPath} (new driver):`, error);
                throw error; // Re-throw to allow higher-level error handling
            }
        } else {
            // This 'else' block should have been removed in a previous step
            // (Refactor storage.js to Remove localStorageWrapper).
            // If it's still here, it indicates an issue with previous step execution.
            // For now, assume it's gone or will be ignored.
            // If it's needed for other potential drivers, this instruction would be different.
            // Given the plan, it's expected to be gone.
            console.warn(`deleteFile called on a non-new-localStorage-driver for path: ${filePath}. This path is currently unhandled after localStorageWrapper removal.`);
            throw new Error("deleteFile is not supported for this drive type after refactoring.");
        }
        // Or throw new Error(`deleteFile not supported for this drive type.`);
    }

    async createFile(filePath, content = '') { // Similar to writeFile
        return this.writeFile(filePath, content);
    }

    async createDirectory(dirPath) {
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(dirPath);
            try {
                const result = this.storage.mkdir(driverPath);
                // The localstorage-driver mkdir(path) returns:
                //   0 if directory created successfully OR if it already exists as a directory.
                //  -1 if parent path does not exist or is not a directory,
                //     OR if a file with the same name already exists at that path.
                if (result === 0) {
                    console.log(`Directory operation successful (created or already exists as dir) (new driver): ${driverPath}`);
                } else { // result === -1
                    // The driver itself logs specific reasons for mkdir failure (e.g. parent not found, file exists)
                    // So, a generic error message here is sufficient.
                    throw new Error(`Failed to create directory (new driver): ${driverPath}. Driver error code: ${result}. Possible reasons: parent path issue, or a file exists at this path.`);
                }
            } catch (error) {
                // Catch errors from mkdir itself (e.g. if it throws) or the re-thrown error above.
                console.error(`Error creating directory ${driverPath} (new driver):`, error.message); // Log only message to avoid redundancy if error is re-thrown
                throw error; // Re-throw the error for the caller to handle
            }
        }
        // else block for old logic removed
        console.warn(`createDirectory called for ${dirPath} on a drive type that is not the new 'A:' driver. This is currently not supported.`);
        // Or throw new Error(`createDirectory not supported for this drive type.`);
    }

    // _updateDirectoryListing, _removeDirectoryEntry, _getParentPath are primarily for the old system.
    // The new driver manages its own directory structure internally.
    async _updateDirectoryListing(itemPath, itemType) {
        console.warn('_updateDirectoryListing is deprecated and should not be used with new drivers.');
        return;
    }

    async _removeDirectoryEntry(itemPath) {
        console.warn('_removeDirectoryEntry is deprecated and should not be used with new drivers.');
        return;
    }

    _getParentPath(filePath) { // Was used by old system, might be useful generally if adapted
        // For now, keeping its old logic but noting it might need review if used by non-new-driver systems.
        // If this.isNewLocalStorageDriver is true for all relevant FileSystem instances, this method might become unused.
        const normalizedPath = this._normalizePath(filePath); // Uses old normalization
        if (normalizedPath === this.basePath || normalizedPath === this.basePath.slice(0,-1)) {
            return null;
        }
        let lastSlash = normalizedPath.lastIndexOf('/');
        if (lastSlash === -1 || lastSlash === normalizedPath.length -1) {
             lastSlash = normalizedPath.slice(0, normalizedPath.length -1).lastIndexOf('/');
        }
        if (lastSlash <= this.basePath.length -1) {
            return this.basePath;
        }
        return normalizedPath.substring(0, lastSlash + 1);
    }

    async listDirectory(dirPath = '') {
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(dirPath);
            let dirFd = -1;
            const results = [];

            try {
                dirFd = this.storage.open(driverPath, 'r');
                if (dirFd === -1) {
                    // Try to stat the path to see if it's not a dir or doesn't exist
                    // This requires a temporary fd for stat if stat only takes fd
                    // For now, assume open failing means it's not a readable directory
                    console.warn(`listDirectory: Directory not found or not accessible (new driver): ${driverPath}`);
                    return []; // Return empty array, consistent with non-existent dir
                }

                // Check if it's actually a directory
                const dirStat = this.storage.stat(dirFd);
                if (!dirStat || dirStat.type !== 'dir') {
                    this.storage.close(dirFd);
                    console.warn(`listDirectory: Path is not a directory (new driver): ${driverPath}, type: ${dirStat ? dirStat.type : 'unknown'}`);
                    return [];
                }

                // Read the directory contents (comma-separated names)
                // The driver's readdir(fd) uses read(fd) which returns the content string
                const dirContentsString = this.storage.read(dirFd); // driver's read(fd)
                this.storage.close(dirFd); // Close directory fd immediately after read
                dirFd = -1;

                if (!dirContentsString) { // Empty string or null
                    console.log(`Directory is empty or read failed (new driver): ${driverPath}`);
                    return [];
                }

                const names = dirContentsString.split(',').filter(name => name.trim() !== '');
                if (names.length === 0 && dirContentsString.length > 0) { // e.g. content was just "," or " , "
                     console.log(`Directory listing produced no valid names after split, though content was present (new driver): ${driverPath}`);
                     return [];
                }


                for (const name of names) {
                    const itemDriverPath = (driverPath === '/' ? '' : driverPath) + '/' + name;
                    let itemFd = -1;
                    try {
                        itemFd = this.storage.open(itemDriverPath, 'r');
                        if (itemFd === -1) {
                            console.warn(`listDirectory: Could not open item '${name}' in directory '${driverPath}' (new driver). Skipping.`);
                            continue;
                        }
                        const itemStat = this.storage.stat(itemFd);
                        if (!itemStat) {
                            console.warn(`listDirectory: Could not stat item '${name}' in directory '${driverPath}' (new driver). Skipping.`);
                            this.storage.close(itemFd);
                            continue;
                        }
                        results.push({ name: name, type: itemStat.type });
                        this.storage.close(itemFd);
                        itemFd = -1;
                    } catch (itemError) {
                        if (itemFd !== -1) {
                            try { this.storage.close(itemFd); } catch (e) { console.error("Error closing itemFd during itemError handling:", e); }
                        }
                        console.warn(`listDirectory: Error processing item '${name}' in '${driverPath}' (new driver):`, itemError.message);
                    }
                }
                console.log(`Directory listing for ${driverPath} (new driver):`, results);
                return results;

            } catch (error) {
                if (dirFd !== -1) {
                    try { this.storage.close(dirFd); } catch (e) { console.error("Error closing dirFd during error handling:", e); }
                }
                console.error(`Error listing directory ${driverPath} (new driver):`, error.message);
                // Check original error. If it indicates "not a directory" or "not found", return empty array.
                // This requires inspecting the error message, which is fragile.
                // For now, rethrow unless specific conditions met.
                // Based on current driver, open() returns -1 for not found.
                // If error came from `open` returning -1 initially, it would have returned [] already.
                // So this catch is for other unexpected errors.
                throw error;
            }
        }
        // else block for old logic removed
        console.warn(`listDirectory called for ${dirPath} on a drive type that is not the new 'A:' driver. This is currently not supported and will return an empty array.`);
        return []; // Or throw new Error(...)
    }

     async exists(path) {
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(path);
            let fd = -1;
            try {
                fd = this.storage.open(driverPath, 'r'); // Open for reading to check existence
                if (fd === -1) {
                    // If open fails, it doesn't exist or is not accessible.
                    return false;
                }
                // If open succeeds, an entry exists. We should still stat it to be sure,
                // and importantly, we need to close the fd.
                const statInfo = this.storage.stat(fd);
                this.storage.close(fd);
                fd = -1; // Mark as closed

                // If statInfo is null (e.g. fd was somehow invalid for stat after open, though unlikely here),
                // this will correctly return false. Otherwise, true.
                return !!statInfo;
            } catch (error) {
                // Catch any errors from open, stat, or close.
                if (fd !== -1) {
                    try { this.storage.close(fd); } catch (e) { console.error("Error closing fd during exists error handling:", e); }
                }
                console.warn(`Exists check failed for ${driverPath} (new driver):`, error.message);
                return false;
            }
        }
        // else block for old logic removed
        console.warn(`exists check for ${path} on a drive type that is not the new 'A:' driver. This is currently not supported and will return false.`);
        return false; // Or throw new Error(...)
    }

    async rename(oldPath, newPath) {
        if (this.isNewLocalStorageDriver) {
            const oldDriverPath = this._getDriverPath(oldPath);
            const newDriverPath = this._getDriverPath(newPath);

            // The localstorage-driver.js does not currently implement rename, unlink, or rmdir.
            // Therefore, rename is a no-op for this driver.
            console.warn(`rename operation is not supported for Drive A (new driver) due to missing driver primitives: ${oldDriverPath} to ${newDriverPath}. No action taken.`);
            // To prevent errors if called, simply return or do nothing.
            // If this needs to throw an error, change the behavior here.
            // Throwing an error might be more appropriate for a failed operation.
            throw new Error(`Rename operation not supported by this driver for paths: ${oldDriverPath} to ${newDriverPath}`);
        }
        // else block for old logic removed
        console.warn(`rename called for ${oldPath} to ${newPath} on a drive type that is not the new 'A:' driver. This is currently not supported.`);
        throw new Error(`Rename not supported for this drive type.`);
    }

    getDriveLetter() {
        return this.driveLetter;
    }

    getStorageType() {
        if (this.storage === indexedDBWrapper) return 'IndexedDB';
        // Removed localStorageWrapper case
        if (this.isNewLocalStorageDriver) return 'localStorage (New Driver)'; // Clarify if it's the new A: drive
        return 'custom/unknown'; // More generic fallback
    }
}


// --- Drive Management ---
const Drives = {
    // Initialize Drive A: Must use window.os.drives.get('A:')
    A: new FileSystem('A:', window.os && window.os.drives && window.os.drives.get('A:')),
    B: window.indexedDB ? new FileSystem('B:', indexedDBWrapper) : null, // Drive B uses IndexedDB, if available
};

// Check for Drive A initialization
if (Drives.A && !Drives.A.storage) {
    console.error("FATAL: Drive A could not be initialized because no storage driver was provided (window.os.drives.get('A:') was not available). Drive A will be unusable.");
    Drives.A = null; // Or throw new Error("Drive A initialization failed.");
}

// Continue with the rest of the Drives object definition if necessary, or just ensure it's correctly structured.
// The original code just had getDrive and addDrive after A and B.
Drives.getDrive = function(letter) {
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
        console.log(`Drive ${drive}: added with ${storageAdapter === indexedDBWrapper ? 'IndexedDB' : 'custom adapter'}.`); // Removed localStorageWrapper check
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
        // persistentStorageWrapper.setDriver(localStorageWrapper); // localStorageWrapper is removed
        console.warn("switchToLocalStorageForPersistentStorage is deprecated and no longer functional as localStorageWrapper has been removed.");
        // Optionally, if there's another "simple" key-value store it could switch to:
        // persistentStorageWrapper.setDriver(someOtherSimpleDriver);
        // console.log("Switched persistentStorageWrapper to use someOtherSimpleDriver.");
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
