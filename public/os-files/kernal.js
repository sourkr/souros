window.os = {
    drives: new Map(),

    fs: {
        fdMap: new Map(),
        fdIndex: 0,
        closedFd: [],

        async open(path, flags) {
            const driveName = path.slice(0, 2);
            if (!os.drives.has(driveName)) return -1;

            const drive = os.drives.get(driveName);
            const driveFd = await drive.open(path.slice(2), flags);

            if (driveFd == -1) return -1;

            let fd = -1;

            if (this.closedFd.length) {
                fd = this.closedFd.shift();
            } else {
                fd = this.fdIndex++;
            }

            this.fdMap.set(fd, { fd: driveFd, drive });
            return fd;
        },

        async read(fd) {
            const data = this.fdMap.get(fd);
            return await data.drive.read(data.fd);
        },

        async write(fd, str) {
            const data = this.fdMap.get(fd);
            await data.drive.write(data.fd, str);
        },

        async readdir(fd) {
            const data = this.fdMap.get(fd);
            return await data.drive.readdir(data.fd);
        },

        async mkdir(path) {
            const driveName = path.slice(0, 2);
            if (!os.drives.has(driveName)) return;

            const drive = os.drives.get(driveName);
            await drive.mkdir(path.slice(2));
        },

        async close(fd) {
            const fdInfo = this.fdMap.get(fd);

            await fdInfo.drive.close(fdInfo.fd);
            this.fdMap.delete(fd);
            this.closedFd.push(fd);
        },
    },

    kernel: {
        threads: new Map(),

        eval(code) {
            try {
                eval(code);
            } catch (err) {
                console.log(err, path);
            }
        },

        async exec(path, exports = {}) {
            var file = await os.fs.open(path, "read");

            if (file === -1) {
                throw new Error(`No such file or directory: ${path}`);
            }

            try {
                const fileContent = await os.fs.read(file);
                if (fileContent === null) {
                    // It's good practice to check if read failed too
                    console.error(
                        `Failed to read boot file (null content): ${path}`,
                    );
                } else {
                    await new AsyncFunction("exports", fileContent)(exports);
                }
            } catch (err) {
                const lines = err.stack
                    .split("\n")
                    .slice(0, -1)
                    .map((line) =>
                        line
                            .replace(
                                /at eval \(eval at <anonymous> \(.+\), <anonymous>(:\d+:\d+)\)/,
                                `at ${path}$1`,
                            )
                            .replace(
                                /(at \w+) \(eval at <anonymous> \(.+\), <anonymous>(:\d+:\d+)\)/,
                                `$1 ${path}$2`,
                            ),
                    );

                err.stack = lines.join("\n");
                throw err;
            } finally {
                await os.fs.close(file);
            }
        },
    },

    syscalls: new Map(),
    sysgets: new Map(),

    registerSyscall(name, func) {
        this.syscalls.set(name, func);
    },

    registerSysget(name, func) {
        this.sysgets.set(name, func);
    },
};

window.syscall = (name, ...args) => os.syscalls.get(name)(...args);
window.sysget = (name, ...args) => os.sysgets.get(name)(...args);

class Process {
    #thread;
    #onclose = [];
    
    constructor() {
        this.#thread = new Worker("thread.js");

        this.#thread.onmessage = (ev) => this.#receive(ev.data);
    }

    post(data) {
        this.#thread.postMessage(data);
    }

    #receive(data) {
        switch (data.cmd) {
            case "exec":
                this.post({ cmd: "exec", code: data.code });
                break;

            case "syscall":
                os.syscalls.get(data.name)(this, ...data.args);
                break;

            case "sysget":
                this.post({
                    cmd: "sysget",
                    id: data.id,
                    value: os.sysgets.get(data.name)(this, ...data.args),
                });
                break;

            case "end":
                if (this.keepAlive) break;;

            case "exit":
                this.#onclose.forEach((listener) => listener());
                this.#thread.terminate();
                break;
                
            case "error":
                throw data.error;
        }
    }

    onclose(listener) {
        this.#onclose.push(listener);
    }

    keepAlive(listener) {
        this.#onclose.push(listener);
        this.keepAlive = true;
    }
    
    static async create(path) {
        const proc = new Process();

        const fd = await os.fs.open(path, "read");
        const code = await os.fs.read(fd);

        await os.fs.close(fd);

        proc.post({ cmd: "exec", code });
    }
}

(async () => {
    os.registerSysget("fs.drives", () => Array.from(os.drives.keys()));

    const loaded = new Map();

    async function require(path) {
        if (loaded.has(path)) return loaded.get(path);

        const exports = {};
        await os.kernel.exec(path, exports);

        loaded.set(path, exports);
        return exports;
    }

    os.kernel.eval(localStorage.getItem("/localstorage-driver.js"));

    const dir = await os.fs.open("A:/boot/boot.txt", "read");

    if (dir === -1) {
        throw new Error("Failed to open A:/boot/boot.txt");
    } else {
        const list = (await os.fs.read(dir)).split(/\n+/);
        await os.fs.close(dir);
        list.forEach((path) => os.kernel.exec(`A:/boot/${path}`));
    }

    window.require = require;
})();
