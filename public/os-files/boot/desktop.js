function main() {
    new Desktop()
}

class Desktop {
    constructor() {
        this.display = document.createElement('div')
        this.desktop = document.createElement('div')
        
        this.display.id = 'display'
        this.desktop.id = 'desktop'

        this.display.append(this.desktop)
        document.body.append(this.display)
        
        this.#styles()
    }

    #styles() {
        document.body.style.padding = '0'
        document.body.style.margin = '0'
        document.body.style.overflow = 'hidden'

        this.display.style.display = 'flex'
        this.display.style.flexDirection = 'column'
        this.display.style.overflow = 'hidden'
        this.display.style.height = '100vh'
        this.display.style.width = '100vw'

        this.desktop.style.flexGrow = '1'
        this.desktop.style.position = 'relative'
    }
}

main()