document.addEventListener('DOMContentLoaded', () => {
    const installButton = document.getElementById('installButton');
    const installMessage = document.getElementById('installMessage');

    if (!installButton) {
        console.error('Install button not found.');
        if(installMessage) installMessage.textContent = 'Error: Install button missing from page.';
        return;
    }
    if (!window.WebOSFileSystem) {
        console.error('WebOSFileSystem API not found. storage.js might be missing or failed to load.');
        if(installMessage) installMessage.textContent = 'Error: FileSystem API not available. Cannot proceed.';
        installButton.disabled = true;
        return;
    }

    installButton.addEventListener('click', async () => {
        installButton.disabled = true;
        installMessage.textContent = 'Installing Sour OS... please wait.';

        try {
            // Create A:/SourOS directory
            installMessage.textContent = 'Creating A:/SourOS directory...';
            await window.WebOSFileSystem.createDirectory('A:/SourOS');
            console.log('Created directory A:/SourOS');

            // Fetch and store localstorage-driver.js
            installMessage.textContent = 'Fetching OS components...';
            const response = await fetch('/os-files/localstorage-driver.js'); // Path relative to web root
            if (!response.ok) {
                throw new Error(`Failed to fetch /os-files/localstorage-driver.js: ${response.status} ${response.statusText}`);
            }
            const driverContent = await response.text();
            console.log('Fetched /os-files/localstorage-driver.js');

            installMessage.textContent = 'Storing OS components...';
            await window.WebOSFileSystem.writeFile('A:/SourOS/localstorage-driver.js', driverContent);
            console.log('Stored localstorage-driver.js in A:/SourOS');

            installMessage.textContent = 'Proceeding with system file creation...'; // Update message for next steps

            // 1. Create A:/system directory (and A:/ if it doesn't exist conceptually)
            // Our FileSystem API creates parent paths implicitly if simple, or use createDirectory.
            await window.WebOSFileSystem.createDirectory('A:/system');
            console.log('Created directory A:/system');

            // 2. Write os_config.json
            const defaultConfig = {
                version: '1.0.0',
                installedAt: new Date().toISOString(),
                defaultUser: 'guest',
                settings: {
                    theme: 'light',
                    resolution: '1024x768' // Example setting
                }
            };
            await window.WebOSFileSystem.writeFile('A:/system/os_config.json', JSON.stringify(defaultConfig, null, 2));
            console.log('Created A:/system/os_config.json');

            // 3. Write os_installed.flag
            await window.WebOSFileSystem.writeFile('A:/system/os_installed.flag', 'true');
            console.log('Created A:/system/os_installed.flag');

            // 4. (Optional) Create some default user directories
            await window.WebOSFileSystem.createDirectory('A:/Users');
            await window.WebOSFileSystem.createDirectory('A:/Users/guest');
            await window.WebOSFileSystem.createDirectory('A:/Users/guest/Documents');
            await window.WebOSFileSystem.createDirectory('A:/Users/guest/Pictures');
            await window.WebOSFileSystem.writeFile('A:/Users/guest/Documents/Welcome.txt', 'Welcome to your new Sour OS installation!');
            console.log('Created default user directories and welcome file.');

            installMessage.textContent = 'Installation successful! Redirecting to the desktop...';
            console.log('Installation successful.');

            // Clear any old flags from previous non-WebOSFileSystem installations if they exist
            localStorage.removeItem('webOsInstalled');


            setTimeout(() => {
                window.location.href = '/'; // Redirect to the main page
            }, 2000);

        } catch (error) {
            console.error('Installation failed:', error);
            installMessage.textContent = `Installation failed: ${error.message || error}. Please check console for details.`;
            installButton.disabled = false; // Re-enable button on failure
        }
    });
});
