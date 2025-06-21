// Basic browser app structure
const mainEle = document.createElement('div')
const inputEle = document.createElement('input')
inputEle.type = 'text'
inputEle.placeholder = 'Enter URL'
const displayEle = document.createElement('iframe') // Using iframe for simplicity
displayEle.style.width = '100%'
displayEle.style.height = 'calc(100% - 30px)' // Adjust height as needed
displayEle.style.border = 'none'

inputEle.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        let url = inputEle.value
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url // Basic URL prefixing
        }
        
        const src = `/proxy?url=${encodeURIComponent(url)}`
        inputEle.value = url

        console.log(src);
        simulate(await (await fetch(src)).text())
    }
})

mainEle.appendChild(inputEle)
mainEle.appendChild(displayEle)

const winId = os.win.openWindow()
os.win.setContent(winId, mainEle)
os.win.setTitle(winId, 'Browser')

function parseHtml(html) {
    const parser = new DOMParser()
    return parser.parseFromString(html, 'text/html')
}

function render(html, callback) {
    const dom = parseHtml(html)

    callback({ type: 'html-title', title: dom.title })
}

function simulate(html) {
    render(html, data => {
        if (data.type == 'html-title') {
            os.win.setTitle(winId, data.title)
        }
    })
}