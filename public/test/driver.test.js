// public/test/driver.test.js
(async () => {
    if (!window.TestRunner) {
        console.error("TestRunner not found. Ensure test_runner.js is loaded before driver.test.js")
        // Display error on page
        const resultsEl = document.getElementById('test-results')
        if (resultsEl) {
            const li = document.createElement('li')
            li.className = 'fail'
            li.textContent = 'Critical Error: TestRunner not found. Check script order.'
            resultsEl.appendChild(li)
        }
        return
    }

    const { register, run } = TestRunner

    register('1. Check if WebOSFileSystem is available', () => {
        if (!window.WebOSFileSystem) throw new Error('WebOSFileSystem not found on window.')
        if (typeof window.WebOSFileSystem.writeFile !== 'function') throw new Error('WebOSFileSystem.writeFile is not a function.')
        const driveA = window.WebOSFileSystem.getDrive('A')
        if (!driveA) throw new Error('Drive A not found in WebOSFileSystem.')
        if (!driveA.isNewLocalStorageDriver) {
            // This is a warning rather than a strict fail, as fallback might be intended in some scenarios.
            // However, for this test suite, we expect the new driver.
            console.warn('Test Warning: Drive A is not using the new localStorage driver.')
            // Optionally, throw an error if strict adherence is required:
            // throw new Error('Drive A is not using the new localStorage driver as expected for these tests.');
        }
    })

    register('2. Write a file to A:/test/driver_test_file.txt', async () => {
        await window.WebOSFileSystem.createDirectory('A:/test/') // Ensure parent directory exists
        await window.WebOSFileSystem.writeFile('A:/test/driver_test_file.txt', 'Hello from driver test!')
        const exists = await window.WebOSFileSystem.exists('A:/test/driver_test_file.txt')
        if (!exists) throw new Error('File was not written or does not exist.')
    })

    register('3. Read the file from A:/test/driver_test_file.txt', async () => {
        const content = await window.WebOSFileSystem.readFile('A:/test/driver_test_file.txt')
        if (content !== 'Hello from driver test!') {
            throw new Error(`File content mismatch. Expected "Hello from driver test!", got "${content}"`)
        }
    })

    register('4. Create a directory A:/test_dir/', async () => {
        await window.WebOSFileSystem.createDirectory('A:/test_dir/')
        const exists = await window.WebOSFileSystem.exists('A:/test_dir/')
        if (!exists) throw new Error('Directory A:/test_dir/ was not created or does not exist.')

        const driveA = window.WebOSFileSystem.getDrive('A')
        if (driveA.isNewLocalStorageDriver) {
            const statInfo = driveA.storage.stat('/test_dir/') // Path for driver is relative to root
            if (!statInfo || statInfo.type !== 'dir') {
                throw new Error('Driver stat does not report /test_dir/ as type dir.')
            }
        } else {
            console.warn('Skipping driver specific stat check for A:/test_dir/ as new driver is not active for A:')
        }
    })

    register('5. List directory A:/test/', async () => {
        await window.WebOSFileSystem.writeFile('A:/test/another_file.txt', 'content') // Ensure another file
        const listing = await window.WebOSFileSystem.listDirectory('A:/test/')
        if (!Array.isArray(listing)) throw new Error('Listing for A:/test/ is not an array.')

        const expectedFile1 = listing.find(item => item.name === 'driver_test_file.txt')
        if (!expectedFile1 || expectedFile1.type !== 'file') {
            throw new Error('driver_test_file.txt not found in A:/test/ listing or not a file.')
        }
        const expectedFile2 = listing.find(item => item.name === 'another_file.txt')
         if (!expectedFile2 || expectedFile2.type !== 'file') {
            throw new Error('another_file.txt not found in A:/test/ listing or not a file.')
        }
    })

    register('6. Delete the file A:/test/driver_test_file.txt', async () => {
        await window.WebOSFileSystem.deleteFile('A:/test/driver_test_file.txt')
        const exists = await window.WebOSFileSystem.exists('A:/test/driver_test_file.txt')
        if (exists) throw new Error('File A:/test/driver_test_file.txt was not deleted.')
    })

    register('7. Delete the directory A:/test_dir/', async () => {
        // Ensure it's empty first for some rmdir implementations if deleteFile doesn't recurse
        // For this test, assume deleteFile on a dir path calls the appropriate rmdir for the new driver
        await window.WebOSFileSystem.deleteFile('A:/test_dir/')
        const exists = await window.WebOSFileSystem.exists('A:/test_dir/')
        if (exists) throw new Error('Directory A:/test_dir/ was not deleted.')
    })

    // Tests for installation logic
    register('8. [Install Test] Create A:/system_test_install directory', async () => {
        await window.WebOSFileSystem.createDirectory('A:/system_test_install/') // Use a test-specific path
        const exists = await window.WebOSFileSystem.exists('A:/system_test_install/')
        if (!exists) throw new Error('Directory A:/system_test_install/ was not created.')
    })

    register('9. [Install Test] Write A:/system_test_install/os_config.json', async () => {
        const defaultConfig = { version: '1.0.0', installedAt: 'test_time' }
        await window.WebOSFileSystem.writeFile('A:/system_test_install/os_config.json', JSON.stringify(defaultConfig, null, 2))
        const content = await window.WebOSFileSystem.readFile('A:/system_test_install/os_config.json')
        if (typeof content !== 'object' || content.version !== '1.0.0') { // readFile parses JSON
            throw new Error('os_config.json content mismatch or not parsed as object.')
        }
    })

    register('10. [Install Test] Write A:/system_test_install/os_installed.flag', async () => {
        await window.WebOSFileSystem.writeFile('A:/system_test_install/os_installed.flag', 'true')
        const flagContent = await window.WebOSFileSystem.readFile('A:/system_test_install/os_installed.flag')
        if (flagContent !== 'true') throw new Error('os_installed.flag content mismatch.')
    })

    register('11. [Install Test] Create user directories and Welcome.txt', async () => {
        await window.WebOSFileSystem.createDirectory('A:/Users_test_install/guest/Documents/') // createDirectory handles recursive
        await window.WebOSFileSystem.writeFile('A:/Users_test_install/guest/Documents/Welcome.txt', 'Welcome test!')
        const welcomeContent = await window.WebOSFileSystem.readFile('A:/Users_test_install/guest/Documents/Welcome.txt')
        if (welcomeContent !== 'Welcome test!') throw new Error('Welcome.txt content mismatch.')
    })

    register('12. [Install Test] Cleanup installation test files/dirs', async () => {
        await window.WebOSFileSystem.deleteFile('A:/system_test_install/os_config.json')
        await window.WebOSFileSystem.deleteFile('A:/system_test_install/os_installed.flag')
        await window.WebOSFileSystem.deleteFile('A:/system_test_install/') // Delete directory

        await window.WebOSFileSystem.deleteFile('A:/Users_test_install/guest/Documents/Welcome.txt')
        // Need to delete parent directories in reverse order if deleteFile doesn't recurse for non-empty dirs
        // The current FileSystem.deleteFile for new driver uses rmdir which expects empty.
        // So, for cleanup:
        await window.WebOSFileSystem.deleteFile('A:/Users_test_install/guest/Documents/')
        await window.WebOSFileSystem.deleteFile('A:/Users_test_install/guest/')
        await window.WebOSFileSystem.deleteFile('A:/Users_test_install/')

        const existsSystem = await window.WebOSFileSystem.exists('A:/system_test_install/')
        const existsUsers = await window.WebOSFileSystem.exists('A:/Users_test_install/')
        if (existsSystem || existsUsers) {
            throw new Error('Cleanup failed. Test directories A:/system_test_install/ or A:/Users_test_install/ still exist.')
        }
    })

    // Run all registered tests
    // Ensure this runs after DOM is loaded and other scripts are ready
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', () => run.bind(TestRunner)())
    } else {
        run.bind(TestRunner)()
    }

})()
