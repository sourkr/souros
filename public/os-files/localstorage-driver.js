let drive;
const fds = new Map();
let fdIndex = 0;
const closedFds = [];

load(); // Load drive data on script initialization

os.drives.set('A:', {
    driveSize() {
        return drive.size;
    },

    open(path, ...flags) {
        const fpath = format(path);
        let fd = -1;

        if (!(fpath in drive.table)) {
            return -1;
        }

        if (closedFds.length) {
            fd = closedFds.shift();
        } else {
            fd = fdIndex++;
        }

        // Ensure flags is an array, even if no flags are passed
        const effectiveFlags = flags.length > 0 ? flags : ['read']; // Default to 'read' if no flags

        fds.set(fd, {
            path: fpath,
            flags: effectiveFlags,
            entry: drive.table[fpath]
        });
        return fd;
    },

    close(fd) {
        if (fds.has(fd)) {
            fds.delete(fd);
            closedFds.push(fd);
            return 0; // Success
        }
        console.warn(`close: FD not found '${fd}'`);
        return -1; // FD not found
    },

    read(fd) {
        if (fd === -1) {
            console.warn("read: Invalid FD (-1)");
            return null;
        }
        const entryInfo = fds.get(fd);
        if (!entryInfo) {
            console.warn(`read: FD not found '${fd}'`);
            return null;
        }
        if (!entryInfo.flags.includes('read')) {
            console.warn(`read: File descriptor '${fd}' does not have read permission.`);
            return null;
        }

        drive.table[entryInfo.path].accessed = Date.now();
        save();
        try {
            return localStorage.getItem(entryInfo.path);
        } catch (e) {
            console.error(`read: Error reading item from localStorage for path '${entryInfo.path}':`, e);
            return null;
        }
    },

    write(fd, data) {
        if (fd === -1) {
            console.warn("write: Invalid FD (-1)");
            return -1;
        }
        const entryInfo = fds.get(fd);
        if (!entryInfo) {
            console.warn(`write: FD not found '${fd}'`);
            return -1;
        }
        if (!entryInfo.flags.includes('write')) {
            console.warn(`write: File descriptor '${fd}' does not have write permission.`);
            return -1;
        }

        try {
            localStorage.setItem(entryInfo.path, data);
            drive.table[entryInfo.path].size = data.length;
            drive.table[entryInfo.path].modified = Date.now();
            save();
            return data.length;
        } catch (e) {
            console.error(`write: Error setting item to localStorage for path '${entryInfo.path}':`, e);
            // Potentially check for QuotaExceededError specifically
            return -1;
        }
    },

    stat(fd) {
        const entryInfo = fds.get(fd);
        if (!entryInfo || !entryInfo.entry) { // entryInfo.entry might be the direct metadata
                console.warn(`stat: FD not found or no entry associated '${fd}'`);
                return null; // Or appropriate error indicator
        }
        // Return a copy of the metadata stored in drive.table for that path
        const pathMeta = drive.table[entryInfo.path];
        return pathMeta ? { ...pathMeta } : null;
    },


    readdir(fd) {
        const content = this.read(fd);
        return content !== null ? content.split(',').filter(name => name.trim() !== '') : null;
    },

    mkdir(path) {
        const fpath = format(path);
        const ppath = parent(fpath);

        if (fpath in drive.table) {
            console.warn(`mkdir: Path already exists '${fpath}'`);
            return -1;
        }
        if (ppath !== '/' && !(ppath in drive.table)) { // Allow creating in root even if root meta isn't "opened"
            console.warn(`mkdir: Parent path does not exist '${ppath}'`);
            return -1;
        }
            if (ppath !== '/' && drive.table[ppath] && drive.table[ppath].type !== 'dir') {
            console.warn(`mkdir: Parent path '${ppath}' is not a directory.`);
            return -1;
        }


        const pfd = this.open(ppath, 'write', 'read');
        if (pfd === -1 && ppath !== '/') { // if parent is not root and open failed
                console.warn(`mkdir: Could not open parent directory '${ppath}' for writing.`);
                return -1;
        }

        const pdata = this.read(pfd);
        const currentParentEntries = pdata !== null ? pdata.split(',').filter(name => name.trim() !== '') : [];

        currentParentEntries.push(fname(fpath));

        if (ppath !== '/') { // Only write to parent if it's not root (root content not stored this way)
            const writeResult = this.write(pfd, currentParentEntries.join(','));
            if (writeResult === -1) {
                console.error(`mkdir: Failed to update parent directory listing for '${ppath}'`);
                if (pfd !== -1) this.close(pfd);
                return -1;
            }
        }
        if (pfd !== -1) this.close(pfd);


        const time = Date.now();
        drive.table[fpath] = {
            type: 'dir',
            created: time,
            modified: time,
            accessed: time,
            size: 0
        };

        try {
            localStorage.setItem(fpath, ''); // Initialize empty dir listing string
        } catch (e) {
            console.error(`mkdir: Error initializing localStorage for new directory '${fpath}':`, e);
            // Rollback: remove fpath from drive.table and parent listing if possible (complex)
            // For now, log error and proceed to save, which might also fail.
            // A more robust rollback would be needed for transactional integrity.
            delete drive.table[fpath]; // Basic rollback
            // TODO: remove from parent listing if added
            save();
            return -1;
        }
        save();
        return 0;
    },

    create(path) {
        const fpath = format(path);
        const ppath = parent(fpath);

        if (fpath in drive.table) {
            console.warn(`create: Path already exists '${fpath}'`);
            return -1;
        }
        if (ppath !== '/' && !(ppath in drive.table)) {
                console.warn(`create: Parent path does not exist '${ppath}'`);
            return -1;
        }
        if (ppath !== '/' && drive.table[ppath] && drive.table[ppath].type !== 'dir') {
            console.warn(`create: Parent path '${ppath}' is not a directory.`);
            return -1;
        }


        const pfd = this.open(ppath, 'write', 'read');
            if (pfd === -1 && ppath !== '/') {
                console.warn(`create: Could not open parent directory '${ppath}' for writing.`);
                return -1;
        }

        const pdata = this.read(pfd);
        const currentParentEntries = pdata !== null ? pdata.split(',').filter(name => name.trim() !== '') : [];

        currentParentEntries.push(fname(fpath));

        if (ppath !== '/') {
                const writeResult = this.write(pfd, currentParentEntries.join(','));
                if (writeResult === -1) {
                console.error(`create: Failed to update parent directory listing for '${ppath}'`);
                if (pfd !== -1) this.close(pfd);
                return -1;
            }
        }
        if (pfd !== -1) this.close(pfd);


        const time = Date.now();
        drive.table[fpath] = {
            type: 'file',
            created: time,
            modified: time,
            accessed: time,
            size: 0
        };
        try {
            localStorage.setItem(fpath, ''); // Initialize empty file content
        } catch (e) {
            console.error(`create: Error initializing localStorage for new file '${fpath}':`, e);
            delete drive.table[fpath]; // Basic rollback
            // TODO: remove from parent listing if added
            save();
            return -1;
        }
        save();
        return 0;
    },

    delete(path) {
        const fpath = format(path);

        if (!(fpath in drive.table)) {
            console.warn(`delete: Path not found '${fpath}'`);
            return -1;
        }

        if (drive.table[fpath].type !== 'file') {
            console.warn(`delete: Path '${fpath}' is not a file. Type: ${drive.table[fpath].type}`);
            return -1;
        }

        try {
            localStorage.removeItem(fpath);
        } catch (e) {
            console.error(`delete: Error removing item from localStorage for path '${fpath}':`, e);
            return -1;
        }

        delete drive.table[fpath];

        const ppath = parent(fpath);
        if (ppath && ppath in drive.table && drive.table[ppath].type === 'dir') {
            let parentContent = null;
            try {
                parentContent = localStorage.getItem(ppath);
            } catch (e) {
                    console.error(`delete: Error reading parent directory content from localStorage for '${ppath}':`, e);
                    // Continue without updating parent listing, but the FS is now inconsistent.
            }

            if (parentContent !== null) {
                let parentEntries = parentContent.split(',').filter(name => name.trim() !== '');
                const filename = fname(fpath);
                const initialLength = parentEntries.length;
                parentEntries = parentEntries.filter(entry => entry !== filename);

                if (parentEntries.length !== initialLength) {
                    try {
                        localStorage.setItem(ppath, parentEntries.join(','));
                    } catch (e) {
                        console.error(`delete: Error updating parent directory content in localStorage for '${ppath}':`, e);
                        // FS is now inconsistent.
                    }
                } else {
                    console.warn(`delete: Filename '${filename}' not found in parent directory listing '${ppath}'.`);
                }
            } else if (ppath !== '/') { // Don't warn for root if its content isn't stored/found
                console.warn(`delete: Parent directory content for '${ppath}' not found in localStorage.`);
            }
        } else if (ppath !== '/') { // Don't warn if parent is root and root is not in table (though it should be)
            console.warn(`delete: Parent directory '${ppath}' not found or not a directory.`);
        }
        save();
        console.log(`delete: File '${fpath}' deleted successfully.`);
        return 0;
    }
});

function fname(path) {
    return path.split('/').pop() || ''; // .at(-1) might not be supported in all environments, .pop() is safer.
}

function parent(path) {
    const parts = path.split('/');
    if (parts.length <= 2 && parts[0] === "" && parts[1] === "") return "/"; // handles "/"
    if (parts.length <= 2) return "/"; // handles "/foo" -> parent is "/"
    parts.pop();
    if (parts.length === 1 && parts[0] === "") return "/"; // handles if original was like "/foo"
    return parts.join('/') || '/'; // ensure root is "/" not ""
}

function format(path) {
    // Normalize to always start with '/', no trailing unless root, and no multiple slashes
    let fPath = '/' + path.split(/\/+/).filter(Boolean).join('/');
    return fPath === '' ? '/' : fPath;
}

function load() {
    try {
        const storedDrive = localStorage.getItem('drive');
        if (!storedDrive) {
            init();
        } else {
            drive = JSON.parse(storedDrive);
            // Basic validation of loaded drive structure
            if (!drive || typeof drive.table !== 'object' || !drive.table['/']) {
                console.warn("Loaded drive data is corrupted or invalid. Re-initializing.");
                init();
            }
        }
    } catch (e) {
        console.error("Error loading or parsing drive data from localStorage. Re-initializing.", e);
        init();
    }
}

function init() {
    const time = Date.now();
    const initialDriveData = {
        size: -1,
        table: {
            "/": {
                type: 'dir',
                created: time,
                modified: time,
                accessed: time,
                size: 0,
            }
        }
    };
    try {
        localStorage.setItem('drive', JSON.stringify(initialDriveData));
        // Also initialize root directory content in localStorage if not done by table setup
        localStorage.setItem('/', ''); // Root directory listing
    } catch (e) {
        console.error("Error initializing drive data in localStorage:", e);
        // If init fails, the drive might be unusable.
        // Consider setting `drive` to a minimal valid state or throwing.
        drive = { size: 0, table: {} }; // Minimal state to prevent further errors
        return; // Stop further initialization
    }
    drive = initialDriveData;
}

function save() {
    try {
        localStorage.setItem('drive', JSON.stringify(drive));
    } catch (e) {
        console.error("Error saving drive data to localStorage:", e);
        // Consider implications: future operations might use stale data if save fails.
    }
}