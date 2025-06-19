const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

const publicPath = path.join(__dirname, '..', 'public');
const installPath = path.join(__dirname, '..', 'install');
const osFilesRoot = path.join(publicPath, 'os-files'); // This points to public/os-files/

// Middleware to serve static files
// Serve install directory at /install
app.use('/install', express.static(installPath));

// Serve public directory at /
// This should come after /install to ensure /install/index.html is served correctly
// and not overridden by a potential index.html in public for the root path.
app.use('/', express.static(publicPath));

// Fallback for / to serve public/index.html explicitly if no other route matches
// This ensures that if someone navigates to just '/', they get the main app page.
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Fallback for /install/ to serve install/index.html explicitly
app.get('/install/', (req, res) => {
    res.sendFile(path.join(installPath, 'index.html'));
});

app.get('/api/os-files-content*', async (req, res) => {
    // Extract the requested path from the URL.
    // We remove the '/api/os-files-content' prefix to get the relative path.
    const requestedPath = req.path.substring('/api/os-files-content'.length) || '/';

    const targetPath = path.join(osFilesRoot, path.normalize(requestedPath));

    // CRITICAL SECURITY CHECK: Ensure the resolved targetPath remains within the intended osFilesRoot.
    // This prevents requests like '/api/os-files-content/../../../etc/passwd'
    if (!targetPath.startsWith(osFilesRoot)) {
        return res.status(400).json({ error: 'Invalid path: Access denied.' });
    }

    try {
        // Get stats to determine if the path is a file or a directory
        const stats = await fs.stat(targetPath);

        if (stats.isDirectory()) {
            // If it's a directory, list its contents
            const entries = await fs.readdir(targetPath);
            const result = [];

            for (const entry of entries) {
                const entryPath = path.join(targetPath, entry);
                try {
                    const entryStats = await fs.stat(entryPath);
                    result.push({
                        name: entry,
                        type: entryStats.isDirectory() ? 'dir' : 'file'
                    });
                } catch (innerError) {
                    console.warn(`Could not get stats for "${entryPath}", skipping. Error: ${innerError.message}`);
                }
            }
            res.json(result);

        } else if (stats.isFile()) {
            // If it's a file, send its contents directly
            res.sendFile(targetPath);

        } else {
            // Handle other file system types (like symlinks) if necessary,
            // or return an error for unsupported types.
            res.status(400).json({ error: 'Path points to an unsupported resource type.' });
        }

    } catch (error) {
        // Handle specific file system errors
        if (error.code === 'ENOENT') {
            // "Entry Not Found" - the requested file or directory does not exist
            return res.status(404).json({ error: `File or directory not found: "${requestedPath}"` });
        } else if (error.code === 'EACCES') {
            // "Permission Denied" - server does not have read access
            return res.status(403).json({ error: `Permission denied to access: "${requestedPath}"` });
        } else {
            // Catch any other unexpected errors
            console.error(`Error processing request for "${requestedPath}":`, error);
            res.status(500).json({ error: 'Server error processing the request.' });
        }
    }
});

// New endpoint to send the content of public/api/latest_os_version.txt
app.get('/api/os-version', async (req, res) => {
    const versionFilePath = path.join(publicPath, 'api', 'latest_os_version.txt');

    try {
        const content = await fs.readFile(versionFilePath, 'utf-8');
        res.type('text/plain').send(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Version file not found.' });
        } else {
            console.error('Error reading OS version file:', error);
            res.status(500).json({ error: 'Failed to read OS version file.' });
        }
    }
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Web Desktop server running on http://localhost:${PORT}`);
    console.log(`Installation page: http://localhost:${PORT}/install/`);
    console.log(`Main application: http://localhost:${PORT}/`);
    console.log(`OS Version endpoint: http://localhost:${PORT}/api/os-version`);
});
