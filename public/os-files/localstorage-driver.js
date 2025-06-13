// this file have been updated but it dependencies not updated up please updated all files where its used

let drive

const fds = new Map()
const fdIndex = 0
const closedFds = []

load()

os.drives.set('A:', {
    driveSize() {
        return drive.size
    },

    open(path, ...flags) {
        const fpath = format(path)

        let fd = -1

        if (!(fpath in table)) {
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