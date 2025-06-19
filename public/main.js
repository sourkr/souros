// public/main.js
console.log("WebOS Bootloader: Starting...");

window.osBootManager = {
    isSetupComplete: false, // Will be set to true if setup is done or not needed

    startKernelActual: function() {
        console.log("osBootManager: Actual kernel start initiated (evaluating /kernal.js).");
        // The original core kernel boot logic:
        const kernelCode = localStorage.getItem('/kernal.js');
        if (kernelCode) {
            try {
                eval(kernelCode);
            } catch (e) {
                console.error("Error evaluating /kernal.js:", e);
                document.body.innerHTML = '<div style="color: red; text-align: center; padding-top: 50px;"><h1>Kernel Panic!</h1><p>Error evaluating /kernal.js. See console for details.</p></div>';
            }
        } else {
            console.error("/kernal.js not found in localStorage. Cannot boot OS.");
            document.body.innerHTML = '<div style="color: red; text-align: center; padding-top: 50px;"><h1>Kernel Panic!</h1><p>/kernal.js not found in localStorage.</p></div>';
        }
    },

    signalSetupCompleteAndProceed: function() {
        console.log("osBootManager: Setup complete signal received.");
        this.isSetupComplete = true; // Mark setup as done
        this.startKernelActual();    // Proceed to boot the kernel
    }
};

// Initialize First Boot Setup UI - this must be done BEFORE trying to start the kernel
if (typeof FirstBootSetup === 'function') {
    const firstBootSetup = new FirstBootSetup();
    // init() will check localStorage.
    // If config exists, it calls signalSetupCompleteAndProceed (which then calls startKernelActual).
    // If config doesn't exist, it shows UI. User interaction via saveConfig() eventually calls signalSetupCompleteAndProceed.
    firstBootSetup.init();
} else {
    console.error("FirstBootSetup class not found! This might lead to boot issues if setup is required.");
    // Fallback: if FirstBootSetup is somehow missing, assume setup is not critical or handled differently.
    // This directly tries to boot the kernel.
    window.osBootManager.isSetupComplete = true; // Mark as complete to allow startKernelActual to run
    window.osBootManager.startKernelActual();
}
