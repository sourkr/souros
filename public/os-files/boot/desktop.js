// Create the #display div
const displayDiv = document.createElement('div');
displayDiv.id = 'display';

// Append #display to the body
document.body.appendChild(displayDiv);

// Apply display: flex to #display
displayDiv.style.display = 'flex';
displayDiv.style.flexDirection = 'column'; // Added for taskbar layout
displayDiv.style.overflow = 'hidden'; // Prevent scrollbars from unexpected content

// Create the #desktop div
const desktopDiv = document.createElement('div');
desktopDiv.id = 'desktop';
desktopDiv.style.flexGrow = '1'; // Added to make desktop fill space
desktopDiv.style.backgroundColor = '#7f8c8d'; // Desktop background color

// Append #desktop to #display
displayDiv.appendChild(desktopDiv);

// Log a message to confirm execution (optional)
console.log('Desktop environment initialized.');
