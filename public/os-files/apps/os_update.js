export function initOsUpdateApp(appContainer) {
    const htmlContent = `
        <div style="padding: 15px; font-family: sans-serif; color: #333;">
            <h2>OS Update</h2>
            <p>Current OS Version: <span id="osUpdateCurrentVersion">1.0.0</span> (from A:/system/os_config.json)</p>
            <p>Available Version: <span id="osUpdateAvailableVersion">-</span></p>
            <button id="osCheckForUpdatesBtn" style="padding: 8px 12px; margin-right: 10px;">Check for Updates</button>
            <button id="osApplyUpdateBtn" style="padding: 8px 12px;" disabled>Apply Update</button>
            <p id="osUpdateStatus" style="margin-top: 10px;"></p>
        </div>
    `;

    appContainer.innerHTML = htmlContent;

    // Script for OS Update App functionality
    // The IIFE needs to be adapted to use appContainer
    (function(container) {
        const currentVersionElem = container.querySelector('#osUpdateCurrentVersion');
        const availableVersionElem = container.querySelector('#osUpdateAvailableVersion');
        const checkForUpdatesBtn = container.querySelector('#osCheckForUpdatesBtn');
        const applyUpdateBtn = container.querySelector('#osApplyUpdateBtn');
        const statusElem = container.querySelector('#osUpdateStatus');

        let latestServerVersionInfo = null; // To store fetched update info

        async function fetchCurrentOSVersion() {
            if (window.WebOSFileSystem) {
                try {
                    const configStr = await window.WebOSFileSystem.readFile('A:/system/os_config.json');
                    if (configStr) {
                        const config = JSON.parse(configStr);
                        currentVersionElem.textContent = config.version || '1.0.0';
                        return config.version || '1.0.0';
                    }
                } catch (e) {
                    console.error('Error reading OS config for version:', e);
                    currentVersionElem.textContent = 'Error';
                }
            }
            return '1.0.0'; // Default if not found
        }

        fetchCurrentOSVersion(); // Load on app open

        checkForUpdatesBtn.addEventListener('click', async () => {
            statusElem.textContent = 'Checking for updates...';
            applyUpdateBtn.disabled = true;
            latestServerVersionInfo = null;
            const currentVersion = await fetchCurrentOSVersion();

            try {
                const response = await fetch('/api/os_update_info.json');
                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }
                const data = await response.json();
                latestServerVersionInfo = data; // Store fetched info

                availableVersionElem.textContent = data.latestVersion;
                if (data.latestVersion > currentVersion) {
                    statusElem.textContent = 'Update available: ' + data.latestVersion + ' - ' + data.description;
                    applyUpdateBtn.disabled = false;
                } else {
                    statusElem.textContent = 'Your OS is up to date.';
                }
            } catch (error) {
                console.error('Error fetching update info:', error);
                statusElem.textContent = 'Error checking for updates. Please try again.';
                availableVersionElem.textContent = '-';
            }
        });

        applyUpdateBtn.addEventListener('click', async () => {
            if (!latestServerVersionInfo) {
                statusElem.textContent = 'No update information available. Please check for updates first.';
                return;
            }

            statusElem.textContent = \`Applying update to \${latestServerVersionInfo.latestVersion}...\`;
            applyUpdateBtn.disabled = true;

            // Mock apply
            setTimeout(async () => {
                if (window.WebOSFileSystem) {
                    const newConfig = {
                        version: latestServerVersionInfo.latestVersion,
                        installedDate: new Date().toISOString(),
                        lastUpdateCheck: new Date().toISOString()
                    };
                    try {
                        await window.WebOSFileSystem.writeFile('A:/system/os_config.json', JSON.stringify(newConfig));
                        currentVersionElem.textContent = newConfig.version;
                        availableVersionElem.textContent = '-';
                        latestServerVersionInfo = null;
                        statusElem.textContent = 'OS updated successfully to ' + newConfig.version + '! Restart might be required (not simulated).';
                    } catch (e) {
                        console.error('Error writing updated OS config:', e);
                        statusElem.textContent = 'Update failed (Error writing config).';
                        applyUpdateBtn.disabled = false;
                    }
                } else {
                    statusElem.textContent = 'Update failed (FileSystem not available).';
                    applyUpdateBtn.disabled = false;
                }
            }, 1500);
        });
    })(appContainer); // Pass the container to the IIFE
}
