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

        read(fd) {
            const data = this.fdMap.get(fd)
            return data.drive.read(data.fd)
        },

        close(fd) {
            const data = this.fdMap.get(fd)

            data.drive.close(data.fd)
            this.fdMap.delete(fd)
            this.closedFd.push(fd)
        }
    },

    kernel: {
        eval(code) {
            eval(code)
        },

        exec(path) {
            var file = os.fs.open(path, 'read')
            
            try {
                this.eval(os.fs.read(file))
            } catch (err) {
                console.error(err)
            }

            os.fs.close(file)
        }
    }
}

;(() => {
    os.kernel.eval(localStorage.getItem('/localstorage-driver.js'))

    const dir = os.fs.open('A:/boot/boot.txt', 'read')
    const list = os.fs.read(dir).split(/\n+/)

    os.fs.close(dir)

    list.forEach(path => os.kernel.exec(`A:/boot/${path}`))
})()
