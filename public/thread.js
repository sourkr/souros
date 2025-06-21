const AsyncFunction = (async function(){}).constructor

self.onmessage = ev => {
    if (ev.data.type === 'exec') {
        try {
            (new AsyncFunction(ev.data.code))()
        } catch (err) {
            const lines = err.stack.split('\n')
                // .slice(0, -1)
                .map(line => line
                    .replace(/at eval \(eval at <anonymous> \(.+\), <anonymous>(:\d+:\d+)\)/, `at ${path}$1`)
                    .replace(/(at \w+) \(eval at <anonymous> \(.+\), <anonymous>(:\d+:\d+)\)/, `$1 ${path}$2`))
            
            err.stack = lines.join('\n')
            
            self.postMessage({ type: 'error', error: err })
        }
    }
}