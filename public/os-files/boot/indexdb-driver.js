// public/os-files/indexdb-driver.js
(function() {
    'use strict';
    if (!window.indexedDB) {
        console.warn("IndexedDB not supported by this browser. IndexDB driver will not be available.");
        return;
    }

    // --- Revised Constants ---
    const DB_NAME = 'WebOS_IndDB_FS_RevisedV3'; // New DB name to avoid conflicts
    const DB_VERSION = 3; // Incremented DB version
    const METADATA_STORE_NAME = 'drive_metadata'; // For metadataTree, usedBytes, totalSize
    const FILE_CONTENT_STORE_NAME = 'file_contents'; // For file data (ArrayBuffers)

    // --- Global variables for the driver instance ---
    let fds = new Map();
    let fdCounter = 0;
    let closedFds = [];

    // TextEncoder/Decoder instances (still useful)
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    // --- Helper function for UUID generation ---
    function _generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        } else {
            // Basic fallback if crypto.randomUUID is not available
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    }

    // --- Core Driver Object (Revised Structure) ---
    const implementedDriverObject = {
        dbPromise: null,
        db: null,
        metadataTree: null,
        driveLetter: '',
        isMounted: false,
        totalSizeBytesConfigured: 0, // Logical total size configured for the drive
        usedBytes: 0, // Total bytes used by file contents (approximate)

        _openDBOnce: async function() {
            if (this.dbPromise) return this.dbPromise;

            this.dbPromise = new Promise((resolve, reject) => {
                console.log(`Opening IndexedDB: ${DB_NAME} version ${DB_VERSION}`);
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = (event) => {
                    console.error("IndexedDB error:", event.target.error);
                    this.dbPromise = null;
                    reject(event.target.error);
                };

                request.onupgradeneeded = (event) => {
                    console.log("IndexedDB upgrade needed.");
                    const db = event.target.result;
                    const transaction = event.target.transaction;

                    // Delete old object stores if they exist from previous models
                    if (db.objectStoreNames.contains('virtual_disks')) { // Old store from ArrayBuffer model
                        db.deleteObjectStore('virtual_disks');
                        console.log("Old 'virtual_disks' store deleted.");
                    }
                     if (db.objectStoreNames.contains('file_metadata')) { // Older model
                        db.deleteObjectStore('file_metadata');
                    }
                    if (db.objectStoreNames.contains('file_contents') && DB_VERSION <=2) { // if old file_contents was different
                         // db.deleteObjectStore('file_contents'); // or migrate
                    }


                    if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
                        db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'id' });
                        console.log(`Object store '${METADATA_STORE_NAME}' created.`);
                    }
                    if (!db.objectStoreNames.contains(FILE_CONTENT_STORE_NAME)) {
                        db.createObjectStore(FILE_CONTENT_STORE_NAME, { keyPath: 'uuid' });
                        console.log(`Object store '${FILE_CONTENT_STORE_NAME}' created.`);
                    }
                    console.log("onupgradeneeded complete.");
                };

                request.onsuccess = (event) => {
                    console.log("IndexedDB opened successfully.");
                    this.db = event.target.result;
                    resolve(this.db);
                };
            });
            return this.dbPromise;
        },

        _getDriveMetadataRecordId: function() {
            if (!this.driveLetter) throw new Error("Drive letter not set.");
            return `drive_state_${this.driveLetter}`;
        },

        _persistDriveState: async function() {
            if (!this.isMounted) { // Or should allow saving even if not fully "mounted" but state exists?
                console.error("_persistDriveState: Drive not mounted. Cannot persist state.");
                return false;
            }
            if (!this.db) {
                 console.error("_persistDriveState: Database connection not available.");
                return false;
            }

            const stateToSave = {
                id: this._getDriveMetadataRecordId(),
                metadataTree: this.metadataTree,
                usedBytes: this.usedBytes,
                totalSizeBytesConfigured: this.totalSizeBytesConfigured, // Persist configured size
                driveLetter: this.driveLetter // Persist for sanity check on load
            };

            try {
                const transaction = this.db.transaction(METADATA_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(METADATA_STORE_NAME);
                await new Promise((resolve, reject) => {
                    const request = store.put(stateToSave);
                    request.onsuccess = resolve;
                    request.onerror = (event) => {
                        console.error("Error putting drive state:", event.target.error);
                        reject(event.target.error);
                    };
                });
                console.log(`_persistDriveState: Drive state for ${this.driveLetter} persisted.`);
                return true;
            } catch (error) {
                console.error(`_persistDriveState: Failed for ${this.driveLetter}. Error:`, error);
                return false;
            }
        },

        configureAndMount: async function(driveLetter, totalSizeBytesFromConfig) {
            console.log(`configureAndMount: Drive ${driveLetter}, Size: ${totalSizeBytesFromConfig}`);
            this.driveLetter = driveLetter;
            this.totalSizeBytesConfigured = totalSizeBytesFromConfig;
            this.isMounted = false;
            this.metadataTree = null;
            this.usedBytes = 0;

            try {
                this.db = await this._openDBOnce();
                const metadataId = this._getDriveMetadataRecordId();

                const transaction = this.db.transaction(METADATA_STORE_NAME, 'readonly');
                const store = transaction.objectStore(METADATA_STORE_NAME);

                const record = await new Promise((resolve, reject) => {
                    const request = store.get(metadataId);
                    request.onsuccess = () => resolve(request.result); // request.result can be undefined if not found
                    request.onerror = (event) => {
                         console.error(`Error getting metadata record ${metadataId}:`, event.target.error);
                         reject(event.target.error); // Rethrow to be caught by outer try-catch
                    };
                });

                if (record && record.metadataTree) { // Check if record and metadataTree exist
                    console.log(`configureAndMount: Found existing metadata for drive ${driveLetter}.`);
                    this.metadataTree = record.metadataTree;

                    let initialUsedBytes = (typeof record.usedBytes === 'number') ? record.usedBytes : null;

                    if (initialUsedBytes === null) {
                        console.warn(`configureAndMount: usedBytes not found or invalid in persisted state for drive ${driveLetter}. Recalculating...`);
                        this.usedBytes = this._calculateUsedBytesRecursive(this.metadataTree['/']);
                        await this._persistDriveState(); // Persist the recalculated usedBytes
                    } else {
                        this.usedBytes = initialUsedBytes;
                    }

                    if (record.totalSizeBytesConfigured !== totalSizeBytesFromConfig) {
                        console.warn(`Configured size ${totalSizeBytesFromConfig} for drive ${driveLetter} differs from persisted size ${record.totalSizeBytesConfigured}. Using new configured size.`);
                    }
                    // Always use the size provided during the current mount configuration
                    this.totalSizeBytesConfigured = totalSizeBytesFromConfig;
                    if (this.usedBytes > this.totalSizeBytesConfigured) {
                        console.warn(`Initial usedBytes (${this.usedBytes}) for drive ${driveLetter} exceeds new total configured size (${this.totalSizeBytesConfigured}). This may indicate an issue or a shrink operation not fully supported.`);
                        // Consider how to handle this - for now, it's a warning.
                    }

                } else {
                    console.log(`configureAndMount: No valid existing metadata for drive ${driveLetter}. Initializing new tree.`);
                    this.metadataTree = { '/': { type: 'dir', modified: Date.now(), created: Date.now(), accessed: Date.now(), children: {} } };
                    this.usedBytes = 0;
                    // totalSizeBytesConfigured is already set from parameters
                    await this._persistDriveState(); // Save initial empty state
                }
                this.isMounted = true;
                console.log(`configureAndMount: Drive ${driveLetter} mounted successfully. Used: ${this.usedBytes}/${this.totalSizeBytesConfigured}`);
                return true;
            } catch (error) {
                console.error(`configureAndMount: Failed for drive ${driveLetter}. Error:`, error);
                this.isMounted = false;
                return false;
            }
        },

        // --- Metadata Helper Functions (largely remain the same, operate on this.metadataTree) ---
        _normalizePathSegments: function(pathString) {
            if (typeof pathString !== 'string') return [];
            return pathString.split('/').filter(segment => segment !== '');
        },

        _getMetadataNode: function(pathString) {
            if (!this.isMounted || !this.metadataTree) {
                // console.error("_getMetadataNode: Disk not mounted or metadataTree not available."); // Can be too noisy
                return null;
            }
            if (pathString === '/') return this.metadataTree['/'];

            const segments = this._normalizePathSegments(pathString);
            let currentNode = this.metadataTree['/'];

            for (const segment of segments) {
                if (!currentNode || currentNode.type !== 'dir' || !currentNode.children || !currentNode.children[segment]) {
                    return null;
                }
                currentNode = currentNode.children[segment];
            }
            return currentNode;
        },

        _getParentNodeAndName: function(pathString) {
            const segments = this._normalizePathSegments(pathString);
            if (segments.length === 0) return { parentNode: null, name: '/' };

            const name = segments.pop();
            const parentPath = segments.length === 0 ? '/' : '/' + segments.join('/');
            const parentNode = this._getMetadataNode(parentPath);

            if (!parentNode || parentNode.type !== 'dir') {
                return { parentNode: null, name: name };
            }
            return { parentNode, name };
        },

        _createMetadataNode: function(pathString, type) {
            if (!this.isMounted) return null;
            const { parentNode, name } = this._getParentNodeAndName(pathString);

            if (!parentNode) {
                console.error(`_createMetadataNode: Parent directory for '${pathString}' not found or is not a directory.`);
                return null;
            }
            if (parentNode.children[name]) {
                console.warn(`_createMetadataNode: Item '${name}' already exists in parent '${pathString}'.`);
                return null;
            }

            const now = Date.now();
            const newNode = {
                type: type,
                name: name,
                created: now,
                modified: now,
                accessed: now,
                size: 0,
            };
            if (type === 'file') {
                newNode.uuid = null; // UUID for content will be assigned on first write
            }
            if (type === 'dir') {
                newNode.children = {};
            }

            parentNode.children[name] = newNode;
            parentNode.modified = now;
            // No direct persistence here. Caller (e.g., mkdir, create) handles calling _persistDriveState.
            return newNode;
        },

        _deleteMetadataNode: function(pathString) {
            if (!this.isMounted) return false;
            const { parentNode, name } = this._getParentNodeAndName(pathString);

            if (!parentNode || !parentNode.children || !parentNode.children[name]) {
                console.warn(`_deleteMetadataNode: Item '${pathString}' not found.`);
                return false;
            }

            const nodeToDelete = parentNode.children[name];
            if (nodeToDelete.type === 'dir' && Object.keys(nodeToDelete.children).length > 0) {
                console.error(`_deleteMetadataNode: Directory '${pathString}' is not empty.`);
                return false;
            }

            delete parentNode.children[name];
            parentNode.modified = Date.now();
            // No direct persistence here.
            return true;
        },

        // --- Core File System API Methods ---

        driveSize: function() { // Returns configured total size
            if (!this.isMounted) {
                console.warn("driveSize: Disk not mounted.");
                return -1;
            }
            return this.totalSizeBytesConfigured; // Use the configured total size
        },

        getUsedSpace: function() { // Returns currently tracked used space
             if (!this.isMounted) {
                console.warn("getUsedSpace: Disk not mounted.");
                return -1;
            }
            return this.usedBytes;
        },

        open: async function(pathString, ...flags) {
            if (!this.isMounted) {
                console.error("open: Disk not mounted.");
                return -1;
            }
            let effectiveFlags = flags && flags.length > 0 ? flags : ['read'];

            const metadataNode = this._getMetadataNode(pathString);

            if (!metadataNode) {
                // TODO: Handle O_CREAT: if (effectiveFlags.includes('create') || effectiveFlags.includes('O_CREAT')) { ... }
                console.warn(`open: Path not found '${pathString}'`);
                return -1;
            }

            if (metadataNode.type === 'dir' && (effectiveFlags.includes('write') || effectiveFlags.includes('append'))) {
                console.error(`open: Cannot open directory '${pathString}' with write/append flags.`);
                return -1;
            }

            let fd;
            if (closedFds.length > 0) { fd = closedFds.pop(); } else { fd = fdCounter++; }

            fds.set(fd, { path: pathString, flags: effectiveFlags, node: metadataNode, offset: 0 });
            // console.log(`open: Opened '${pathString}', fd=${fd}, type=${metadataNode.type}`);
            return fd;
        },

        close: function(fd) {
            if (fds.has(fd)) {
                fds.delete(fd);
                closedFds.push(fd);
                return 0;
            }
            console.warn("close: FD not found", fd);
            return -1;
        },

        stat: function(fd) {
             if (!this.isMounted) { console.error("stat: Disk not mounted."); return null;}
            const entry = fds.get(fd);
            if (!entry) { console.warn("stat: FD not found", fd); return null; }
            const { children, ...statInfo } = entry.node; // Exclude children from basic stat
            return { ...statInfo };
        },

        _calculateUsedBytesRecursive: function(node) {
            if (node.type === 'file') {
                return node.len || 0;
            }
            let sum = 0;
            if (node.type === 'dir' && node.children) {
                for (const childName in node.children) {
                    sum += this._calculateUsedBytesRecursive(node.children[childName]);
                }
            }
            return sum;
        },

        // --- Core File System API Methods ---

        driveSize: function() { // Returns configured total size
            if (!this.isMounted) {
                console.warn("driveSize: Disk not mounted.");
                return -1;
            }
            return this.totalSizeBytesConfigured; // Use the configured total size
        },

        getUsedSpace: function() { // Returns currently tracked used space
             if (!this.isMounted) {
                console.warn("getUsedSpace: Disk not mounted.");
                return -1;
            }
            return this.usedBytes;
        },

        open: async function(pathString, ...flags) {
            if (!this.isMounted) {
                console.error("open: Disk not mounted.");
                return -1;
            }
            let effectiveFlags = flags && flags.length > 0 ? flags : ['read'];

            const metadataNode = this._getMetadataNode(pathString);

            if (!metadataNode) {
                // TODO: Handle O_CREAT: if (effectiveFlags.includes('create') || effectiveFlags.includes('O_CREAT')) { ... }
                console.warn(`open: Path not found '${pathString}'`);
                return -1;
            }

            if (metadataNode.type === 'dir' && (effectiveFlags.includes('write') || effectiveFlags.includes('append'))) {
                console.error(`open: Cannot open directory '${pathString}' with write/append flags.`);
                return -1;
            }

            let fd;
            if (closedFds.length > 0) { fd = closedFds.pop(); } else { fd = fdCounter++; }

            fds.set(fd, { path: pathString, flags: effectiveFlags, node: metadataNode, offset: 0 });
            // console.log(`open: Opened '${pathString}', fd=${fd}, type=${metadataNode.type}`);
            return fd;
        },

        close: function(fd) {
            if (fds.has(fd)) {
                fds.delete(fd);
                closedFds.push(fd);
                return 0;
            }
            console.warn("close: FD not found", fd);
            return -1;
        },

        stat: function(fd) {
             if (!this.isMounted) { console.error("stat: Disk not mounted."); return null;}
            const entry = fds.get(fd);
            if (!entry) { console.warn("stat: FD not found", fd); return null; }
            const { children, ...statInfo } = entry.node; // Exclude children from basic stat
            return { ...statInfo };
        },

        write: async function(fd, dataString) {
            if (!this.isMounted) { console.error("write: Disk not mounted."); return -1; }

            const fdEntry = fds.get(fd);
            if (!fdEntry) { console.warn("write: FD not found", fd); return -1; }

            if (!fdEntry.flags.includes('write') && !fdEntry.flags.includes('append')) {
                console.error(`write: FD ${fd} for '${fdEntry.path}' lacks write/append permission.`);
                return -1;
            }

            const fileNode = fdEntry.node;
            if (fileNode.type !== 'file') {
                console.error(`write: Path '${fdEntry.path}' (FD ${fd}) is not a file.`);
                return -1;
            }

            const dataBytes = textEncoder.encode(dataString).buffer; // Get ArrayBuffer
            const oldFileSize = fileNode.len || 0;
            const newFileSize = dataBytes.byteLength;

            if ((this.usedBytes - oldFileSize + newFileSize) > this.totalSizeBytesConfigured) {
                console.error(`write: Disk full for '${fdEntry.path}'. Needed: ${newFileSize - oldFileSize}, Available: ${this.totalSizeBytesConfigured - this.usedBytes}.`);
                return -1; // ENOSPC
            }

            let contentUUID = fileNode.uuid;
            if (!contentUUID) {
                contentUUID = _generateUUID();
                fileNode.uuid = contentUUID;
            }

            try {
                const tx = this.db.transaction(FILE_CONTENT_STORE_NAME, 'readwrite');
                const store = tx.objectStore(FILE_CONTENT_STORE_NAME);
                await new Promise((resolve, reject) => {
                    const req = store.put({ uuid: contentUUID, content: dataBytes });
                    req.onsuccess = resolve;
                    req.onerror = (event) => {
                        console.error("Error putting file content:", event.target.error);
                        reject(event.target.error);
                    };
                });
            } catch (error) {
                console.error(`write: Failed to store content for ${fdEntry.path} (uuid: ${contentUUID}). Error:`, error);
                // If content storage fails, we should not update metadata or usedBytes.
                return -1;
            }

            this.usedBytes = this.usedBytes - oldFileSize + newFileSize;
            fileNode.len = newFileSize;
            fileNode.size = newFileSize;
            fileNode.modified = Date.now();
            fdEntry.offset = newFileSize; // Write implies overwrite and sets offset to end

            const persistSuccess = await this._persistDriveState();
            if (!persistSuccess) {
                console.error(`write: CRITICAL - Failed to persist metadata for '${fdEntry.path}' after writing content.`);
                // This is a critical state: content is written, but metadata update failed.
                // Attempt to revert usedBytes, though the content is already in DB.
                this.usedBytes = this.usedBytes + oldFileSize - newFileSize;
                // A more robust system might try to delete the just-written content block or mark drive as dirty.
                return -1;
            }
            return newFileSize;
        },

        read: async function(fd) {
            if (!this.isMounted) { console.error("read: Disk not mounted."); return null; }

            const fdEntry = fds.get(fd);
            if (!fdEntry) { console.warn("read: FD not found", fd); return null; }

            if (!fdEntry.flags.includes('read')) {
                console.error(`read: FD ${fd} for '${fdEntry.path}' lacks read permission.`);
                return null;
            }

            const fileNode = fdEntry.node;
            if (fileNode.type !== 'file') {
                console.error(`read: Path '${fdEntry.path}' (FD ${fd}) is not a file.`);
                return null;
            }

            if (!fileNode.uuid || fileNode.len === 0) {
                return ""; // Empty or unwritten file
            }

            // This read implementation reads the entire file from fdEntry.offset to end.
            // A more complex version would allow specifying length and handle partial reads better.
            const readStartInFile = fdEntry.offset;
            if (readStartInFile >= fileNode.len) {
                return ""; // EOF
            }

            let fileData;
            try {
                const tx = this.db.transaction(FILE_CONTENT_STORE_NAME, 'readonly');
                const store = tx.objectStore(FILE_CONTENT_STORE_NAME);
                const record = await new Promise((resolve, reject) => {
                    const request = store.get(fileNode.uuid);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = (event) => {
                         console.error("Error getting file content:", event.target.error);
                         reject(event.target.error);
                    };
                });

                if (!record || !record.content) {
                    console.error(`read: Content for file '${fdEntry.path}' (uuid: ${fileNode.uuid}) not found or empty in store.`);
                    return null; // Or throw error
                }
                fileData = record.content; // Should be ArrayBuffer
            } catch (error) {
                 console.error(`read: Failed to retrieve content for ${fdEntry.path} (uuid: ${fileNode.uuid}). Error:`, error);
                return null;
            }

            const bytesToRead = fileNode.len - readStartInFile;
            // Assuming fileData is ArrayBuffer. Slice it if fdEntry.offset indicates partial read from start.
            // For this simple version, we read the relevant part.
            const relevantData = new Uint8Array(fileData, readStartInFile, bytesToRead);
            const decodedString = textDecoder.decode(relevantData);

            fileNode.accessed = Date.now();
            fdEntry.offset += bytesToRead; // Advance offset to end of what was read.

            await this._persistDriveState(); // Persist accessed time
            return decodedString;
        },

        mkdir: async function(pathString) {
            if (!this.isMounted) { console.error("mkdir: Disk not mounted."); return -1; }
            const newNode = this._createMetadataNode(pathString, 'dir');
            if (!newNode) { return -1; }

            const persistSuccess = await this._persistDriveState();
            if (!persistSuccess) {
                console.error(`mkdir: Failed to persist state for '${pathString}'.`);
                this._deleteMetadataNode(pathString); // Attempt to revert
                return -1;
            }
            // console.log(`mkdir: Directory '${pathString}' created.`);
            return 0;
        },

        create: async function(pathString) {
            if (!this.isMounted) { console.error("create: Disk not mounted."); return -1; }
            const newNode = this._createMetadataNode(pathString, 'file');
            if (!newNode) { return -1; }
            // newNode.uuid = this._generateUUID(); // Assign UUID now or on first write? Let's do on first write.

            const persistSuccess = await this._persistDriveState();
            if (!persistSuccess) {
                console.error(`create: Failed to persist state for '${pathString}'.`);
                this._deleteMetadataNode(pathString); // Attempt to revert
                return -1;
            }
            // console.log(`create: File '${pathString}' created.`);
            return 0;
        },

        delete: async function(pathString) {
            if (!this.isMounted) { console.error("delete: Disk not mounted."); return -1; }
            const nodeToDelete = this._getMetadataNode(pathString);
            if (!nodeToDelete) { console.warn(`delete: Path '${pathString}' not found.`); return -1; }
            if (nodeToDelete === this.metadataTree['/']) { console.error("delete: Cannot delete root."); return -1; }

            const contentUUID = nodeToDelete.type === 'file' ? nodeToDelete.uuid : null;
            const oldSize = nodeToDelete.size || 0;

            const deleteSuccess = this._deleteMetadataNode(pathString);
            if (!deleteSuccess) { return -1; } // Error logged by _deleteMetadataNode

            if (contentUUID) {
                try {
                    const tx = this.db.transaction(FILE_CONTENT_STORE_NAME, 'readwrite');
                    const store = tx.objectStore(FILE_CONTENT_STORE_NAME);
                    await new Promise((resolve, reject) => {
                        const req = store.delete(contentUUID);
                        req.onsuccess = resolve;
                        req.onerror = reject;
                    });
                    this.usedBytes = Math.max(0, this.usedBytes - oldSize);
                    // console.log(`delete: Content ${contentUUID} for ${pathString} deleted.`);
                } catch (e) {
                    console.error(`delete: Error deleting content ${contentUUID} for ${pathString}:`, e);
                    // If content deletion fails, metadata is already changed in-memory.
                    // Persisting now would leave orphaned content. Not persisting leaves tree inconsistent with potential on-disk state.
                    // This needs careful error handling strategy. For now, we'll proceed to try persisting metadata.
                }
            }

            const persistSuccess = await this._persistDriveState();
            if (!persistSuccess) {
                console.error(`delete: Failed to persist state for '${pathString}'. CRITICAL.`);
                // TODO: Attempt to restore in-memory node? This is complex.
                return -1;
            }
            // console.log(`delete: Path '${pathString}' deleted.`);
            return 0;
        },

        readdir: async function(fd) {
            if (!this.isMounted) { console.error("readdir: Disk not mounted."); return null; }
            const fdEntry = fds.get(fd);
            if (!fdEntry) { console.warn("readdir: FD not found", fd); return null; }
            if (fdEntry.node.type !== 'dir') { console.error(`readdir: FD ${fd} not a directory.`); return null; }

            fdEntry.node.accessed = Date.now();
            await this._persistDriveState(); // Persist accessed time.
            return Object.keys(fdEntry.node.children || {});
        }
    };

    // Remove comments for old ArrayBuffer specific helpers that are no longer defined/used
    // --- Registration Logic ---
    if (window.FileSystemDrivers) {
        window.FileSystemDrivers.IndexDBRevised = implementedDriverObject;
        console.log("IndexDB Revised Driver structure defined and exposed as FileSystemDrivers.IndexDBRevised.");
    } else {
        console.warn("window.FileSystemDrivers not found. IndexDB Revised Driver not exposed globally via FileSystemDrivers.");
        window.IndexDBRevisedDriver = implementedDriverObject;
    }

})();
