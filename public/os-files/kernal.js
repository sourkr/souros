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

    async #receive(data) {
        switch (data.cmd) {
            case "syscall": {
                const func = os.syscalls.get(data.name);
                if (typeof func !== "function")
                    throw new Error(`No such syscall: ${data.name}`);
                func(this, ...data.args);
                break;
            }

            case "sysget": {
                const func = os.sysgets.get(data.name);
                if (!func) throw new Error(`No such sysget: ${data.name}`);
                this.post({
                    cmd: "sysget",
                    id: data.id,
                    value: await func(this, ...data.args),
                });
                break;
            }

            case "end":
                if (this.keepAlive) break;

            case "exit":
                this.#onclose.forEach((listener) => listener());
                this.kill();
                break;

            case "error":
                throw data.error;

            case "log":
                console.log(data.msg);
        }
    }

    onclose(listener) {
        this.#onclose.push(listener);
    }

    keepAlive(listener) {
        this.#onclose.push(listener);
        this.keepAlive = true;
    }

    kill() {
        this.#thread.terminate();
    }

    static async create(path) {
        const proc = new Process();

        const fd = await os.fs.open(path, "read");

        if (fd === -1) {
            throw new Error(`No such file or directory: ${path}`);
        }

        const code = await os.fs.read(fd);

        await os.fs.close(fd);

        proc.post({ cmd: "exec", code, path });
        return proc
    }
}

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
            if (!data) throw new Error(`Invalid fd: ${fd}`);
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

        async stat(fd) {
            const fdInfo = this.fdMap.get(fd);
            return await fdInfo.drive.stat(fdInfo.fd);
        }
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
                console.log(lines);
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

const proc = {
    post(data) {
        if (data.cmd === "event") {
            const event = events.get(data.id);
            if (typeof event === "function") event();
        }    
    }
}

const events = new Map();
let eventId = 0;
const removedEvents = []

window.syscall = (name, ...args) => {
    const func = os.syscalls.get(name);
    if (typeof func !== "function") throw new Error(`No such syscall: ${name}`);
    return func(null, ...args);
};

window.sysget = (name, ...args) => {
    const func = os.sysgets.get(name);
    if (!func) throw new Error(`No such sysget: ${name}`);
    return func(null, ...args);
};

window.sysevent = (func) => {
    let id = -1
    if (removedEvents.length) {
        id = removedEvents.shift()
    } else {
        id = eventId++
    }
    events.set(id, func);
    return id;
}

os.registerSysget("fs.drives", () => Array.from(os.drives.keys()));
os.registerSysget("fs.drive.size", (_proc, name) => os.drives.get(name).size());
os.registerSysget("fs.drive.used", (_proc, name) => os.drives.get(name).used());

os.registerSysget("fs.open", (_proc, path, flags) => os.fs.open(path, flags));
os.registerSyscall("fs.close", (_proc, fd) => os.fs.close(fd));
os.registerSysget("fs.read", (_proc, fd) => os.fs.read(fd));
os.registerSyscall("fs.write", (_proc, fd, str) => os.fs.write(fd, str));
os.registerSysget("fs.readdir", (_proc, fd) => os.fs.readdir(fd));
os.registerSyscall("fs.mkdir", (_proc, path) => os.fs.mkdir(path));
os.registerSysget("fs.stat", (_proc, fd) => os.fs.stat(fd));

os.registerSyscall("dom.create", (_proc, id, tag) => {
    const element = document.createElement(tag);
    element.setAttribute('data-id', id);
    elements.set(id, element);
});

(async () => {
    os.registerSysget("require", async (_proc, path) => {
        const fd = await os.fs.open(path, "read");
        if (fd === -1) throw new Error(`No such file or directory: ${path}`);
        const code = await os.fs.read(fd);
        await os.fs.close(fd);
        return code;
    });

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
    window.Process = Process;
})();