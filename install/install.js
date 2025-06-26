document.addEventListener('DOMContentLoaded', () => {
    const btnInstall = document.getElementById('installButton')
    const msg = document.getElementById('installMessage')
    const progressBarContainer = document.querySelector('.progress-bar-container')
    const progressBar = document.querySelector('.progress-bar')
    const time = Date.now()

    let drive = createDrive()

    btnInstall.addEventListener('click', async () => {
        btnInstall.disabled = true
        msg.textContent = 'Starting installation...'
        progressBarContainer.style.display = 'block'
        progressBar.style.width = '0%'

        try {
            await installOS()
            localStorage.setItem('drive', JSON.stringify(drive))
            msg.textContent = 'OS Installed Successfully!'
            progressBar.style.width = '100%'
        } catch (error) {
            msg.textContent = `Installation failed: ${error.message}`
            btnInstall.disabled = false
        }
    })

    async function installOS() {
        const initialPath = '/api/os-files-content/'
        const fileList = await (await fetch(initialPath)).json()
        const totalFiles = await countFiles(initialPath, fileList)
        let filesProcessed = 0

        await updateDir(initialPath, '/', fileList, (processed) => {
            filesProcessed += processed
            const progress = (filesProcessed / totalFiles) * 100
            progressBar.style.width = `${progress}%`
            msg.textContent = `Installing... (${filesProcessed}/${totalFiles} files)`
        })
    }

    async function countFiles(webDir, list) {
        let count = list.filter(e => e.type === 'file').length
        for (let entry of list) {
            if (entry.type === 'dir') {
                const subList = await (await fetch(`${webDir}${entry.name}/`)).json()
                count += await countFiles(`${webDir}${entry.name}/`, subList)
            }
        }
        return count
    }

    async function updateDir(webDir, sysDir, list, progressCallback) {
        const dirData = list.map(e => e.name).join('\n')
        const dirPath = sysDir === '/' ? '/' : sysDir.slice(0, -1)
        localStorage.setItem(dirPath, dirData)

        for (let entry of list) {
            if (entry.type === 'file') {
                drive.table[`${sysDir}${entry.name}`] = {
                    type: 'file',
                    created: time,
                    modified: time,
                    accessed: time,
                }
                localStorage.setItem(`${sysDir}${entry.name}`, await (await fetch(`${webDir}${entry.name}`)).text())
                progressCallback(1)
            } else {
                drive.table[`${sysDir}${entry.name}`] = {
                    type: 'dir',
                    created: time,
                    modified: time,
                    accessed: time,
                }
                const subList = await (await fetch(`${webDir}${entry.name}/`)).json()
                await updateDir(`${webDir}${entry.name}/`, `${sysDir}${entry.name}/`, subList, progressCallback)
            }
        }
    }

    function createDrive() {
        return {
            size: getLocalStorageSizeInBytes(),
            table: {
                '/': {
                    type: 'dir',
                    created: time,
                    modified: time,
                    accessed: time,
                }
            }
        }
    }

    function getLocalStorageSizeInBytes() {
        // This is a rough estimation
        return 5 * 1024 * 1024 // 5MB
    }
})