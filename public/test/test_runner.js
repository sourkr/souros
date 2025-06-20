// public/test/test_runner.js
const TestRunner = {
    resultsElement: null,
    tests: [],
    register: function(name, fn) {
        this.tests.push({ name, fn })
    },
    run: async function() {
        this.resultsElement = document.getElementById('test-results')
        if (!this.resultsElement) {
            console.error("Test results element not found!")
            return
        }
        this.resultsElement.innerHTML = '' // Clear previous results

        for (const test of this.tests) {
            const li = document.createElement('li')
            li.textContent = `${test.name}: `
            try {
                await test.fn()
                li.textContent += 'PASS'
                li.className = 'pass'
            } catch (e) {
                li.textContent += `FAIL - ${e.message || String(e)}`
                li.className = 'fail'
                console.error(`Test failed: ${test.name}`, e)
            }
            this.resultsElement.appendChild(li)
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // Automatically run tests when the page loads
    // This might run before all async operations in driver.test.js are set up
    // It's better to call TestRunner.run() at the end of driver.test.js or after a delay.
    // For now, let's keep it simple and assume tests can be run on DOMContentLoaded.
    TestRunner.run() // Will be called from driver.test.js
})
