window.os = {
    drives: new Map(),
    fs: {
        fdMap: new Map(),
        fdIndex: 0,
        closedFd: [],

        open(path, flags) {
            const driveName = path.slice(0, 2)
            if (!os.drives.has(driveName)) return -1

            const drive = os.drives.get(driveName)
            const driveFd = drive.open(path.slice(2), flags)

            let fd = -1

            if (this.closedFd.length) {
                fd = this.closedFd.shift()
            } else {
                fd = this.fdIndex++
            }

            this.fdMap.set(fd, { fd: driveFd, drive })
            return fd
        },

        close(fd) {
            const data = this.fdMap.get(fd)

            data.drive.close(data.fd)
            this.fdMap.delete(fd)
            this.closedFd.push(fd)
        }
    },

    kernal: {
        eval(code) {
            eval(code)
        }
    }
}

os.kernal.eval(localStorage.getItem('/localstorage-driver.js'))