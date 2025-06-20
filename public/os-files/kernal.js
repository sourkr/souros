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
            
            if (file === -1) {
                console.error(`Failed to open boot file: ${path}`)
                return
            }

            try {
                const fileContent = await os.fs.read(file)
                if (fileContent === null) { // It's good practice to check if read failed too
                    console.error(`Failed to read boot file (null content): ${path}`)
                } else {
                    (new AsyncFunction(fileContent))()
                }
            } catch (err) {
                console.error(`Error executing boot file: ${path}`, err) // Log the error object too
            } finally { // Ensure close is called if file was opened
                await os.fs.close(file)
            }
        }
    }
}


os.kernel.eval(localStorage.getItem('/localstorage-driver.js'))

const dir = await os.fs.open('A:/boot/boot.txt', 'read')
if (dir === -1) {
    console.error("Failed to open A:/boot/boot.txt")
} else {
    const list = (await os.fs.read(dir)).split(/\n+/)
    await os.fs.close(dir)
    list.forEach(path => os.kernel.exec(`A:/boot/${path}`))
}