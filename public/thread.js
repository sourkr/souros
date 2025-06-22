const AsyncFunction = async function () {}.constructor;

async function require(path) {
    const code = await sysget("require", path);
    const exports = {};
    const func = new AsyncFunction("exports", code);
    await func(exports);
    return exports;
}

function syscall(name, ...args) {
    self.postMessage({ type: "syscall", name, args });
}

(() => {
    const resolvers = new Map();
    const resolverId = 0;
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

            self.postMessage({ type: "sysget", name, args, id });
        });
    }

    window.sysget = sysget;

    self.onmessage = (ev) => {
        if (ev.data.type === "exec") {
            try {
                new AsyncFunction(ev.data.code)();
            } catch (err) {
                const lines = err.stack
                    .split("\n")
                    // .slice(0, -1)
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

                self.postMessage({ type: "error", error: err });
            }
        } else if (ev.data.type === "sysget") {
            resolvers.get(ev.data.id)(ev.data.value);
            resolvers.delete(ev.data.id);
            resolved.push(ev.data.id);
        }
    };
})();
