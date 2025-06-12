// public/js/tests/storage.test.js

// It's assumed that storage.js (which defines WebOSFileSystem) is loaded before this test file.
// In a real test environment (e.g., Jest), you'd import it.
// For manual browser testing, ensure storage.js is included in the HTML page before this script.

console.log('--- Running storage.test.js ---');

function runTests() {
    let testsPassed = 0;
    let testsFailed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`%cPASS: ${message}`, 'color: green;');
            testsPassed++;
        } else {
            console.error(`%cFAIL: ${message}`, 'color: red;');
            testsFailed++;
        }
    }

    // --- Tests for WebOSFileSystem.getDriveAndPath ---
    console.log('\n--- Testing WebOSFileSystem._getDriveAndPath ---'); // Corrected function name

    // Test case 1: Valid Drive A path
    let result1 = WebOSFileSystem._getDriveAndPath('A:/folder/file.txt'); // Corrected function name
    assert(result1 && result1.drive.getDriveLetter() === 'A:' && result1.path === 'folder/file.txt',
           'Should parse Drive A path correctly.');

    // Test case 2: Valid Drive B path with no sub-path (root)
    let result2 = WebOSFileSystem._getDriveAndPath('B:/'); // Corrected function name
    assert(result2 && result2.drive.getDriveLetter() === 'B:' && result2.path === '',
           'Should parse Drive B root path correctly.');

    // Test case 3: Valid Drive C path with numbers and hyphens - Assuming Drive C might be added later
    // For now, this test will fail if Drive C is not registered in Drives object.
    // We'll adjust the expectation or ensure Drive C is mocked/added for this test.
    // Let's assume for now that any validly formatted drive letter should parse,
    // but _getDriveAndPath will throw if the drive doesn't exist in Drives object.
    let threwError3 = false;
    try {
        WebOSFileSystem._getDriveAndPath('C:/my-folder-123/notes.txt');
    } catch (e) {
        threwError3 = true;
        assert(e.message.includes("Drive C not available"), "Should throw error for unregistered Drive C.");
    }
    if (!threwError3) { // If it didn't throw, that means Drive C was somehow available
        let result3 = WebOSFileSystem._getDriveAndPath('C:/my-folder-123/notes.txt');
        assert(result3 && result3.drive.getDriveLetter() === 'C:' && result3.path === 'my-folder-123/notes.txt',
               'Should parse Drive C path (if Drive C is registered). This might not be a fail if C is not meant to exist yet.');
        if (!result3) testsFailed++; // Ensure failure if not caught by assert but still problematic
    }


    // Test case 4: Lowercase drive letter
    let result4 = WebOSFileSystem._getDriveAndPath('a:/another/file.doc'); // Corrected function name
    assert(result4 && result4.drive.getDriveLetter() === 'A:' && result4.path === 'another/file.doc',
           'Should handle lowercase drive letter.');

    // Test case 5: Invalid drive letter (not in A-Z, or not registered)
    let threwError5 = false;
    try {
         WebOSFileSystem._getDriveAndPath('X:/test.txt'); // Corrected function name
    } catch (e) {
        threwError5 = true;
        assert(e.message.includes("Drive X not available"), "Should throw error for unregistered Drive X.");
    }
     if (!threwError5) assert(false, 'Should have thrown error for unregistered Drive X.');


    // Test case 6: Missing colon (invalid path format)
    let threwError6 = false;
    try {
        WebOSFileSystem._getDriveAndPath('A/test.txt'); // Corrected function name
    } catch (e) {
        threwError6 = true;
        assert(e.message.includes("Invalid path. Must include drive letter"), "Should throw error for path missing colon.");
    }
    if(!threwError6) assert(false, 'Should have thrown error for path missing colon.');


    // Test case 7: Missing slash after colon (still invalid for _getDriveAndPath, though FileSystem constructor might handle it)
    // _getDriveAndPath expects "A:/path" not "A:path"
    let threwError7 = false;
    try {
        WebOSFileSystem._getDriveAndPath('A:test.txt'); // Corrected function name
    } catch (e) {
        threwError7 = true;
        assert(e.message.includes("Invalid path. Must include drive letter"), "Should throw error for path missing slash after colon for _getDriveAndPath.");
    }
     if(!threwError7) assert(false, 'Should have thrown error for path missing slash after colon.');

    // Test case 8: Empty input
    let threwError8 = false;
    try {
        WebOSFileSystem._getDriveAndPath(''); // Corrected function name
    } catch (e) {
        threwError8 = true;
        assert(e.message.includes("Invalid path"), "Should throw error for empty input.");
    }
    if(!threwError8) assert(false, 'Should have thrown error for empty input.');


    // Test case 9: Null input
    let threwError9 = false;
    try {
        WebOSFileSystem._getDriveAndPath(null); // Corrected function name
    } catch (e) {
        threwError9 = true;
        assert(e.message.includes("Invalid path"), "Should throw error for null input.");
    }
    if(!threwError9) assert(false, 'Should have thrown error for null input.');


    // Test case 10: Path with spaces
    let result10 = WebOSFileSystem._getDriveAndPath('A:/my folder/my file.txt'); // Corrected function name
    assert(result10 && result10.drive.getDriveLetter() === 'A:' && result10.path === 'my folder/my file.txt',
           'Should handle paths with spaces.');

    // Test case 11: Path with only drive letter and slash (root)
    let result11 = WebOSFileSystem._getDriveAndPath('A:/');
    assert(result11 && result11.drive.getDriveLetter() === 'A:' && result11.path === '',
           'Should handle root path A:/ correctly.');


    // --- Summary ---
    console.log(`\n--- Test Summary ---`);
    console.log(`Total tests: ${testsPassed + testsFailed}`);
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);

    if (testsFailed === 0) {
        console.log('%cAll tests passed!', 'color: green; font-weight: bold;');
    } else {
        console.error('%cSome tests failed.', 'color: red; font-weight: bold;');
    }

    return testsFailed === 0;
}

// To run these tests manually in a browser:
// 1. Create an HTML file (e.g., test_runner.html)
// 2. Include storage.js: <script src="storage.js"></script>
// 3. Include this test file: <script src="tests/storage.test.js"></script>
// 4. Call runTests() in a script tag or in the console: <script>runTests();</script>
// Example test_runner.html could be:
/*
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Storage Module Tests</title>
</head>
<body>
    <h1>Storage Module Test Runner</h1>
    <p>Open the browser console to see test results.</p>
    <script src="../storage.js"></script>
    <script src="storage.test.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            runTests();
        });
    </script>
</body>
</html>
*/
// For now, this file only defines the tests. They need to be run in an environment where WebOSFileSystem is defined.
// If you want to run this automatically, you'd need a test runner setup.
// We will call runTests() if WebOSFileSystem is available, for immediate feedback if loaded in a test page.
if (window.WebOSFileSystem) {
    // Delay slightly to ensure the main page elements (if any) are logged first.
    setTimeout(runTests, 100);
} else {
    console.warn('WebOSFileSystem not found. Tests for it cannot be run directly without loading storage.js first.');
}
