// A:/apps/app_two_executable.js
console.log("Application Two Executed!");
alert("Application Two is Running!");
if (window.os && window.os.kernal && typeof window.os.kernal.exit === 'function') {
    window.os.kernal.exit(0);
}
