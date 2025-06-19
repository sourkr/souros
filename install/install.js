const btnInstall = document.getElementById('installButton')
const msg = document.getElementById('installMessage')
const time = Date.now()
const drive = createDrive()

async function installOS() {
    await updateDir('/api/os-files-content/', '/')
    localStorage.setItem('drive', JSON.stringify(drive))
}

async function updateDir(webDir, sysDir) {
    const list = await (await fetch(webDir)).json()
    const dirData = list.map(e => e.name).join('\n')
    const dirPath = sysDir == '/' ? '/' : sysDir.slice(0, -1)
    localStorage.setItem(dirPath, dirData)
    // drive.table[dirPath].size = dirData.length

    for(let entry of list) {
        if (entry.type == 'file') {
            drive.table[`${sysDir}${entry.name}`] = {
                type: 'file',
                created: time,
                modified: time,
                accessed: time,
            }

            localStorage.setItem(`${sysDir}${entry.name}`, await (await fetch(`${webDir}/${entry.name}`)).text())
        } else {
            drive.table[`${sysDir}${entry.name}`] = {
                type: 'file',
                created: time,
                modified: time,
                accessed: time,
            }

            updateDir(`${webDir}/${entry.name}`, `${sysDir}${entry.name}/`)

            // localStorage.setItem(`${sysDir}${entry.name}`, '')
        }
    }
}

function createDrive() {
    const drive =  {
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

    // localStorage.setItem('drive', JSON.stringify(drive))
    // localStorage.setItem('/', '')

    return drive
}

function getLocalStorageSizeInBytes() {
    return checkMB(5) * 1024 * 1024
}

function checkMB(size) {
    for(let i = size; i > 0; i--) {
        if (check(1024 * 1024 * i)) return size
    }
}

function check(bytes) {
    try {
        localStorage.clear()
        localStorage.setItem('a', '0'.repeat(bytes))
        localStorage.clear()
        return true
    } catch(e) {
        localStorage.clear()
        return false
    }
}