exports.svg = async path => {
    const fd = await os.fs.open(path, 'read')
    
    if (fd === -1) {
        throw new Error(`No such file or directory: ${path}`)
    }

    base64 = btoa(await os.fs.read(fd))
    await os.fs.close(fd)

    return `data:image/svg+xml;base64,${base64}`
}