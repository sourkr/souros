// A:/apps/app_two_executable.js
console.log("Application Two Executed!");
alert("Application Two is Running!");
if (typeof window.os?.kernel?.exit === 'function') {
    window.os.kernel.exit(0);
}
