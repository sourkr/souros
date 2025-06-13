// public/js/localstorage-driver.js

// Ensure os object exists
if (!window.os) {
    console.warn('window.os not initialized. localstorage-driver.js might be loaded too early or os-globals.js is missing.');
    window.os = {
        drives: new Map()
    };
} else if (!window.os.drives) {
    console.warn('window.os.drives not initialized. localstorage-driver.js might be loaded too early or os-globals.js is missing.');
    window.os.drives = new Map();
}

(function() { // IIFE to encapsulate driver logic
    let fileDescriptorCounter = 0;
    const openFiles = new Map(); // Stores { path, flags, position } by fd
    let driveData = null; // To hold the parsed content of 'drive'
    let fileTable = null; // To hold the parsed content of 'table'

    // This function initializes the raw data in localStorage if it's not there
    function initializeLocalStorageDriveData() {
        const time = Date.now();
        const initialDriveData = {
            size: 10 * 1024 * 1024, // Default size 10MB, can be changed
            table: {
                "/": {
                    type: 'dir',
                    created: time,
                    modified: time,
                    accessed: time,
                    size: 0,
                    entries: {} // To store directory entries {filename: {type: 'file'/'dir', ...}}
                }
            }
        };
        localStorage.setItem('drive', JSON.stringify(initialDriveData));
        // console.log("localstorage-driver: Initialized 'drive' in localStorage.");

        // The file table might be separate or part of 'drive'.
        // The original snippet had 'table' as a separate item.
        // And 'drive' also had a 'table'. This is confusing.
        // Let's assume the 'table' in 'drive' is the primary one.
        // No separate 'localStorage.setItem('/', '')' as it's unclear.
        // The root path "/" data is within the 'drive's table.
        driveData = initialDriveData;
        fileTable = initialDriveData.table; // Points to the table within driveData
        localStorage.setItem('table', JSON.stringify(fileTable)); // Sync separate 'table' if needed, or remove this line if 'drive'.table is canonical
        // console.log("localstorage-driver: Initialized 'table' in localStorage from 'drive'.table.");
    }

    // This function loads and parses data from localStorage
    function loadDriveData() {
        const storedDrive = localStorage.getItem('drive');
        if (!storedDrive) {
            // console.log("localstorage-driver: 'drive' not found in localStorage. Initializing.");
            initializeLocalStorageDriveData();
        } else {
            try {
                driveData = JSON.parse(storedDrive);
                // Ensure the table structure is present
                if (!driveData.table) {
                    console.warn("localstorage-driver: 'table' missing in 'drive' data. Re-initializing drive data.");
                    initializeLocalStorageDriveData();
                } else {
                    fileTable = driveData.table; // Use the table from the 'drive' item
                    // Optionally, ensure the separate 'table' item is consistent or remove its usage.
                    const storedTable = localStorage.getItem('table');
                    if (!storedTable || JSON.stringify(JSON.parse(storedTable)) !== JSON.stringify(fileTable)) {
                        // console.log("localstorage-driver: Syncing localStorage 'table' item with 'drive'.table.");
                        localStorage.setItem('table', JSON.stringify(fileTable));
                    }
                }
            } catch (e) {
                console.error("localstorage-driver: Error parsing 'drive' data from localStorage. Re-initializing.", e);
                initializeLocalStorageDriveData();
            }
        }

        // Safety check for root directory
        if (!fileTable['/']) {
            console.warn("localstorage-driver: Root directory '/' missing in fileTable. Re-initializing drive data.");
            initializeLocalStorageDriveData();
        }
    }

    // Call loadDriveData when the script is first parsed.
    loadDriveData();

    // Helper to save the driveData (which includes fileTable) back to localStorage
    function persistDriveData() {
        if (driveData) {
            localStorage.setItem('drive', JSON.stringify(driveData));
            // Also update the separate 'table' item if it's still being used.
            // For consistency, ensure fileTable is always driveData.table.
            if (fileTable !== driveData.table) {
                console.warn("localstorage-driver: fileTable and driveData.table desynchronized. This should not happen.");
                fileTable = driveData.table; // Resync
            }
            localStorage.setItem('table', JSON.stringify(fileTable));
        }
    }

    // Helper function to navigate path and get entry or parent entry
    // path: absolute path like "/foo/bar.txt"
    // returns { entry, parentEntry, itemName, error }
    function getPathInfo(path) {
        if (!path.startsWith('/')) return { error: "Path must be absolute." };
        if (!fileTable) return { error: "File table not loaded."};

        const parts = path.split('/').filter(p => p); // e.g., ["foo", "bar.txt"]
        let currentLevel = fileTable['/'].entries;
        let parent = fileTable['/'];

        if (path === '/') return { entry: fileTable['/'], parentEntry: null, itemName: '/' };

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!currentLevel || !currentLevel[part] || currentLevel[part].type !== 'dir') {
                return { error: `Directory not found: ${parts.slice(0, i + 1).join('/')}` };
            }
            parent = currentLevel[part];
            currentLevel = currentLevel[part].entries;
        }

        const itemName = parts[parts.length - 1];
        if (!itemName) return { entry: parent, parentEntry: null, itemName: parts[parts.length-2] || '/' }; // Path like /foo/

        if (!currentLevel || !currentLevel[itemName]) {
            return { entry: null, parentEntry: parent, itemName: itemName, error: null }; // Not found, but parent exists
        }
        return { entry: currentLevel[itemName], parentEntry: parent, itemName: itemName };
    }


    os.drives.set('A:', {
        driveSize() {
            return driveData ? driveData.size : 0;
        },

        open(path, flags) { // eg: '/souros/somefile.txt' not 'A:/souros/somefile.txt'
            if (!fileTable) { console.error("Drive not initialized"); return -1; }

            const { entry, parentEntry, itemName, error: pathError } = getPathInfo(path);

            if (pathError && !(flags.includes('c') && pathError.startsWith('Directory not found:'))) { // allow create if dir missing for file
                 console.error(`open: Path error for ${path}: ${pathError}`);
                 return -1; // Path error
            }

            let fileEntry = entry;

            if (flags.includes('c')) { // Create if not exists
                if (!fileEntry) {
                    if (!parentEntry || parentEntry.type !== 'dir') {
                        console.error(`open (create): Parent directory does not exist or is not a directory for ${path}`);
                        return -1;
                    }
                    const time = Date.now();
                    fileEntry = {
                        type: 'file', // Assume file for now, could be 'dir' if path ends with /
                        created: time,
                        modified: time,
                        accessed: time,
                        size: 0,
                        content: '' // Store content directly for simplicity in this localStorage driver
                    };
                    parentEntry.entries[itemName] = fileEntry;
                    // console.log(`open (create): Created file ${path}`);
                    persistDriveData();
                }
            } else if (!fileEntry) {
                console.error(`open: File not found and create flag not specified for ${path}`);
                return -1; // File not found
            }

            if (flags.includes('t') && fileEntry.type === 'file') { // Truncate if 't' and is a file
                fileEntry.content = '';
                fileEntry.size = 0;
                fileEntry.modified = Date.now();
                persistDriveData();
            }

            fileDescriptorCounter++;
            const fd = fileDescriptorCounter;
            openFiles.set(fd, {
                path: path,
                entry: fileEntry, // Direct reference to the entry in fileTable
                flags: flags,
                position: (flags.includes('a') && fileEntry.type === 'file') ? fileEntry.size : 0 // Append mode sets position to end
            });
            // console.log(`open: Opened ${path} with fd ${fd}. Flags: ${flags}`);
            return fd;
        },

        close(fd) {
            if (!openFiles.has(fd)) {
                console.error(`close: Invalid file descriptor ${fd}`);
                return -1; // Error: invalid fd
            }
            const fileData = openFiles.get(fd);
            fileData.entry.accessed = Date.now(); // Update access time on close
            openFiles.delete(fd);
            // console.log(`close: Closed fd ${fd} for path ${fileData.path}`);
            persistDriveData(); // Persist changes, e.g. access time
            return 0; // Success
        },

        read(fd, buffer, offset, length, position) {
            // This is a simplified read. `buffer` would be an ArrayBuffer/TypedArray.
            // For localStorage, we store content as string.
            // `offset` in buffer, `length` to read, `position` in file.
            if (!openFiles.has(fd)) {
                console.error(`read: Invalid file descriptor ${fd}`);
                return -1;
            }

            const fileData = openFiles.get(fd);
            if (fileData.entry.type !== 'file') {
                console.error(`read: fd ${fd} does not point to a file.`);
                return -1;
            }

            const content = fileData.entry.content || "";
            let effectivePosition = (position === null || position === undefined) ? fileData.position : position;

            if (effectivePosition >= content.length) {
                return 0; // EOF
            }

            const bytesToRead = Math.min(length, content.length - effectivePosition);
            const chunk = content.substring(effectivePosition, effectivePosition + bytesToRead);

            // Simulate writing to buffer: for this JS environment, we'll just return the string chunk
            // A real implementation would use TextEncoder and write to buffer[offset...].
            if (buffer && typeof buffer.set === 'function' && offset !== undefined) {
                 // This is a mock for demonstration. Actual ArrayBuffer handling is more complex.
                 const textEncoder = new TextEncoder();
                 const encodedChunk = textEncoder.encode(chunk);
                 if (buffer.byteLength >= offset + encodedChunk.length) {
                    buffer.set(encodedChunk, offset);
                 } else {
                    console.error("read: Buffer too small for read operation.");
                    return -1;
                 }
            }


            fileData.position = effectivePosition + bytesToRead; // Advance internal pointer
            fileData.entry.accessed = Date.now();
            // No persistDriveData() here, as read doesn't change file content/metadata that needs saving now.

            return chunk; // Return the string chunk for this simplified version
                           // Or return bytesToRead in a real ArrayBuffer scenario
        },

        write(fd, data, offset, length, position) {
            // `data` is the string/buffer to write.
            // `offset` (if data is buffer), `length` (if data is buffer).
            // `position` in file to write at.
            if (!openFiles.has(fd)) {
                console.error(`write: Invalid file descriptor ${fd}`);
                return -1;
            }

            const fileData = openFiles.get(fd);
            if (fileData.entry.type !== 'file') {
                console.error(`write: fd ${fd} does not point to a file.`);
                return -1;
            }

            if (!fileData.flags.includes('w') && !fileData.flags.includes('a')) {
                 console.error(`write: File fd ${fd} not opened in write or append mode.`);
                 return -1;
            }

            let contentToWrite = data;
            // In a real scenario, if data is ArrayBuffer, you'd use TextDecoder or handle bytes.
            // Here, we assume data is a string for simplicity with localStorage.
            if (typeof data !== 'string') {
                // Attempt to convert if it's a buffer-like object for this simulation
                if (data.buffer instanceof ArrayBuffer && typeof TextDecoder !== 'undefined') {
                    contentToWrite = new TextDecoder().decode(data);
                } else {
                    try {
                        contentToWrite = String(data);
                    } catch(e) {
                         console.error("write: Could not convert data to string.", e);
                         return -1;
                    }
                }
            }

            let currentContent = fileData.entry.content || "";
            let effectivePosition = (position === null || position === undefined) ? fileData.position : position;

            if (fileData.flags.includes('a')) { // Append mode always writes at the end
                effectivePosition = currentContent.length;
            }

            const prefix = currentContent.substring(0, effectivePosition);
            const suffix = currentContent.substring(effectivePosition + contentToWrite.length);

            fileData.entry.content = prefix + contentToWrite + suffix;
            fileData.entry.size = fileData.entry.content.length;
            fileData.entry.modified = Date.now();
            fileData.entry.accessed = Date.now();

            fileData.position = effectivePosition + contentToWrite.length; // Advance internal pointer

            persistDriveData(); // Save changes to localStorage
            // console.log(`write: Wrote to fd ${fd} for path ${fileData.path}. New size: ${fileData.entry.size}`);
            return contentToWrite.length; // Return number of bytes/chars written
        },

        stat(pathOrFd) {
            if (!fileTable) { console.error("Drive not initialized"); return null; }
            let fileEntry;

            if (typeof pathOrFd === 'number') { // It's an fd
                if (!openFiles.has(pathOrFd)) {
                    console.error(`stat: Invalid file descriptor ${pathOrFd}`);
                    return null;
                }
                fileEntry = openFiles.get(pathOrFd).entry;
            } else if (typeof pathOrFd === 'string') { // It's a path
                const { entry, error } = getPathInfo(pathOrFd);
                if (error && !entry) { // if entry exists even with error (e.g. for create checks), allow stat
                    console.error(`stat: Path error for ${pathOrFd}: ${error}`);
                    return null;
                }
                if (!entry) {
                     console.error(`stat: File not found for path ${pathOrFd}`);
                     return null;
                }
                fileEntry = entry;
            } else {
                console.error('stat: Invalid argument. Must be a path string or file descriptor number.');
                return null;
            }

            if (!fileEntry) return null; // Should have been caught by above checks

            // Return a stat object (can be extended)
            return {
                type: fileEntry.type,
                size: fileEntry.size || 0,
                created: fileEntry.created,
                modified: fileEntry.modified,
                accessed: fileEntry.accessed,
                // mode: (fileEntry.type === 'dir' ? 0o40755 : 0o100644), // Example POSIX like mode
                // ino: fileEntry.id // If we had stable inode numbers
            };
        },

        // Additional methods that might be expected by a FileSystem adapter:
        // mkdir, rmdir, unlink, readdir might be needed by higher level FileSystem class

        mkdir(path) {
            if (!fileTable) { console.error("Drive not initialized"); return -1; }
            const { entry, parentEntry, itemName, error: pathError } = getPathInfo(path);

            if (entry) {
                console.error(`mkdir: Path already exists ${path}`);
                return -1; // Already exists
            }
            if (pathError && !pathError.startsWith('Directory not found:')) { // if parent doesn't exist
                 console.error(`mkdir: Cannot create directory ${path}. Parent path error: ${pathError}`);
                 return -1;
            }
             if (!parentEntry || parentEntry.type !== 'dir') {
                console.error(`mkdir: Parent directory does not exist or is not a directory for ${path}`);
                return -1;
            }

            const time = Date.now();
            const newDirEntry = {
                type: 'dir',
                created: time,
                modified: time,
                accessed: time,
                size: 0,
                entries: {}
            };
            parentEntry.entries[itemName] = newDirEntry;
            // console.log(`mkdir: Created directory ${path}`);
            persistDriveData();
            return 0; // Success
        },

        rmdir(path) { // Remove directory (must be empty)
            if (!fileTable) { console.error("Drive not initialized"); return -1; }
            if (path === '/') {
                console.error("rmdir: Cannot remove root directory.");
                return -1;
            }
            const { entry, parentEntry, itemName, error } = getPathInfo(path);

            if (error || !entry) {
                console.error(`rmdir: Directory not found ${path}`);
                return -1;
            }
            if (entry.type !== 'dir') {
                console.error(`rmdir: Path is not a directory ${path}`);
                return -1;
            }
            if (Object.keys(entry.entries).length > 0) {
                console.error(`rmdir: Directory not empty ${path}`);
                return -1; // Not empty
            }

            delete parentEntry.entries[itemName];
            // console.log(`rmdir: Removed directory ${path}`);
            persistDriveData();
            return 0; // Success
        },

        unlink(path) { // Remove file
            if (!fileTable) { console.error("Drive not initialized"); return -1; }
             if (path === '/') {
                console.error("unlink: Cannot remove root directory with unlink.");
                return -1;
            }
            const { entry, parentEntry, itemName, error } = getPathInfo(path);

            if (error || !entry) {
                console.error(`unlink: File not found ${path}`);
                return -1;
            }
            if (entry.type === 'dir') {
                console.error(`unlink: Path is a directory, use rmdir ${path}`);
                return -1;
            }

            delete parentEntry.entries[itemName];
            // console.log(`unlink: Removed file ${path}`);
            persistDriveData();
            return 0; // Success
        },

        readdir(path) {
            if (!fileTable) { console.error("Drive not initialized"); return null; }
            const { entry, error } = getPathInfo(path);

            if (error || !entry) {
                console.error(`readdir: Directory not found or error accessing ${path}: ${error}`);
                return null;
            }
            if (entry.type !== 'dir') {
                console.error(`readdir: Path is not a directory ${path}`);
                return null;
            }
            // console.log(`readdir: Reading directory ${path}`);
            return Object.keys(entry.entries).map(name => ({ name, type: entry.entries[name].type }));
        }
    });

    // console.log("localstorage-driver.js loaded and A: drive set.");

})(); // End of IIFE
