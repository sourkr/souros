// public/js/first_boot_setup.js

class FirstBootSetup {
    constructor() {
        this.overlay = null;
        this.modal = null;
        this.localStorageKey = 'webOS_storageConfig';
    }

    init() {
        // Ensure osBootManager is available
        if (!window.osBootManager) {
            console.error("osBootManager not found. First Boot Setup cannot proceed.");
            // Fallback: Attempt to boot the OS directly if osBootManager is missing,
            // assuming this implies a non-standard boot or recovery scenario.
            // This is a safeguard, ideally osBootManager should always be present.
            if (typeof startKernel === 'function') { // Assuming startKernel is the main boot fn
                console.warn("FirstBootSetup: osBootManager missing, attempting direct boot via startKernel().");
                startKernel();
            }
            return;
        }

        const configString = localStorage.getItem(this.localStorageKey);
        let config = null;
        try {
            config = configString ? JSON.parse(configString) : null;
        } catch (e) {
            console.error("Error parsing existing storage config:", e);
            localStorage.removeItem(this.localStorageKey); // Clear corrupted config
        }

        if (config && config.indexedDBDrive && config.indexedDBDrive.configured === true) {
            console.log("First Boot Setup: Configuration found. Proceeding with boot.");
            this.hide(); // Ensure it's hidden if it was somehow shown
            window.osBootManager.signalSetupCompleteAndProceed();
        } else {
            console.log("First Boot Setup: No valid configuration found. Building UI.");
            this.buildUI();
            this.show();
            // Boot process will be paused as signalSetupCompleteAndProceed is not called yet.
        }
    }

    buildUI() {
        if (document.getElementById('firstBootOverlay')) return; // UI already built

        this.overlay = document.createElement('div');
        this.overlay.id = 'firstBootOverlay';
        this.overlay.style.display = 'none'; // Initially hidden

        this.modal = document.createElement('div');
        this.modal.id = 'firstBootModal';

        this.modal.innerHTML = `
            <h2>Welcome to WebOS - Storage Setup</h2>
            <p>Configure your primary data drive. This drive will be powered by IndexedDB in your browser.</p>

            <label for="driveLetterSelect">Drive Letter:</label>
            <select id="driveLetterSelect">
                <option value="B:">B:</option>
                <option value="D:" selected>D:</option>
                <option value="E:">E:</option>
                <option value="F:">F:</option>
            </select>

            <label for="driveSizeInput">Drive Size (MB):</label>
            <input type="number" id="driveSizeInput" min="64" value="256">

            <div>
                <input type="checkbox" id="mountDriveCheckbox" checked>
                <label for="mountDriveCheckbox">Mount this drive on startup</label>
            </div>

            <button id="confirmSetupBtn">Save and Continue</button>
        `;

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        document.getElementById('confirmSetupBtn').addEventListener('click', () => this.saveConfig());
    }

    show() {
        if (this.overlay) {
            this.overlay.style.display = 'flex';
        }
    }

    hide() {
        if (this.overlay && this.overlay.parentElement) {
             // document.body.removeChild(this.overlay); // Consider removing if not needed again
             this.overlay.style.display = 'none'; // Or just hide
        }
    }

    saveConfig() {
        const driveLetterSelect = document.getElementById('driveLetterSelect');
        const driveSizeInput = document.getElementById('driveSizeInput');
        const mountDriveCheckbox = document.getElementById('mountDriveCheckbox');

        if (!driveLetterSelect || !driveSizeInput || !mountDriveCheckbox) {
            console.error("FirstBootSetup: Could not find all form elements to save config.");
            return;
        }

        let sizeMB = parseInt(driveSizeInput.value);
        if (isNaN(sizeMB) || sizeMB < 64) {
            alert("Drive size must be at least 64 MB.");
            driveSizeInput.focus();
            return;
        }


        const config = {
            indexedDBDrive: {
                driveLetter: driveLetterSelect.value.charAt(0), // "D" from "D:"
                customLetter: driveLetterSelect.value.charAt(0), // In case we differentiate later
                sizeMB: sizeMB,
                mounted: mountDriveCheckbox.checked,
                configured: true // Mark as configured
            }
            // Potentially add other drive types here in future e.g. browserStorageDrive
        };

        try {
            localStorage.setItem(this.localStorageKey, JSON.stringify(config));
            console.log("First Boot Setup: Configuration saved.", config);
            this.hide();

            if (window.osBootManager) {
                window.osBootManager.signalSetupCompleteAndProceed();
            } else {
                // This case should ideally not be reached if init() checks for osBootManager
                console.error("osBootManager not found after saving config. OS boot might not proceed automatically.");
                alert("Configuration saved. Please reload the page to continue booting WebOS.");
            }

        } catch (e) {
            console.error("Error saving config to localStorage:", e);
            alert("There was an error saving your configuration. Please try again.\nIf the problem persists, ensure your browser allows localStorage and has space.");
        }
    }
}
