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

    function sysget(name, ...args) {
        return new Promise((resolve) => {
            let id;

            if (resolved.length) {
                id = resolved.pop();
            } else {
                id = resolverId++;
            }

            resolvers.set(id, resolve);

            self.postMessage({ cmd: "sysget", name, args, id });
        });
    }

    self.sysget = sysget;

    self.onmessage = async (ev) => {
        if (ev.data.cmd === "exec") {
            let func;

            // try {
            //     func = new AsyncFunction(ev.data.code);
            // } catch (err) {
            //     self.postMessage({ cmd: "log", msg: err });
            //     const stack = `at ${ev.data.path}`
            // }

            try {
                const func = AsyncFunction(ev.data.code);
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
                                    return `at ${ev.data.path}:${lineno - 2}:${col}`;
                                },
                            ),
                    );

                err.stack = lines.join("\n");

                self.postMessage({ cmd: "error", error: err });
            }
        } else if (ev.data.cmd === "sysget") {
            resolvers.get(ev.data.id)(ev.data.value);
            resolvers.delete(ev.data.id);
            resolved.push(ev.data.id);
        }
    };
})();
