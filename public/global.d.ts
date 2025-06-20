interface os {
    drives: Map<string /*drive name eg: 'A:', 'B:'*/, {
        async size(): number
        async used(): number
    }>,
    
    fs: {
        async open(path: string, ...flags: ('read' | 'write')[]): number
        async close(fd: number): void
        async read(fd: number): string | null
        async readdir(fd: number): string[] | never
        async close(fd: number): void
    }

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