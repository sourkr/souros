// this file have been updated but it dependencies not updated up please updated all files where its used

let drive

const fds = new Map()
let fdIndex = 0
const closedFds = []

load()

os.drives.set('A:', {
    driveSize() {
        return drive.size
    },

    open(path, ...flags) {
        const fpath = format(path)

        let fd = -1

        if (!(fpath in drive.table)) { // Corrected 'table' to 'drive.table'
            return -1
        }

        if (closedFds.length) {
            fd = closedFds.shift()
        } else {
            fd = fdIndex++
        }

        fds.set(fd, {
            path: fpath,
            flags, entry: drive.table[fpath]
        })

        return fd
    },

    close(fd) {
        fds.delete(fd)
        closedFds.push(fd)
    },

    read(fd) {
        if (fd == -1) return null
        const entry = fds.get(fd)
        if (!entry.flags.includes('read')) return null

        entry.entry.accessed = Date.now()
        save()
        return localStorage.getItem(entry.path)
    },

    write(fd, data) {
        if (fd == -1) return null
        const entry = fds.get(fd)
        if (!entry.flags.includes('write')) return null

        localStorage.setItem(entry.path, data)
        entry.entry.size = data.length
        entry.entry.modified = Date.now()
        save()
    },

    stat(fd) {
        return { ...fds.get(fd).entry.entry }
    },

    readdir(fd) {
        return this.read(fd)?.split(',')
    },

    mkdir(path) {
        const fpath = format(path)
        const ppath = parent(fpath)

        const pfd = this.open(ppath, 'wirte', 'read')

        if (pfd == -1) return

        // const pentry = fds.get(fd)
        const pdata = this.read(pfd)
        const data = pdata.split(',')
        
        data.push(fname(fpath))

        pfd.write(pfd, data.join(','))

        const time = Date.now()

        drive.table[fpath] = {
            type: 'dir',
            created: time,
            modified: time,
            accessed: time,
            size: 0
        }

        save()
    },

    create(path) {
        const fpath = format(path)
        const ppath = parent(fpath)

        const pfd = this.open(ppath, 'wirte', 'read')

        if (pfd == -1) return

        // const pentry = fds.get(fd)
        const pdata = this.read(pfd)
        const data = pdata.split(',')
        
        data.push(fname(fpath))

        pfd.write(pfd, data.join(','))

        const time = Date.now()

        drive.table[fpath] = {
            type: 'file',
            created: time,
            modified: time,
            accessed: time,
            size: 0
        }

        save()
    },

    delete(path) {
        const fpath = format(path); // Use existing format function

        // 1. Check if path exists in drive.table
        if (!(fpath in drive.table)) {
            console.warn(`delete: Path not found '${fpath}'`);
            return -1; // Error: Not found
        }

        // 2. Check if it's a file
        if (drive.table[fpath].type !== 'file') {
            console.warn(`delete: Path '${fpath}' is not a file. Type: ${drive.table[fpath].type}`);
            return -1; // Error: Not a file
        }

        // 3. Attempt to remove from localStorage
        try {
            localStorage.removeItem(fpath); // Assuming files are stored with their full formatted path as key
        } catch (e) {
            console.error(`delete: Error removing item from localStorage for path '${fpath}':`, e);
            return -1; // Error: localStorage removal failed
        }

        // 4. Remove from drive.table
        delete drive.table[fpath];

        // 5. Update parent directory listing
        const ppath = parent(fpath); // Use existing parent function
        if (ppath && ppath in drive.table && drive.table[ppath].type === 'dir') {
            // Read parent directory content from localStorage
            // Note: The current driver's read/write operates on FDs.
            // This is a direct manipulation for simplicity, bypassing FD logic for this internal update.
            // A more robust implementation might use open/read/write for parent dir.
            let parentContent = localStorage.getItem(ppath);
            if (parentContent !== null) {
                let parentEntries = parentContent.split(',').filter(name => name.trim() !== '');
                const filename = fname(fpath); // Use existing fname function
                const initialLength = parentEntries.length;
                parentEntries = parentEntries.filter(entry => entry !== filename);

                if (parentEntries.length !== initialLength) {
                    localStorage.setItem(ppath, parentEntries.join(','));
                    // Update parent directory's size if it's tracked based on content length
                    // For now, size of dir is 0, so no change needed for that.
                } else {
                    console.warn(`delete: Filename '${filename}' not found in parent directory listing '${ppath}'.`);
                }
            } else {
                console.warn(`delete: Parent directory content for '${ppath}' not found in localStorage.`);
            }
        } else {
            console.warn(`delete: Parent directory '${ppath}' not found or not a directory.`);
        }

        // 6. Save drive metadata
        save(); // Use existing save function

        console.log(`delete: File '${fpath}' deleted successfully.`);
        return 0; // Success
    }
});

function fname(path) {
    return path.split('/').at(-1)
}

function parent(path) {
    return path.split('/').toSpliced(0, -1).join('/')
}

function format(path) {
    return '/' + path.split(/\/+/).filter(Boolean).join('/')
}

function load() {
    const storedDrive = localStorage.getItem('drive')

    if (!storedDrive) {
        init();
    } else {
        drive = JSON.parse(storedDrive);
    }
}

function init() {
    const time = Date.now();

    const initialDriveData = {
        size: -1, // calculated during initilization (max drive size)
        table: {
            "/": {
                type: 'dir',
                created: time,
                modified: time,
                accessed: time,
                size: 0,
            }
        }
    }
    
    localStorage.setItem('drive', JSON.stringify(initialDriveData));

    drive = initialDriveData;
}

function save() {
    localStorage.setItem('drive', JSON.stringify(drive))
}