// Wait for the DOM to be fully loaded before trying to access #display
document.addEventListener('DOMContentLoaded', () => {
  // Get the #display div (assuming it's created by desktop.js)
  const displayDiv = document.getElementById('display');

  if (displayDiv) {
    // --- Add Styles for Start Menu and its items ---
    const styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.innerHTML = `
      #startMenu {
        /* Base styles are already applied inline, but can be refined here */
        background-color: #f8f9fa !important; /* A lighter, cleaner background */
        border: 1px solid #dee2e6 !important; /* Softer border color */
        border-top-left-radius: 0 !important; /* Keep sharp edge with taskbar */
        border-top-right-radius: 4px !important; /* Slightly rounded top-right corner */
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08) !important; /* Softer, more modern shadow */
        color: #212529 !important; /* Darker text for better readability */
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important; /* Modern system font stack */
      }

      .start-menu-section h4 {
        margin-top: 0 !important; /* Overriding inline style */
        margin-bottom: 8px !important; /* Overriding inline style */
        font-size: 0.9rem !important;
        font-weight: 600 !important;
        color: #495057 !important; /* Slightly muted header color */
        border-bottom: 1px solid #e9ecef !important; /* Separator for section headers */
        padding-bottom: 4px !important;
      }

      .start-menu-item {
        display: block !important;
        padding: 8px 12px !important;
        text-decoration: none !important;
        color: #343a40 !important;
        border-radius: 4px !important;
        font-size: 0.95rem !important;
      }

      .start-menu-item:hover {
        background-color: #e9ecef !important; /* Hover effect for items */
        color: #007bff !important; /* Highlight color on hover */
      }

      /* Optional: Style for a power/user section if added later */
      .start-menu-footer {
        margin-top: 10px !important;
        padding-top: 10px !important;
        border-top: 1px solid #e9ecef !important; /* Separator for footer */
        display: flex !important;
        justify-content: space-around !important;
      }

      .start-menu-footer .button-like-item { /* If using divs/spans styled as buttons */
        padding: 6px 10px !important;
        cursor: pointer !important;
        border-radius: 4px !important;
      }
      .start-menu-footer .button-like-item:hover {
        background-color: #d6d8db !important;
      }
    `;
    document.head.appendChild(styleElement);
    // --- End of Styles ---

    // Create the #taskbar div
    const taskbarDiv = document.createElement('div');
    taskbarDiv.id = 'taskbar';

    // Append #taskbar to #display
    displayDiv.appendChild(taskbarDiv);

    // Style the #taskbar
    taskbarDiv.style.position = 'fixed'; // Or rely on flex parent
    taskbarDiv.style.bottom = '0';
    taskbarDiv.style.left = '0';
    taskbarDiv.style.width = '100%';
    taskbarDiv.style.height = '40px';
    taskbarDiv.style.backgroundColor = '#2c3e50';
    taskbarDiv.style.display = 'flex';
    taskbarDiv.style.alignItems = 'center';
    taskbarDiv.style.padding = '0 10px';
    taskbarDiv.style.boxSizing = 'border-box';
    taskbarDiv.style.zIndex = '1000';

    // Create the Start Button
    const startButton = document.createElement('button');
    startButton.id = 'startButton';
    startButton.textContent = 'Start';

    // Style the Start Button
    startButton.style.height = '30px';
    startButton.style.padding = '0 15px';
    startButton.style.border = 'none';
    const startButtonNormalColor = '#3498db';
    const startButtonHoverColor = '#2980b9';
    startButton.style.backgroundColor = startButtonNormalColor;
    startButton.style.color = 'white';
    startButton.style.fontSize = '14px';
    startButton.style.cursor = 'pointer';
    startButton.style.borderRadius = '4px';
    startButton.style.marginRight = '10px'; // For spacing if other items are added

    // Add hover effects for Start Button
    startButton.onmouseover = () => {
      startButton.style.backgroundColor = startButtonHoverColor;
    };
    startButton.onmouseout = () => {
      startButton.style.backgroundColor = startButtonNormalColor;
    };

    // Append Start Button to Taskbar
    taskbarDiv.appendChild(startButton);

    // Create the Start Menu
    const startMenu = document.createElement('div');
    startMenu.id = 'startMenu';

    // Style the Start Menu (initially hidden)
    startMenu.style.display = 'none';
    startMenu.style.position = 'fixed';
    startMenu.style.bottom = '40px'; // Taskbar height
    startMenu.style.left = '0px';
    startMenu.style.width = '250px';
    startMenu.style.height = '300px';
    startMenu.style.backgroundColor = '#ecf0f1';
    startMenu.style.border = '1px solid #bdc3c7';
    startMenu.style.borderBottom = 'none';
    startMenu.style.boxShadow = '0 -2px 5px rgba(0,0,0,0.1)';
    startMenu.style.zIndex = '999'; // Below taskbar, above other content
    startMenu.style.padding = '10px';
    startMenu.style.boxSizing = 'border-box';

    // Create Applications section
    const appsSection = document.createElement('div');
    appsSection.className = 'start-menu-section'; // For potential future styling
    const appsHeader = document.createElement('h4');
    appsHeader.textContent = 'Applications';
    appsHeader.style.marginTop = '0'; // Basic styling for header
    appsHeader.style.marginBottom = '5px';
    appsSection.appendChild(appsHeader);

    // Add items to Apps section
    const appItem1 = document.createElement('div');
    appItem1.className = 'start-menu-item';
    appItem1.textContent = 'Application 1';
    appItem1.onclick = () => { alert('App 1 clicked!'); startMenu.style.display = 'none'; };
    appsSection.appendChild(appItem1);

    const appItem2 = document.createElement('div');
    appItem2.className = 'start-menu-item';
    appItem2.textContent = 'Text Editor';
    appItem2.onclick = () => { alert('Text Editor clicked!'); startMenu.style.display = 'none'; };
    appsSection.appendChild(appItem2);

    startMenu.appendChild(appsSection);

    // Create System section
    const systemSection = document.createElement('div');
    systemSection.className = 'start-menu-section'; // For potential future styling
    const systemHeader = document.createElement('h4');
    systemHeader.textContent = 'System';
    systemHeader.style.marginTop = '10px'; // Basic styling for header
    systemHeader.style.marginBottom = '5px';
    systemSection.appendChild(systemHeader);

    // Add items to System section
    const settingsItem = document.createElement('div');
    settingsItem.className = 'start-menu-item';
    settingsItem.textContent = 'Settings';
    settingsItem.onclick = () => { alert('Settings clicked!'); startMenu.style.display = 'none'; };
    systemSection.appendChild(settingsItem);

    const powerItem = document.createElement('div');
    powerItem.className = 'start-menu-item';
    powerItem.textContent = 'Shut Down';
    powerItem.onclick = () => { alert('Shut Down clicked!'); startMenu.style.display = 'none'; };
    systemSection.appendChild(powerItem);

    startMenu.appendChild(systemSection);

    // Append Start Menu to the body
    document.body.appendChild(startMenu);

    // --- Start Menu Toggle Functionality ---

    // Toggle on Start Button Click
    startButton.addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent this click from immediately closing the menu via the document listener
      const isHidden = startMenu.style.display === 'none' || startMenu.style.display === '';
      startMenu.style.display = isHidden ? 'block' : 'none';
    });

    // Close on Click Outside
    document.addEventListener('click', (event) => {
      if (startMenu.style.display === 'block') {
        const isClickInsideMenu = startMenu.contains(event.target);
        const isClickOnStartButton = startButton.contains(event.target);
        if (!isClickInsideMenu && !isClickOnStartButton) {
          startMenu.style.display = 'none';
        }
      }
    });

    // Close on Escape Key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && startMenu.style.display === 'block') {
        startMenu.style.display = 'none';
      }
    });
    // --- End of Start Menu Toggle Functionality ---

    // Log a message to confirm execution (optional)
    console.log('Taskbar, Start Button, Start Menu created, and toggle functionality added.');
  } else {
    console.error('#display element not found. Taskbar initialization failed.');
  }
});
