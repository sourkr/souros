// A:/apps/app_one_executable.js
console.log("Application One Executed!");
alert("Application One says Hello!");
if (typeof window.os?.kernel?.exit === 'function') {
    window.os.kernel.exit(0); // Example of exiting a process
}
