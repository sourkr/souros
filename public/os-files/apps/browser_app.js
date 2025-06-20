// Basic browser app structure
const mainEle = document.createElement('div')
const inputEle = document.createElement('input')
inputEle.type = 'text'
inputEle.placeholder = 'Enter URL'
const displayEle = document.createElement('iframe') // Using iframe for simplicity
displayEle.style.width = '100%'
displayEle.style.height = 'calc(100% - 30px)' // Adjust height as needed
displayEle.style.border = 'none'

inputEle.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let url = inputEle.value
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url // Basic URL prefixing
        }
        displayEle.src = url
    }
})

mainEle.appendChild(inputEle)
mainEle.appendChild(displayEle)

// os.win.setContent should be called with mainEle
// This part will be handled by the OS when launching the app
