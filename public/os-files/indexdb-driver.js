// public/os-files/indexdb-driver.js
(function() {
    'use strict';
    if (!window.indexedDB) {
        console.warn("IndexedDB not supported by this browser. IndexDB driver will not be available.");
        return;
    }

    const DB_NAME = 'WebOS_IndDB_FS';
    const METADATA_STORE_NAME = 'file_metadata';
    const CONTENTS_STORE_NAME = 'file_contents';
    const DB_VERSION = 1;

    let dbPromise = null;
    let fds = new Map();
    let fdCounter = 0;
    let closedFds = [];
    let rootInitialized = false;

    function openDB() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
                    db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'path' });
                }
                if (!db.objectStoreNames.contains(CONTENTS_STORE_NAME)) {
                    db.createObjectStore(CONTENTS_STORE_NAME, { keyPath: 'path' });
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                resolve(db);
            };
        });
        return dbPromise;
    }

    async function getRecord(storeName, path) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(path);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => {
                console.error(`Error getting record from ${storeName}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function putRecord(storeName, record) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(record);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => {
                console.error(`Error putting record to ${storeName}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function deleteRecord(storeName, path) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(path);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => {
                console.error(`Error deleting record from ${storeName}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    function _formatPath(path) {
        if (!path) path = '/';
        let fPath = '/' + path.split(/\/+/).filter(Boolean).join('/');
        if (fPath === '') fPath = '/'; // Root case
        // Directories (except root) should end with a slash for consistency in this driver,
        // but the provided spec implies paths like '/foo/' for metadata key.
        // For this implementation, metadata paths will not have trailing slashes unless root.
        // Content for directories will be stored with their path (e.g. '/foo/').
        return fPath;
    }

    function _getParentPath(path) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length <= 1) return '/'; // Parent of '/foo' or '/' is '/'
        parts.pop();
        return '/' + parts.join('/');
    }

    function _getFileName(path) {
        return path.split('/').filter(Boolean).pop() || '';
    }

    async function _initializeRootIfNeeded() {
        if (rootInitialized) return Promise.resolve();
        try {
            const rootMeta = await getRecord(METADATA_STORE_NAME, '/');
            if (!rootMeta) {
                const now = Date.now();
                await putRecord(METADATA_STORE_NAME, {
                    path: '/', type: 'dir', size: 0,
                    created: now, modified: now, accessed: now
                });
                await putRecord(CONTENTS_STORE_NAME, { path: '/', content: '' }); // Empty dir listing
            }
            rootInitialized = true;
        } catch (error) {
            console.error("Error initializing root directory:", error);
            // Potentially rethrow or handle so subsequent operations know init failed
            throw error;
        }
    }

    async function _updateParentDirectoryListing(parentPath, itemName, action) {
        if (parentPath === itemName) return; // Cannot modify self in parent listing (e.g. root)

        try {
            const parentContentRecord = await getRecord(CONTENTS_STORE_NAME, parentPath);
            let entries = [];
            if (parentContentRecord && parentContentRecord.content) {
                entries = parentContentRecord.content.split(',').filter(name => name.trim() !== '');
            }

            const initialLength = entries.length;
            if (action === 'add') {
                if (!entries.includes(itemName)) {
                    entries.push(itemName);
                }
            } else if (action === 'remove') {
                entries = entries.filter(entry => entry !== itemName);
            }

            if (action === 'add' || entries.length !== initialLength) {
                await putRecord(CONTENTS_STORE_NAME, { path: parentPath, content: entries.join(',') });
                // Update parent's modified time
                const parentMeta = await getRecord(METADATA_STORE_NAME, parentPath);
                if (parentMeta) {
                    parentMeta.modified = Date.now();
                    parentMeta.accessed = Date.now(); // Access also counts as modification of listing
                    await putRecord(METADATA_STORE_NAME, parentMeta);
                }
            }
        } catch (error) {
            console.error(`Error updating parent directory listing for ${parentPath}:`, error);
            throw error; // Re-throw to signal failure
        }
    }


    const implementedDriverObject = {
        _getDB: () => openDB(), // Mainly for internal use or debugging

        driveSize: () => -1, // IndexedDB doesn't have a fixed size in this context

        open: async function(path) { // Removed ...flags parameter
            await _initializeRootIfNeeded();
            const fPath = _formatPath(path);
            try {
                const metadata = await getRecord(METADATA_STORE_NAME, fPath);
                if (!metadata) {
                    console.warn(`open: Path not found '${fPath}'`);
                    return -1;
                }

                let fd;
                if (closedFds.length > 0) {
                    fd = closedFds.pop();
                } else {
                    fd = fdCounter++;
                }
                fds.set(fd, { path: fPath, metadata: metadata }); // Removed flags from fds
                return fd;
            } catch (error) {
                console.error(`open: Error opening path '${fPath}':`, error);
                return -1;
            }
        },

        close: function(fd) {
            if (fds.has(fd)) {
                fds.delete(fd);
                closedFds.push(fd);
                return 0;
            }
            return -1; // FD not found
        },

        stat: function(fd) {
            const entry = fds.get(fd);
            if (!entry) return null;
            // Return a copy to prevent external modification of internal state
            return { ...entry.metadata };
        },

        read: async function(fd) {
            const entry = fds.get(fd);
            if (!entry) { console.warn("read: FD not found"); return null; }
            // if (!entry.flags.includes('read')) { console.warn("read: No read flag"); return null; }


            try {
                const contentRecord = await getRecord(CONTENTS_STORE_NAME, entry.path);
                if (!contentRecord) {
                     // For directories, content might be empty string. For files, this means no content.
                    if (entry.metadata.type === 'dir') return '';
                    console.warn(`read: Content not found for path '${entry.path}'`);
                    return null;
                }

                // Update accessed time for both files and directories
                entry.metadata.accessed = Date.now();
                await putRecord(METADATA_STORE_NAME, entry.metadata);
                // Also update the stored metadata in the FD map
                fds.set(fd, {...entry, metadata: entry.metadata});

                return contentRecord.content;
            } catch (error) {
                console.error(`read: Error reading content for path '${entry.path}':`, error);
                return null;
            }
        },

        write: async function(fd, data) {
            const entry = fds.get(fd);
            if (!entry) { console.warn("write: FD not found"); return -1; }
            // if (!entry.flags.includes('write')) { console.warn("write: No write flag"); return -1; }

            try {
                await putRecord(CONTENTS_STORE_NAME, { path: entry.path, content: data });

                entry.metadata.modified = Date.now();
                entry.metadata.accessed = Date.now();
                if (entry.metadata.type === 'file') {
                    entry.metadata.size = data.length;
                }
                // If type is 'dir', size is 0 or represents number of items, not content string length.
                // The current spec implies dir size is 0. The content of a dir (listing) is handled.

                await putRecord(METADATA_STORE_NAME, entry.metadata);
                 // Also update the stored metadata in the FD map
                fds.set(fd, {...entry, metadata: entry.metadata});

                return entry.metadata.type === 'file' ? data.length : 0;
            } catch (error) {
                console.error(`write: Error writing content to path '${entry.path}':`, error);
                return -1;
            }
        },

        mkdir: async function(path) {
            await _initializeRootIfNeeded();
            const fPath = _formatPath(path);
            const parentPath = _getParentPath(fPath);
            const itemName = _getFileName(fPath);

            if (fPath === '/') { console.warn("mkdir: Cannot create root."); return -1; } // Root already handled

            try {
                let existingMeta = await getRecord(METADATA_STORE_NAME, fPath);
                if (existingMeta) {
                    console.warn(`mkdir: Path already exists '${fPath}' as type ${existingMeta.type}`);
                    return -1; // Path already exists
                }

                const parentMeta = await getRecord(METADATA_STORE_NAME, parentPath);
                if (!parentMeta || parentMeta.type !== 'dir') {
                    console.warn(`mkdir: Parent path '${parentPath}' not found or not a directory.`);
                    return -1;
                }

                const now = Date.now();
                const newDirMeta = {
                    path: fPath, type: 'dir', size: 0,
                    created: now, modified: now, accessed: now
                };
                await putRecord(METADATA_STORE_NAME, newDirMeta);
                await putRecord(CONTENTS_STORE_NAME, { path: fPath, content: '' }); // Empty dir listing

                await _updateParentDirectoryListing(parentPath, itemName, 'add');
                return 0; // Success
            } catch (error) {
                console.error(`mkdir: Error creating directory '${fPath}':`, error);
                return -1;
            }
        },

        create: async function(path) { // For files
            await _initializeRootIfNeeded();
            const fPath = _formatPath(path);
            const parentPath = _getParentPath(fPath);
            const itemName = _getFileName(fPath);

            if (fPath === '/') { console.warn("create: Cannot create file at root path directly."); return -1; }


            try {
                let existingMeta = await getRecord(METADATA_STORE_NAME, fPath);
                if (existingMeta) {
                    console.warn(`create: Path already exists '${fPath}' as type ${existingMeta.type}`);
                    return -1; // Path already exists (could be file or dir)
                }

                const parentMeta = await getRecord(METADATA_STORE_NAME, parentPath);
                if (!parentMeta || parentMeta.type !== 'dir') {
                    console.warn(`create: Parent path '${parentPath}' not found or not a directory.`);
                    return -1;
                }

                const now = Date.now();
                const newFileMeta = {
                    path: fPath, type: 'file', size: 0,
                    created: now, modified: now, accessed: now
                };
                await putRecord(METADATA_STORE_NAME, newFileMeta);
                await putRecord(CONTENTS_STORE_NAME, { path: fPath, content: '' }); // Empty content

                await _updateParentDirectoryListing(parentPath, itemName, 'add');
                return 0; // Success
            } catch (error) {
                console.error(`create: Error creating file '${fPath}':`, error);
                return -1;
            }
        },

        delete: async function(path) { // File only as per spec
            await _initializeRootIfNeeded();
            const fPath = _formatPath(path);
            const parentPath = _getParentPath(fPath);
            const itemName = _getFileName(fPath);

            try {
                const metadata = await getRecord(METADATA_STORE_NAME, fPath);
                if (!metadata) {
                    console.warn(`delete: Path not found '${fPath}'`);
                    return -1;
                }
                if (metadata.type !== 'file') {
                    console.warn(`delete: Path '${fPath}' is not a file. Type: ${metadata.type}. Deletion of directories not supported by this specific 'delete' method.`);
                    return -1;
                }

                await deleteRecord(CONTENTS_STORE_NAME, fPath);
                await deleteRecord(METADATA_STORE_NAME, fPath);

                await _updateParentDirectoryListing(parentPath, itemName, 'remove');

                // Close any open FDs for this path
                fds.forEach((fdEntry, fd) => {
                    if (fdEntry.path === fPath) {
                        this.close(fd);
                    }
                });

                return 0; // Success
            } catch (error) {
                console.error(`delete: Error deleting file '${fPath}':`, error);
                return -1;
            }
        },

        readdir: async function(fd) {
            const entry = fds.get(fd);
            if (!entry || entry.metadata.type !== 'dir') {
                console.warn("readdir: FD not found or not a directory.");
                return null;
            }

            try {
                const dirContent = await this.read(fd); // read(fd) handles access time update
                if (dirContent === null) return null; // Error occurred in read
                if (dirContent === '') return []; // Empty directory
                return dirContent.split(',').filter(name => name.trim() !== '');
            } catch (error) {
                console.error(`readdir: Error processing directory content for '${entry.path}':`, error);
                return null;
            }
        }
    };

    // Register the driver
    if (window.os && window.os.drives) {
        // Ensure openDB is called once at registration to initialize if needed,
        // and to allow _initializeRootIfNeeded to run early.
        openDB().then(() => {
             _initializeRootIfNeeded().then(() => {
                window.os.drives.set('B:', implementedDriverObject);
                console.log("IndexedDB driver registered for Drive B and root initialized.");
             }).catch(err => {
                console.error("IndexedDB Driver: Failed to initialize root. Driver NOT registered.", err);
             });
        }).catch(error => {
            console.error("IndexedDB Driver: Failed to open IndexedDB. Driver NOT registered.", error);
        });
    } else {
        console.error("Main OS object (window.os.drives) not found. Cannot register IndexedDB driver.");
    }
})();
