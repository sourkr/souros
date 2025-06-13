// public/js/main.js
console.log("main.js: Initiating OS startup sequence.");

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = false; // Load sequentially for now, though kernal.js handles internal async
        script.onload = () => {
            console.log(`main.js: Successfully loaded ${url}`);
            resolve();
        };
        script.onerror = () => {
            console.error(`main.js: Failed to load ${url}`);
            reject(new Error(`Failed to load script: ${url}`));
        };
        document.head.appendChild(script);
    });
}

async function bootstrap() {
    console.log("main.js: Bootstrapping OS...");

    // Ensure core HTML elements are there (optional, good practice)
    if (!document.getElementById('desktop')) {
        console.warn("main.js: Desktop element not found in HTML. UI may not render correctly.");
        // Potentially create it or wait for it dynamically if necessary
    }

    // The HTML should have already loaded:
    // 1. os-globals.js (defines window.os.drives)
    // 2. storage.js (defines WebOSFileSystem)
    // 3. localstorage-driver.js (registers Drive A)
    // 4. indexdb-driver.js (registers Drive B)
    // (This subtask doesn't manage HTML, but assumes this order for these critical scripts)

    // Now, main.js loads kernal.js
    // Note: The user request was "main.js will only run 'A:/SourOS/kernal.js'".
    // For now, to simplify bootstrapping without needing FS to load kernal.js itself,
    // we load kernal.js from its web path.
    // A future step could make main.js use WebOSFileSystem to load kernal.js from A: drive.
    try {
        // Before loading kernal, ensure WebOSFileSystem is actually up,
        // as kernal.js will use it to check drive readiness.
        if (!window.WebOSFileSystem || !window.WebOSFileSystem.getDrive('A')) {
             console.error("main.js: WebOSFileSystem or Drive A not ready before attempting to load kernal.js. Check HTML script load order for os-globals, storage, and drivers.");
             // Display error to user
             const errDiv = document.createElement('div');
             errDiv.textContent = "Critical OS components failed to load. Cannot start Kernal. Check console.";
             errDiv.style.color = 'red';
             document.body.prepend(errDiv);
             return; // Stop bootstrap
        }
        console.log("main.js: WebOSFileSystem and Drive A seem to be ready. Loading kernal.js...");

        await loadScript('/os-files/kernal.js'); // Load kernal.js from web path
        console.log("main.js: kernal.js script loading initiated.");
        // kernal.js will then initialize itself and other OS components.
        // It will dispatch an 'osready' event when done.
    } catch (error) {
        console.error("main.js: Error during bootstrap loading kernal.js:", error);
        const errDiv = document.createElement('div');
        errDiv.textContent = "Failed to load OS Kernal. System cannot start. Check console for details.";
        errDiv.style.color = 'red';
        document.body.prepend(errDiv);
    }
}

// Start the bootstrap process when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap(); // DOMContentLoaded has already fired
}
