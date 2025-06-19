// A:/apps/app_one_executable.js
console.log("Application One Executed!");
alert("Application One says Hello!");
if (window.os && window.os.kernal && typeof window.os.kernal.exit === 'function') {
    window.os.kernal.exit(0); // Example of exiting a process
}
