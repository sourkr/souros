# WebOS Tests

This directory contains test files for the WebOS JavaScript modules.

## Running Tests

Currently, a simple HTML test runner is provided: `test_runner.html`.

To run the tests:
1. Make sure your WebOS application is being served (e.g., via `npm start` or your local server setup that serves the `public` directory).
2. Navigate to `/js/tests/test_runner.html` in your browser (e.g., `http://localhost:8080/js/tests/test_runner.html` if your server runs on port 8080 and serves the `public` directory as root).
3. Open the browser's developer console to see detailed test output. A summary will also be displayed on the HTML page itself.

## Included Tests

*   `storage.test.js`: Contains tests for the `WebOSFileSystem` module, primarily focusing on the internal utility function `_getDriveAndPath` which is crucial for parsing full paths into drive and relative path components.

## Test Structure (`storage.test.js`)

The `storage.test.js` file defines a `runTests` function that:
*   Uses a simple `assert` helper to check conditions and log pass/fail messages.
*   Tests various scenarios for `WebOSFileSystem._getDriveAndPath`, including:
    *   Valid paths on different drives (A:, B:).
    *   Paths with special characters (hyphens, numbers, spaces).
    *   Lowercase drive letters.
    *   Invalid or unregistered drive letters (expects errors).
    *   Malformed paths (missing colon, missing slash after colon).
    *   Empty or null inputs (expects errors).
*   Outputs a summary of passed and failed tests to the console.

The script automatically attempts to run `runTests()` if `window.WebOSFileSystem` is detected, allowing it to execute when `storage.js` has been loaded.

## Test Runner (`test_runner.html`)

The `test_runner.html` file:
*   Includes `storage.js` followed by `storage.test.js`.
*   Contains a basic UI to display test logs and a summary.
*   Includes an inline script that hijacks `console.log`, `console.error`, and `console.warn` to redirect their output to the HTML page, allowing for visible feedback directly in the browser window without solely relying on the developer console.

## Future Improvements

*   **Integrate a formal JavaScript testing framework**: Utilize a framework like Jest, Mocha, or Jasmine for more structured tests, assertions, mocking capabilities, and test organization.
*   **Comprehensive Unit Tests for Storage Wrappers**:
    *   Mock browser APIs (`localStorage`, `IndexedDB`) to allow for isolated unit testing of `localStorageWrapper.js` and `indexedDBWrapper.js`.
    *   Test all CRUD operations (Create, Read, Write, Delete, List) for each storage adapter and the main `FileSystem` class.
    *   Test edge cases: empty content, large content (if applicable limits), special characters in paths/filenames, overwriting files, deleting non-existent files, etc.
*   **Test `FileSystem` path normalization**: Add specific tests for the `_normalizePath` and `_getParentPath` methods in the `FileSystem` class.
*   **Asynchronous Operations**: Ensure tests correctly handle asynchronous operations (e.g., using `async/await` with promises returned by file system methods).
*   **Setup and Teardown**: Implement proper setup (e.g., initializing a drive with specific files/directories) and teardown (e.g., clearing a drive) for tests to ensure they run in a consistent environment.
*   **End-to-End Tests**: Consider using a tool like Cypress or Puppeteer for testing user interactions and flows through the WebOS UI, including file explorer operations, app launching, etc.
*   **CI Integration**: Set up Continuous Integration (CI) to automatically run tests on each commit/pull request.
