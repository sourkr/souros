const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Define paths for static assets
const publicPath = path.join(__dirname, '..', 'public');
const installPath = path.join(__dirname, '..', 'install');

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


app.listen(PORT, () => {
    console.log(`Web Desktop server running on http://localhost:${PORT}`);
    console.log(`Installation page: http://localhost:${PORT}/install/`);
    console.log(`Main application: http://localhost:${PORT}/`);
});
