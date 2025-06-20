const AsyncFunction = (async function(){}).constructor

(new AsyncFunction(localStorage.getItem('/kernal.js')))()