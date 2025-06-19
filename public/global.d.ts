interface os {
    drives: Map<string /*drive name eg: 'A:', 'B:'*/, {
        driveSize(): number
    }>,
    
    fs: {
        open(path: string, ...flags: ('read' | 'write')[]): number
        close(fd: number): void
        read(fd: number): string | null
        readdir(fd: number): string[] | never
        close(fd: number): void
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