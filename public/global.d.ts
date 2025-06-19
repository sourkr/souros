interface os {
    fs: {
        open(path: string, flags: ('read' | 'write')[]): number
        close(fd: number): void
        read(fd: number): string
        readdir(fd: number): string[]
        close(fd: number): void
    },

    win: {
        openWindow(): number
        setTitle(id: number, title: string): void
        setContent(id: number, ele: HTMLElement)
        close(id: number): void
    }

    kernal: {
        exec(path: string): void
    }
}