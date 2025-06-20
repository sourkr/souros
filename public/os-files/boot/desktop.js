// Create the #display div
const displayDiv = document.createElement('div')
displayDiv.id = 'display'

// Append #display to the body
document.body.appendChild(displayDiv)

// Apply display: flex to #display
displayDiv.style.display = 'flex'
displayDiv.style.flexDirection = 'column' // Added for taskbar layout
displayDiv.style.overflow = 'hidden' // Prevent scrollbars from unexpected content

// Create the #desktop div
const desktopDiv = document.createElement('div')
desktopDiv.id = 'desktop'
desktopDiv.style.flexGrow = '1' // Added to make desktop fill space
desktopDiv.style.backgroundColor = '#7f8c8d' // Desktop background color

// Append #desktop to #display
displayDiv.appendChild(desktopDiv)

// Log a message to confirm execution (optional)
console.log('Desktop environment initialized.')

// --- Add Styles for Start Menu and its items ---
const styleElement = document.createElement('style')
styleElement.type = 'text/css'
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
`
document.head.appendChild(styleElement)
// --- End of Styles ---
