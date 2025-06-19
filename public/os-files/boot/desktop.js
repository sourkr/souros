// Create the #display div
const displayDiv = document.createElement('div');
displayDiv.id = 'display';

// Append #display to the body
document.body.appendChild(displayDiv);

// Apply display: flex to #display
displayDiv.style.display = 'flex';

// Create the #desktop div
const desktopDiv = document.createElement('div');
desktopDiv.id = 'desktop';

// Append #desktop to #display
displayDiv.appendChild(desktopDiv);

// Log a message to confirm execution (optional)
console.log('Desktop environment initialized.');
