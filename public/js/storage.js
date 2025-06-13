'use strict';
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
            // Use getStorageType() for more accurate logging
            console.log(`Drive ${this.driveLetter} initialized with ${this.getStorageType()}.`);
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
        if (path !== this.basePath && path.endsWith('/')) {
             path = path.slice(0, -1);
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
                const createResult = this.storage.create(driverPath);
                if (createResult === -1) {
                    throw new Error(`Failed to create file entry (metadata) for: ${driverPath}. Parent directory might not exist, or path is invalid.`);
                }

                fd = this.storage.open(driverPath, 'write');
                if (fd === -1) throw new Error(`Failed to open file for writing: ${driverPath}`);

                const bytesWritten = this.storage.write(fd, stringContent);
                if (bytesWritten < 0) throw new Error(`Failed to write to file: ${driverPath}`);

                this.storage.close(fd);
                fd = -1;
                console.log(`File written (new driver): ${driverPath}`);
            } catch (error) {
                if (fd !== -1) {
                    try { this.storage.close(fd); } catch (e) { console.error("Error closing fd during error handling:", e); }
                }
                console.error(`Error writing file ${driverPath} (new driver):`, error);
                throw error;
            }
        } else {
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
            let fd = -1;
            try {
                fd = this.storage.open(driverPath, 'r');
                if (fd === -1) {
                    return null;
                }

                const stat = this.storage.stat(fd);
                if (!stat) {
                    this.storage.close(fd);
                    fd = -1;
                    return null;
                }

                if (stat.type !== 'file') {
                    this.storage.close(fd);
                    fd = -1;
                    return null;
                }

                const content = this.storage.read(fd);
                this.storage.close(fd);
                fd = -1;

                if (content === null) {
                    return null;
                }

                console.log(`File read (new driver): ${driverPath}`);
                try {
                    if (typeof content === 'string' && ((content.startsWith('{') && content.endsWith('}')) || (content.startsWith('[') && content.endsWith(']')))) {
                        return JSON.parse(content);
                    }
                    return content;
                } catch (e_parse) {
                    console.warn(`Failed to parse JSON for ${driverPath}, returning raw content. Error:`, e_parse);
                    return content;
                }
            } catch (error) {
                console.error(`Error during readFile operation for ${driverPath} (new driver):`, error);
                if (fd !== -1) {
                    try { this.storage.close(fd); } catch (closeError) {
                        console.error(`Error closing fd during error handling for ${driverPath}:`, closeError);
                    }
                }
                throw error;
            }
        } else {
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

    async deleteFile(filePath) {
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(filePath);
            try {
                const result = this.storage.delete(driverPath);
                if (result === -1) {
                    console.error(`Failed to delete file/directory (new driver): ${driverPath}. Driver indicated failure.`);
                    throw new Error(`Deletion failed for ${driverPath}.`);
                }
                console.log(`File/directory deleted (new driver): ${driverPath}`);
            } catch (error) {
                console.error(`Error during deleteFile operation for ${driverPath} (new driver):`, error);
                throw error;
            }
        } else {
            console.warn(`deleteFile called on a non-new-localStorage-driver for path: ${filePath}. This path is currently unhandled after localStorageWrapper removal.`);
            throw new Error("deleteFile is not supported for this drive type after refactoring.");
        }
    }

    async createFile(filePath, content = '') {
        return this.writeFile(filePath, content);
    }

    async createDirectory(dirPath) {
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(dirPath);
            try {
                const result = this.storage.mkdir(driverPath);
                if (result === 0) {
                    console.log(`Directory operation successful (created or already exists as dir) (new driver): ${driverPath}`);
                } else {
                    throw new Error(`Failed to create directory (new driver): ${driverPath}. Driver error code: ${result}. Possible reasons: parent path issue, or a file exists at this path.`);
                }
            } catch (error) {
                console.error(`Error creating directory ${driverPath} (new driver):`, error.message);
                throw error;
            }
        }
        console.warn(`createDirectory called for ${dirPath} on a drive type that is not the new 'A:' driver. This is currently not supported.`);
    }

    async _updateDirectoryListing(itemPath, itemType) {
        console.warn('_updateDirectoryListing is deprecated and should not be used with new drivers.');
        return;
    }

    async _removeDirectoryEntry(itemPath) {
        console.warn('_removeDirectoryEntry is deprecated and should not be used with new drivers.');
        return;
    }

    _getParentPath(filePath) {
        const normalizedPath = this._normalizePath(filePath);
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
                    console.warn(`listDirectory: Directory not found or not accessible (new driver): ${driverPath}`);
                    return [];
                }

                const dirStat = this.storage.stat(dirFd);
                if (!dirStat || dirStat.type !== 'dir') {
                    this.storage.close(dirFd);
                    console.warn(`listDirectory: Path is not a directory (new driver): ${driverPath}, type: ${dirStat ? dirStat.type : 'unknown'}`);
                    return [];
                }

                const dirContentsString = this.storage.read(dirFd);
                this.storage.close(dirFd);
                dirFd = -1;

                if (!dirContentsString) {
                    console.log(`Directory is empty or read failed (new driver): ${driverPath}`);
                    return [];
                }

                const names = dirContentsString.split(',').filter(name => name.trim() !== '');
                if (names.length === 0 && dirContentsString.length > 0) {
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
                throw error;
            }
        }
        console.warn(`listDirectory called for ${dirPath} on a drive type that is not the new 'A:' driver. This is currently not supported and will return an empty array.`);
        return [];
    }

     async exists(path) {
        if (this.isNewLocalStorageDriver) {
            const driverPath = this._getDriverPath(path);
            let fd = -1;
            try {
                fd = this.storage.open(driverPath, 'r');
                if (fd === -1) {
                    return false;
                }
                const statInfo = this.storage.stat(fd);
                this.storage.close(fd);
                fd = -1;
                return !!statInfo;
            } catch (error) {
                if (fd !== -1) {
                    try { this.storage.close(fd); } catch (e) { console.error("Error closing fd during exists error handling:", e); }
                }
                console.warn(`Exists check failed for ${driverPath} (new driver):`, error.message);
                return false;
            }
        }
        console.warn(`exists check for ${path} on a drive type that is not the new 'A:' driver. This is currently not supported and will return false.`);
        return false;
    }

    async rename(oldPath, newPath) {
        if (this.isNewLocalStorageDriver) {
            const oldDriverPath = this._getDriverPath(oldPath);
            const newDriverPath = this._getDriverPath(newPath);
            console.warn(`rename operation is not supported for Drive A (new driver) due to missing driver primitives: ${oldDriverPath} to ${newDriverPath}. No action taken.`);
            throw new Error(`Rename operation not supported by this driver for paths: ${oldDriverPath} to ${newDriverPath}`);
        }
        console.warn(`rename called for ${oldPath} to ${newPath} on a drive type that is not the new 'A:' driver. This is currently not supported.`);
        throw new Error(`Rename not supported for this drive type.`);
    }

    getDriveLetter() {
        return this.driveLetter;
    }

    getStorageType() {
        if (this.isNewLocalStorageDriver) return 'localStorage (New Driver)';
        if (this.storage && typeof this.storage.getStorageType === 'function') {
            return this.storage.getStorageType();
        }
        if (this.storage && typeof this.storage.openDB === 'function') {
            return 'IndexedDB';
        }
        return 'custom/unknown';
    }
}


// --- Drive Management ---
const Drives = {
    A: new FileSystem('A:', window.os && window.os.drives && window.os.drives.get('A:')),
    B: null,
};

if (Drives.A && !Drives.A.storage) {
    console.error("FATAL: Drive A could not be initialized because no storage driver was provided (window.os.drives.get('A:') was not available). Drive A will be unusable.");
    Drives.A = null;
}

Drives.getDrive = function(letter) {
    const drive = letter.toUpperCase();
    if (this[drive]) {
        return this[drive];
    }
    console.warn(`Drive ${drive} not found or not initialized.`);
    return null;
}; // Semicolon here, removed comma from after

Drives.addDrive = function(letter, storageAdapter) {
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
    let adapterType = 'custom adapter';
    if (storageAdapter && typeof storageAdapter.getStorageType === 'function') {
        adapterType = storageAdapter.getStorageType();
    } else if (storageAdapter && typeof storageAdapter.openDB === 'function') {
        adapterType = 'IndexedDB';
    }
    console.log(`Drive ${drive}: added with ${adapterType}.`);
    return this[drive];
};

window.WebOSFileSystem = {
    _getDriveAndPath: function(fullPath) {
        if (!fullPath || typeof fullPath !== 'string' || fullPath.indexOf(':') === -1) {
            throw new Error("Invalid path. Must include drive letter (e.g., 'A:/path/to/file.txt').");
        }
        const driveLetter = fullPath.substring(0, 1).toUpperCase();
        const path = fullPath.substring(2);

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

    listDirectory: async function(fullPath = 'A:/') {
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
            console.log(`Performing cross-drive rename from ${oldFullPath} to ${newFullPath}`);
            const content = await oldDrive.readFile(oldPath);
            if (oldFullPath.endsWith('/')) {
                 console.warn("Cross-drive rename of directories needs recursive copy. This basic version may not fully support it.");
                 await newDrive.createDirectory(newPath);
                 const entries = await oldDrive.listDirectory(oldPath);
                 for (const entry of entries) {
                     const oldEntryFullPath = oldFullPath + entry.name + (entry.type === 'directory' ? '/' : '');
                     const newEntryFullPath = newFullPath + entry.name + (entry.type === 'directory' ? '/' : '');
                     await this.rename(oldEntryFullPath, newEntryFullPath);
                 }
                 await oldDrive.deleteFile(oldPath);

            } else {
                await newDrive.writeFile(newPath, content);
                await oldDrive.deleteFile(oldPath);
            }

        } else {
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
};

// --- Example Usage (logging to console) ---
(async () => {
    if (typeof window === 'undefined' || (window.location && (window.location.pathname.includes('install.html') || window.location.pathname.includes('installer.html')))) {
        // Don't run example usage if not in the main app context or if it's the installer itself
        return;
    }
    console.log("--- FileSystem API Example Usage ---");

    if (Drives.B) { // Check if Drive B was successfully initialized by indexdb-driver.js
        console.log("Drive B (IndexedDB) is available for examples.");
    } else {
        console.log("Drive B (IndexedDB) is not available/initialized for these examples (indexdb-driver.js might not have run or registered it yet).");
    }

    try {
        // Create a directory
        await WebOSFileSystem.createDirectory('A:/mydocs');
        await WebOSFileSystem.createDirectory('A:/mydocs/textfiles');
        if (Drives.B) {
            await WebOSFileSystem.createDirectory('B:/mydata');
        }

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

        // Rename a file (Commented out as it's known to fail for Drive A's current driver)
        // await WebOSFileSystem.rename('A:/mydocs/textfiles/example.txt', 'A:/mydocs/textfiles/renamed_example.txt');
        // console.log('Renamed example.txt. Listing A:/mydocs/textfiles/ again:');
        // console.log(await WebOSFileSystem.listDirectory('A:/mydocs/textfiles/'));

        // Rename a directory (Commented out as it's known to fail for Drive A's current driver)
        // await WebOSFileSystem.rename('A:/mydocs/textfiles/', 'A:/mydocs/renamed_textfiles/');
        // console.log('Renamed textfiles directory. Listing A:/mydocs/ again:');
        // console.log(await WebOSFileSystem.listDirectory('A:/mydocs/'));
        // console.log('Listing A:/mydocs/renamed_textfiles/:');
        // console.log(await WebOSFileSystem.listDirectory('A:/mydocs/renamed_textfiles/'));

        if (Drives.B) {
            await WebOSFileSystem.writeFile('B:/mydata/test_b_drive.txt', 'Data on Drive B (IndexedDB)');
            const bContent = await WebOSFileSystem.readFile('B:/mydata/test_b_drive.txt');
            console.log('Read from B:/mydata/test_b_drive.txt:', bContent);
            let bFiles = await WebOSFileSystem.listDirectory('B:/mydata/');
            console.log('Files in B:/mydata/:', bFiles);
        }

        console.log("--- End of FileSystem API Example Usage ---");
    } catch (error) {
        console.error("Error during FileSystem API example usage:", error);
    }

    // Log available drives
    console.log("Available drives:", WebOSFileSystem.getDrives());

})();

// The late initialization block for Drive B using the internal indexedDBWrapper has been removed.
// indexdb-driver.js will be responsible for registering Drive B.

// Ensure window.os exists
window.os = window.os || {};

window.os.fs = {
    _resolvePath: function(path) {
        if (!path || typeof path !== 'string') {
            throw new Error("Invalid path provided.");
        }
        // Check if path already includes a drive letter (e.g., "A:/foo.txt")
        if (/^[A-Za-z]:/.test(path)) {
            return path;
        }
        // Default to Drive A for paths like "/foo.txt" or "foo.txt"
        let newPath = path;
        if (path.startsWith('/')) {
            newPath = 'A:' + path;
        } else {
            newPath = 'A:/' + path;
        }
        // console.log(`os.fs._resolvePath: original='${path}', resolved='${newPath}'`);
        return newPath;
    },

    open: async function(path, flags = 'r') {
        const fullPath = this._resolvePath(path);
        try {
            const { drive, path: drivePath } = window.WebOSFileSystem._getDriveAndPath(fullPath);
            if (!drive || !drive.storage || typeof drive.storage.open !== 'function') {
                console.error(`os.fs.open: Could not get a valid driver for path '${fullPath}'.`);
                return null; // Indicate failure
            }
            let driverFlags = [];
            if (flags.includes('r') || flags.includes('read')) driverFlags.push('read');
            if (flags.includes('w') || flags.includes('write')) driverFlags.push('write');

            const actualFd = drive.storage.open(drivePath, ...driverFlags);
            if (actualFd === -1) {
                 console.warn(`os.fs.open: Driver failed to open '${fullPath}' (driver path '${drivePath}')`);
                 return null; // Indicate failure
            }
            return { fd: actualFd, driveLetter: drive.getDriveLetter().charAt(0) }; // Return object
        } catch (e) {
            console.error(`os.fs.open: Error opening file '${fullPath}':`, e);
            return null; // Indicate failure
        }
    },

    read: async function(fdObj) {
        if (!fdObj || typeof fdObj.fd === 'undefined' || !fdObj.driveLetter) {
            console.error("os.fs.read: Invalid FD object provided.");
            return null;
        }
        const drive = window.WebOSFileSystem.getDrive(fdObj.driveLetter);
        if (drive && drive.storage && typeof drive.storage.read === 'function') {
            try {
                return drive.storage.read(fdObj.fd);
            } catch (e) {
                console.error(`os.fs.read: Error reading fd '${fdObj.fd}' on Drive ${fdObj.driveLetter}:`, e);
                return null;
            }
        }
        console.error(`os.fs.read: Drive ${fdObj.driveLetter} not available or does not support read(fd).`);
        return null;
    },

    write: async function(fdObj, data) {
        if (!fdObj || typeof fdObj.fd === 'undefined' || !fdObj.driveLetter) {
            console.error("os.fs.write: Invalid FD object provided.");
            return -1;
        }
        const drive = window.WebOSFileSystem.getDrive(fdObj.driveLetter);
        if (drive && drive.storage && typeof drive.storage.write === 'function') {
            try {
                return drive.storage.write(fdObj.fd, data);
            } catch (e) {
                console.error(`os.fs.write: Error writing fd '${fdObj.fd}' on Drive ${fdObj.driveLetter}:`, e);
                return -1;
            }
        }
        console.error(`os.fs.write: Drive ${fdObj.driveLetter} not available or does not support write(fd).`);
        return -1;
    },

    create: async function(path) {
        const fullPath = this._resolvePath(path);
        try {
            await window.WebOSFileSystem.createFile(fullPath, '');
            return 0; // Success
        } catch (e) {
            console.error(`os.fs.create: Error creating file '${fullPath}':`, e);
            return -1; // Failure
        }
    },

    mkdir: async function(path) {
        const fullPath = this._resolvePath(path);
        try {
            await window.WebOSFileSystem.createDirectory(fullPath);
            return 0; // Success
        } catch (e) {
            console.error(`os.fs.mkdir: Error creating directory '${fullPath}':`, e);
            return -1; // Failure
        }
    },

    close: async function(fdObj) {
        if (!fdObj || typeof fdObj.fd === 'undefined' || !fdObj.driveLetter) {
            console.error("os.fs.close: Invalid FD object provided.");
            return -1;
        }
        const drive = window.WebOSFileSystem.getDrive(fdObj.driveLetter);
        if (drive && drive.storage && typeof drive.storage.close === 'function') {
            try {
                drive.storage.close(fdObj.fd);
                return 0; // Success
            } catch (e) {
                console.error(`os.fs.close: Error closing fd '${fdObj.fd}' on Drive ${fdObj.driveLetter}:`, e);
                return -1;
            }
        }
        console.error(`os.fs.close: Drive ${fdObj.driveLetter} not available or does not support close(fd).`);
        return -1;
    },

    delete: async function(path) {
        const fullPath = this._resolvePath(path);
        try {
            await window.WebOSFileSystem.deleteFile(fullPath);
            return 0; // Success
        } catch (e) {
            console.error(`os.fs.delete: Error deleting '${fullPath}':`, e);
            return -1; // Failure
        }
    }
};
console.log("window.os.fs API implemented, primarily operating on Drive A for FD methods.");
