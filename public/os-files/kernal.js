window.os = {
    drives: new Map(),
    fs: {
        fdMap: new Map(),
        fdIndex: 0,
        closedFd: [],

        open(path, flags) {
            const driveName = path.slice(0, 2)
            if (!os.drives.has(driveName)) return -1

            const drive = os.drives.get(driveName)
            const driveFd = drive.open(path.slice(2), flags)

            if (driveFd == -1) return -1

            let fd = -1

            if (this.closedFd.length) {
                fd = this.closedFd.shift()
            } else {
                fd = this.fdIndex++
            }

            this.fdMap.set(fd, { fd: driveFd, drive })
            return fd
        },

        read(fd) {
            const data = this.fdMap.get(fd)
            return data.drive.read(data.fd)
        },

        write(fd, str) {
            const data = this.fdMap.get(fd)
            data.drive.write(data.fd, str)
        },

        readdir(fd) {
            const data = this.fdMap.get(fd)
            return data.drive.readdir(data.fd)
        },

        mkdir(path) {
            const driveName = path.slice(0, 2)
            if (!os.drives.has(driveName)) return

            const drive = os.drives.get(driveName)
            drive.mkdir(path.slice(2))
        },

        close(fd) {
            const fdInfo = this.fdMap.get(fd); // 'this' refers to os.fs

            if (!fdInfo) {
                console.warn(`os.fs.close: File descriptor ${fd} not found in fdMap. Already closed or invalid.`);
                return -1; // Error code for invalid FD
            }

            // fdInfo.drive is the correct driver instance stored by os.fs.open
            if (fdInfo.drive && typeof fdInfo.drive.close === 'function') {
                const result = fdInfo.drive.close(fdInfo.fd); // Call the actual driver's close method

                // Regardless of the driver's close result, we should clean up the global FD map
                // if the driver's close was attempted. If driver.close indicates an error,
                // the OS layer has still "closed" its global FD.
                this.fdMap.delete(fd);
                this.closedFd.push(fd); // Add to pool of reusable FDs

                return result; // Propagate driver's result (e.g., 0 for success, -1 for error)
            } else {
                console.error(`os.fs.close: Driver instance or close method not found for FD ${fd} in fdInfo. This indicates a corrupted fdMap entry.`);
                // Still remove the corrupted entry from fdMap
                this.fdMap.delete(fd);
                this.closedFd.push(fd);
                return -1; // Error
            }
        }
    },

    kernel: {
        eval(code) {
            try {
                eval(code)
            } catch (err) {
                console.log(err, path)
            }
        },

        exec(path) {
            var file = os.fs.open(path, 'read')
            
            try {
                this.eval(os.fs.read(file))
            } catch (err) {
                console.log(err, path)
            }

            os.fs.close(file)
        }
    }
}

// Initializes core systems like localStorage drive and the dynamic IndexedDB drive
async function initializeCoreSystemsAndDrives() {
    console.log("Kernel: Initializing core systems and drives...");

    try {
        const idbDriverScript = localStorage.getItem('/indexdb-driver.js'); // Path assumption
        if (idbDriverScript) {
            // Use os.kernel.eval for consistency if it provides better error context, though direct eval is fine here.
            os.kernel.eval(idbDriverScript);
            console.log('Kernel: indexdb-driver.js (from localStorage) evaluated.');
        } else {
            // This is a critical failure if the drive is expected to be configurable.
            throw new Error('indexdb-driver.js not found in localStorage.');
        }
    } catch (e) {
        console.error('Kernel: Critical error loading or evaluating /indexdb-driver.js. IndexedDB drive will be unavailable.', e);
        alert('Critical Boot Error: Could not load /indexdb-driver.js. IndexedDB drive will be unavailable.');
        // The rest of the function will proceed, but the check for
        // window.FileSystemDrivers.IndexDBRevised will fail, preventing its use.
    }

    try {
        const localStorageDriverCode = localStorage.getItem('/localstorage-driver.js');
        if (localStorageDriverCode) {
            os.kernel.eval(localStorageDriverCode); // This script likely calls os.drives.set('A:', ...)
            console.log('Kernel: localStorage-driver.js evaluated.');
            if (os.drives.has('A:')) {
                console.log('Kernel: Drive A: (LocalStorage) registered.');
            } else {
                console.warn('Kernel: Drive A: (LocalStorage) did not register itself as expected.');
            }
        } else {
            console.warn('Kernel: /localstorage-driver.js not found in localStorage. Drive A: will be unavailable.');
        }
    } catch (e) {
        console.error('Kernel: Error loading localStorage-driver for Drive A:', e);
    }
  
    try {
        const browserStorageDriverScript = localStorage.getItem('/browser-storage-driver.js'); // Path assumption
        if (browserStorageDriverScript) {
            os.kernel.eval(browserStorageDriverScript); // Use os.kernel.eval for consistency
            console.log('Kernel: browser-storage-driver.js (from localStorage) evaluated.');
            // The driver self-registers if window.os and window.os.drives exist.
            // window.os.drives is initialized when window.os is defined.
            if (os.drives.has('C:')) {
                 console.log('Kernel: Drive C: (BrowserStorage) registered.');
            } else {
                console.warn('Kernel: Drive C: (BrowserStorage) did not self-register as expected.');
            }
        } else {
            // This might not be critical enough to throw/alert, but good to note.
            console.warn('Kernel: browser-storage-driver.js not found in localStorage. Drive C may be unavailable.');
        }
    } catch (e) {
        console.error('Kernel: Error loading or evaluating /browser-storage-driver.js. Drive C may be unavailable.', e);
    }

    // Dynamic setup for IndexedDB Drive (e.g., B:, D:, E:, F:)
    let storageConfig = null;
    try {
        const configStr = localStorage.getItem('webOS_storageConfig');
        if (configStr) {
            storageConfig = JSON.parse(configStr);
        }
    } catch (e) {
        console.error('Kernel: Error parsing webOS_storageConfig:', e);
    }

    if (storageConfig && storageConfig.indexedDBDrive && storageConfig.indexedDBDrive.configured && storageConfig.indexedDBDrive.mounted) {
        const idbDriveConfig = storageConfig.indexedDBDrive;
        // Ensure driveLetter is a single character, as customLetter might be just the letter.
        const driveLetter = (idbDriveConfig.customLetter || idbDriveConfig.driveLetter || 'B').charAt(0);
        const sizeMB = idbDriveConfig.sizeMB || 256; // Default size if not specified
        const sizeBytes = sizeMB * 1024 * 1024;

        if (window.FileSystemDrivers && window.FileSystemDrivers.IndexDBRevised) {
            try {
                // Assuming IndexDBRevised is the driver object itself, not a class constructor
                // If it were a class: const idbDriverInstance = new window.FileSystemDrivers.IndexDBRevised();
                const idbDriverInstance = window.FileSystemDrivers.IndexDBRevised;

                console.log(`Kernel: Configuring IndexedDB Drive ${driveLetter}: with ${sizeMB}MB...`);
                const mountSuccess = await idbDriverInstance.configureAndMount(driveLetter, sizeBytes);

                if (mountSuccess) {
                    os.drives.set(driveLetter + ':', idbDriverInstance);
                    console.log(`Kernel: IndexedDB Drive ${driveLetter}: mounted successfully.`);
                } else {
                    console.error(`Kernel: Failed to mount IndexedDB Drive ${driveLetter}:`);
                    alert(`Critical: Could not mount primary drive ${driveLetter}:. Operating system may not function correctly.`);
                }
            } catch (err) {
                console.error(`Kernel: Error during configuration or mounting of IndexedDB Drive ${driveLetter}:`, err);
            }
        } else {
            console.error(`Kernel: IndexDBRevised driver not found for IndexedDB Drive ${driveLetter}:`);
        }
    } else {
        console.log('Kernel: IndexedDB Drive is not configured or not set to mount via webOS_storageConfig.');
        // Optionally, inform the user that they might need to run setup or check config.
        // alert("Primary data drive not configured. Some OS features might be limited. Please check storage setup.");
    }
    console.log('Kernel: Core systems and drive initialization attempt complete.');
}

// Main Boot Sequence (IIFE)
;(async () => {
    await initializeCoreSystemsAndDrives();

    // The browser-storage-driver for C: typically self-registers if os.drives exists.
    // We ensure os.drives is created before this point.
    // If it's loaded via boot.txt, it will find os.drives ready.
    // If it was loaded even before kernal.js, it might not have found os.drives.
    // For robustness, could explicitly initialize it here if not present.
    if (window.FileSystemDrivers && window.FileSystemDrivers.BrowserStorage && !os.drives.has('C:')) {
        try {
            // This assumes BrowserStorageDriver was changed to expose a class/factory
            // and not just self-register. If it still self-registers, this check is just informative.
            // const driveC = new window.FileSystemDrivers.BrowserStorage();
            // driveC.configureAndMount('C', SOME_DEFAULT_SIZE_IF_NEEDED); // If it needs config
            // os.drives.set('C:', driveC);
            // console.log('Kernel: Drive C: (BrowserStorage) explicitly initialized.');
            console.log('Kernel: Drive C: (BrowserStorage) should self-register if loaded.');
        } catch (e) {
            console.warn('Kernel: Failed to explicitly initialize BrowserStorage driver for Drive C:', e);
        }
    }

    if (!os.drives.has('A:')) {
        console.error("Kernel: Drive A: not available. Cannot read /boot/boot.txt. System halt.");
        alert("CRITICAL ERROR: Drive A: (localStorage) failed to load. OS cannot boot.");
        return;
    }

    const dir = os.fs.open('A:/boot/boot.txt', 'read');
    if (dir === -1) {
        console.error("Kernel: Failed to open A:/boot/boot.txt. System halt.");
        alert("CRITICAL ERROR: Cannot open A:/boot/boot.txt. OS cannot boot.");
        return;
    }
    const listContent = os.fs.read(dir);
    os.fs.close(dir);

    if (listContent === null) {
        console.error("Kernel: Failed to read A:/boot/boot.txt or file is empty. System halt.");
        alert("CRITICAL ERROR: Cannot read A:/boot/boot.txt or it's empty. OS cannot boot.");
        return;
    }
    const list = listContent.split(/\n+/).filter(p => p.trim() !== '');

    os.fs.close(dir)

    list.forEach(path => os.kernel.exec(`A:/boot/${path}`))
})()
