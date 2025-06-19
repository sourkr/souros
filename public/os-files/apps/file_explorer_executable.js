// This script is executed by os.kernel.exec()
if (window.apps && window.apps.launchFileExplorer) {
  window.apps.launchFileExplorer();
} else {
  console.error("File Explorer app (launchFileExplorer) not found.");
  alert("Error: Could not start File Explorer. App not fully loaded.");
}
