window.os = {
    drives: new Map(),
    fs: {
        fdMap: new Map(),
        fdIndex: 0,
        closedFd: [],

        async open(path, flags) {
            const driveName = path.slice(0, 2)
            if (!os.drives.has(driveName)) return -1

            const drive = os.drives.get(driveName)
            const driveFd = await drive.open(path.slice(2), flags)

            if (driveFd == -1) return -1

            let fd = -1

            if (this.closedFd.length) {
                fd = this.closedFd.shift()
            } else {
                fd = this.fdIndex++
            }

            this.fdMap.set(fd, { fd: driveFd, drive })
            return fd
        },

        async read(fd) {
            const data = this.fdMap.get(fd)
            return await data.drive.read(data.fd)
        },

        async write(fd, str) {
            const data = this.fdMap.get(fd)
            await data.drive.write(data.fd, str)
        },

        async readdir(fd) {
            const data = this.fdMap.get(fd)
            return await data.drive.readdir(data.fd)
        },

        async mkdir(path) {
            const driveName = path.slice(0, 2)
            if (!os.drives.has(driveName)) return

            const drive = os.drives.get(driveName)
            await drive.mkdir(path.slice(2))
        },

        async close(fd) {
            const fdInfo = this.fdMap.get(fd)

            await fdInfo.drive.close(fdInfo.fd)
            this.fdMap.delete(fd)
            this.closedFd.push(fd)
        }
    },

    kernel: {
        eval(code) {
            try {
                eval(code)
            } catch (err) {
                console.log(err, path)
            }
        },

        async exec(path) {
            var file = await os.fs.open(path, 'read')
            
            try {
                (new AsyncFunction(await os.fs.read(file)))()
            } catch (err) {
                console.log(err, path)
            }

            await os.fs.close(file)
        }
    }
}

const dir = await os.fs.open('A:/boot/boot.txt', 'read')
const list = (await os.fs.read(dir)).split(/\n+/)
await os.fs.close(dir)

list.forEach(path => os.kernel.exec(`A:/boot/${path}`))