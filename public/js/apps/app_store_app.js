export function initAppStoreApp(appContainer) {
    const htmlContent = `
        <div style="padding: 15px; font-family: sans-serif; color: #333; height: 100%; display: flex; flex-direction: column;">
            <h2>App Store</h2>
            <div id="appStoreAvailableApps" style="flex-grow: 1; overflow-y: auto; border: 1px solid #eee; padding: 10px; margin-bottom: 10px;">
                <p>Loading apps...</p>
            </div>
            <div id="appStoreStatus" style="margin-top: 10px; min-height: 20px;"></div>
        </div>
    `;

    appContainer.innerHTML = htmlContent;

    // Script for App Store App functionality
    (function(container) {
        const availableAppsContainer = container.querySelector('#appStoreAvailableApps');
        const statusElem = container.querySelector('#appStoreStatus');
        let installedApps = {};
        let catalogApps = []; // To store apps from API

        async function loadInstalledAppsManifest() {
            if (window.WebOSFileSystem) {
                try {
                    // Ensure B drive and base directory exist or can be handled gracefully
                    if (!window.WebOSFileSystem.getDrive('B')) {
                        console.warn('Drive B (IndexedDB) not available for App Store manifest.');
                        // Optionally, disable app store functionality or show a message
                        statusElem.textContent = 'App storage (Drive B) not available.';
                        return; // Stop further execution if drive B is critical
                    }
                    // Attempt to create directory, may fail if already exists, which is fine
                    try {
                        await window.WebOSFileSystem.createDirectory('B:/apps');
                    } catch (dirError) {
                        // Ignore error if directory already exists, log others
                        if (!dirError.message.toLowerCase().includes('already exists')) {
                            console.warn('Could not create B:/apps directory, may affect manifest saving:', dirError);
                        }
                    }

                    const manifestStr = await window.WebOSFileSystem.readFile('B:/apps/installed_manifest.json');
                    if (manifestStr) {
                        installedApps = JSON.parse(manifestStr);
                    }
                } catch (e) {
                    console.log('No app manifest found or error reading it (B:/apps/installed_manifest.json). Assuming no apps installed via store yet.', e);
                    installedApps = {};
                    if (window.WebOSFileSystem.getDrive('B')) {
                       try {
                           // Attempt to create an empty manifest if none found
                           await window.WebOSFileSystem.writeFile('B:/apps/installed_manifest.json', JSON.stringify({}));
                       } catch (initError) {
                           console.error("Failed to initialize app manifest on Drive B:", initError);
                           statusElem.textContent = 'Error initializing app manifest.';
                       }
                    }
                }
            } else {
                statusElem.textContent = 'File system not available for app manifest.';
            }
        }

        async function saveInstalledAppsManifest() {
            if (window.WebOSFileSystem && window.WebOSFileSystem.getDrive('B')) {
                try {
                    await window.WebOSFileSystem.writeFile('B:/apps/installed_manifest.json', JSON.stringify(installedApps));
                } catch (saveError) {
                    console.error("Failed to save app manifest on Drive B:", saveError);
                    statusElem.textContent = 'Error saving app installation status.';
                }
            } else {
                 statusElem.textContent = 'File system or Drive B not available for saving manifest.';
            }
        }

        function renderApps() {
            if (!availableAppsContainer) return; // Guard against missing container
            availableAppsContainer.innerHTML = '';
            if (catalogApps.length === 0) {
                availableAppsContainer.innerHTML = '<p>No apps available at the moment. Check status below.</p>';
                return;
            }
            catalogApps.forEach(app => {
                const appEntry = document.createElement('div');
                appEntry.style.borderBottom = '1px solid #eee';
                appEntry.style.paddingBottom = '10px';
                appEntry.style.marginBottom = '10px';

                let appIconHtml = app.icon ? '<img src="' + app.icon + '" alt="' + app.name + '" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 10px;">' : '';

                appEntry.innerHTML =
                    appIconHtml +
                    '<strong>' + app.name + '</strong> (v' + app.version + ') <em style="font-size:0.8em; color: #555;">by ' + (app.developer || 'Unknown Dev') + '</em>' +
                    '<p style="font-size: 0.9em; margin: 5px 0;">' + app.description + '</p>' +
                    '<p style="font-size: 0.8em; color: #777;">Permissions: ' + (app.permissions && app.permissions.length > 0 ? app.permissions.join(', ') : 'none') + '</p>';

                const installButton = document.createElement('button');
                installButton.style.padding = '5px 10px';

                if (app.isSystemApp === true) {
                    installButton.textContent = 'System App';
                    installButton.disabled = true;
                } else if (installedApps[app.id]) {
                    if (installedApps[app.id] < app.version) {
                        installButton.textContent = 'Update to v' + app.version;
                        installButton.onclick = () => handleInstallOrUpdate(app, true);
                    } else {
                        installButton.textContent = 'Installed (v' + installedApps[app.id] + ')';
                        installButton.disabled = true;
                    }
                } else {
                    installButton.textContent = 'Install';
                    installButton.onclick = () => handleInstallOrUpdate(app, false);
                }

                appEntry.appendChild(installButton);
                availableAppsContainer.appendChild(appEntry);
            });
        }

        async function handleInstallOrUpdate(app, isUpdate) {
            if (!window.WebOSFileSystem || !window.WebOSFileSystem.getDrive('B')) {
                statusElem.textContent = 'Drive B (for app installations) is not available.';
                console.error('Drive B not available for app installation/update.');
                return;
            }
            statusElem.textContent = (isUpdate ? 'Updating' : 'Installing') + ' ' + app.name + '...';
            // Simulate installation delay
            setTimeout(async () => {
                installedApps[app.id] = app.version;
                await saveInstalledAppsManifest();
                statusElem.textContent = app.name + (isUpdate ? ' updated' : ' installed') + ' successfully to v' + app.version + '! (Restart WebOS or App Store to see changes in main app list - not simulated).';
                renderApps(); // Re-render to update button states
                // This console warning is good for developers
                console.warn("App '" + app.name + "' processed. Manual refresh or advanced inter-app communication needed to see it live in desktop for now.");
            }, 1500);
        }

        (async () => { // Main IIFE for the app
            await loadInstalledAppsManifest();
            try {
                const response = await fetch('/api/app_store_catalog.json');
                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }
                catalogApps = await response.json();
            } catch (error) {
                console.error('Error fetching app catalog:', error);
                if (statusElem) statusElem.textContent = 'Could not load app catalog: ' + error.message;
                catalogApps = [];
            }
            renderApps();
        })();
    })(appContainer); // Pass the container to the IIFE
}
