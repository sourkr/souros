const AsyncFunction = async function () {}.constructor;

async function require(path) {
    const code = await sysget("require", path);
    const exports = {};
    let func;

    try {
        func = new AsyncFunction("exports", code);
    } catch (err) {
        postMessage({ cmd: "log", msg: err });

        const lines = err.stack.split("\n");

        lines.splice(1, 1, `    at ${path}`);
        // lines.splice(1, 0, err.msg);

        err.stack = lines.join("\n");
        throw err;
    }

    await func(exports);
    return exports;
}

function syscall(name, ...args) {
    self.postMessage({ cmd: "syscall", name, args });
}

(() => {
    const resolvers = new Map();
    let resolverId = 0;
    const resolved = [];

    const events = new Map();
    let eventId = 0;
    const removedEvents = [];

    function sysget(name, ...args) {
        return new Promise((resolve, reject) => {
            let id;

            if (resolved.length) {
                id = resolved.pop();
            } else {
                id = resolverId++;
            }

            resolvers.set(id, { resolve, reject: err => {
                reject(new Error('', { cause: err }))
            } });

            self.postMessage({ cmd: "sysget", name, args, id });
        });
    }

    function sysevent(callback) {
        let id;

        if (removedEvents.length) id = removedEvents.shift();
        else id = eventId++;

        events.set(id, callback);
        return id;
    }

    function deleteEvent(id) {
        events.delete(id);
    }

    self.sysget = sysget;
    self.sysevent = sysevent;
    self.deleteEvent = deleteEvent;

    self.onmessage = (ev) => handleMessage(ev.data);

    async function handleMessage(data) {
        switch (data.cmd) {
            case "exec":
                let func;

                try {
                    func = AsyncFunction(data.code);
                    await func();
                } catch (err) {
                    self.postMessage({ cmd: "log", msg: err.stack });

                    const lines = err.stack
                        .split("\n")
                        .slice(0, -1)
                        .map((line) =>
                            line
                                // .replace(
                                //     /at eval \(eval at <anonymous> \(.+\), <anonymous>(:\d+:\d+)\)/,
                                //     `at ${ev.data.path}$1`,
                                // )
                                // .replace(
                                //     /(at \w+) \(eval at <anonymous> \(.+\), <anonymous>(:\d+:\d+)\)/,
                                //     `$1 ${ev.data.path}$2`,
                                // )
                                .replace(
                                    /at async eval \(eval at self.onmessage \(.+\), <anonymous>:(\d+):(\d+)\)/,
                                    (_, lineno, col) => {
                                        return `at ${data.path}:${lineno - 2}:${col}`;
                                    },
                                ),
                        );

                    err.stack = lines.join("\n");

                    self.postMessage({ cmd: "error", error: err });
                }
                break;

            case "sysget":
                resolvers.get(data.id).resolve(data.value);
                resolvers.delete(data.id);
                resolved.push(data.id);
                break;

            case "event":
                events.get(data.id)();
                break;
            
            case "err":
                resolvers.get(data.id).reject(data.err);
                resolvers.delete(data.id);
                resolved.push(data.id);
                
        }
    }
})();
