// Wait for the DOM to be fully loaded before trying to access #display
document.addEventListener('DOMContentLoaded', () => {
  // Get the #display div (assuming it's created by desktop.js)
  const displayDiv = document.getElementById('display');

  if (displayDiv) {
    // Create the #taskbar div
    const taskbarDiv = document.createElement('div');
    taskbarDiv.id = 'taskbar';

    // Append #taskbar to #display
    displayDiv.appendChild(taskbarDiv);

    // Log a message to confirm execution (optional)
    console.log('Taskbar initialized and appended to #display.');
  } else {
    console.error('#display element not found. Taskbar initialization failed.');
  }
});
