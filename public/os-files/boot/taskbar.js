// Get the #display div (assuming it's created by desktop.js)
const displayDiv = document.getElementById('display')

// --- Function to Load Application Data ---
async function loadApplications() {
  const infoPath = 'A:/apps/info/'
  let applications = []

    // Ensure window.os and window.os.fs are available
    if (!window.os || !window.os.fs) {
      console.error('File system API (window.os.fs) not available.')
      return applications
    }

    let dirFd
    try {
      console.log(`Attempting to open directory: ${infoPath}`)
      dirFd = await window.os.fs.open(infoPath, 'read')
      console.log(`Directory opened, fd: ${dirFd}`)
      const entries = await window.os.fs.readdir(dirFd)
      console.log(`Directory entries: ${entries.join(', ')}`)

      for (const fileName of entries) {
        if (fileName.endsWith('.json')) {
          const fullPathToJsonFile = infoPath + fileName
          let fileFd
          try {
            console.log(`Attempting to open file: ${fullPathToJsonFile}`)
            fileFd = await window.os.fs.open(fullPathToJsonFile, 'read')
            console.log(`File opened: ${fullPathToJsonFile}, fd: ${fileFd}`)
            const content = await window.os.fs.read(fileFd) // Assuming read returns string content
            console.log(`File content for ${fileName}: ${content.substring(0, 100)}...`) // Log snippet

            try {
              const appInfo = JSON.parse(content)
              applications.push(appInfo)
              console.log(`Successfully parsed and added: ${appInfo.name}`)
            } catch (parseError) {
              console.error(`Invalid JSON in app info file: ${fileName}`, parseError)
            }
          } catch (fileError) {
            console.error(`Error reading or opening file: ${fullPathToJsonFile}`, fileError)
          } finally {
            if (fileFd !== undefined) {
              try {
                await window.os.fs.close(fileFd)
                console.log(`Closed file: ${fullPathToJsonFile}`)
              } catch (closeError) {
                console.error(`Error closing file ${fullPathToJsonFile}:`, closeError)
              }
            }
          }
        }
      }
    } catch (dirError) {
      console.error(`Error reading directory: ${infoPath}`, dirError)
    } finally {
      if (dirFd !== undefined) {
        try {
          await window.os.fs.close(dirFd)
          console.log(`Closed directory: ${infoPath}`)
        } catch (closeError) {
          console.error(`Error closing directory ${infoPath}:`, closeError)
        }
      }
    }
    console.log('Finished loading applications. Total found:', applications.length)
    return applications
  }
  // --- End of Function to Load Application Data ---

async function updateStartMenu(startButton) {
  // Create the Start Menu
  const startMenu = document.createElement('div')
  startMenu.id = 'startMenu'

  // Style the Start Menu (initially hidden)
  startMenu.style.display = 'none'
  startMenu.style.position = 'fixed'
  startMenu.style.bottom = '40px' // Taskbar height
  startMenu.style.left = '0px'
  startMenu.style.width = '250px'
  startMenu.style.height = '300px'
  startMenu.style.backgroundColor = '#ecf0f1'
  startMenu.style.border = '1px solid #bdc3c7'
  startMenu.style.borderBottom = 'none'
  startMenu.style.boxShadow = '0 -2px 5px rgba(0,0,0,0.1)'
  startMenu.style.zIndex = '999' // Below taskbar, above other content
  startMenu.style.padding = '10px'
  startMenu.style.boxSizing = 'border-box'

  // Create Applications section
  const appsSection = document.createElement('div')
  appsSection.className = 'start-menu-section' // For potential future styling
  const appsHeader = document.createElement('h4')
  appsHeader.textContent = 'Applications'
  appsHeader.style.marginTop = '0' // Basic styling for header
  appsHeader.style.marginBottom = '5px'
  appsSection.appendChild(appsHeader)

  // Dynamically load and populate applications
  const applications = await loadApplications()
  if (applications && applications.length > 0) {
    applications.forEach(appInfo => {
      const appItem = document.createElement('div')
      appItem.className = 'start-menu-item'
      appItem.textContent = appInfo.name
      appItem.dataset.executable = appInfo.executable // Store executable path

      if (appInfo.icon) {
        const iconImg = document.createElement('img')
        // Assuming paths like "A:/apps/icons/icon.png" map to "/fs/A/apps/icons/icon.png"
        iconImg.src = appInfo.icon.replace(/^A:\//, '/fs/A/')
        iconImg.style.width = '16px'
        iconImg.style.height = '16px'
        iconImg.style.marginRight = '8px'
        iconImg.onerror = () => { // Hide icon on error
          iconImg.style.display = 'none'
          console.warn(`Icon not found or error loading: ${iconImg.src}`)
        }
        appItem.prepend(iconImg)
      }

      // Add onclick handler for app execution
      appItem.onclick = async () => {
        const execPath = appItem.dataset.executable
        if (execPath) {
          if (window.os?.kernel?.exec && typeof window.os.kernel.exec === 'function') {
            try {
              console.log('Executing app:', execPath)
              await window.os.kernel.exec(execPath) // Assuming exec might be async
            } catch (e) {
              console.error('Error during app execution:', execPath, e)
              alert('Error: Could not launch ' + appItem.textContent + '. See console for details.')
            }
          } else {
            console.error('Failed to execute app: os.kernel.exec not available for', appItem.textContent)
            alert('Error: Could not launch ' + appItem.textContent + '. OS components missing.')
          }
        } else {
          console.error('No executable path found for', appItem.textContent)
          alert('Error: No executable path for ' + appItem.textContent)
        }
        startMenu.style.display = 'none' // Hide menu after attempting to launch
      }
      appsSection.appendChild(appItem)
    })
  } else {
    const noAppsMsg = document.createElement('p')
    noAppsMsg.textContent = 'No applications found.'
    noAppsMsg.style.padding = '8px 12px'
    noAppsMsg.style.fontSize = '0.9rem' // Matches .start-menu-item approx
    noAppsMsg.style.color = '#6c757d' // Muted text color
    appsSection.appendChild(noAppsMsg)
  }

  startMenu.appendChild(appsSection)

  // Create System section
  const systemSection = document.createElement('div')
  systemSection.className = 'start-menu-section' // For potential future styling
  const systemHeader = document.createElement('h4')
  systemHeader.textContent = 'System'
  systemHeader.style.marginTop = '10px' // Basic styling for header
  systemHeader.style.marginBottom = '5px'
  systemSection.appendChild(systemHeader)

  // Add items to System section
  const settingsItem = document.createElement('div')
  settingsItem.className = 'start-menu-item'
  settingsItem.textContent = 'Settings'
  settingsItem.onclick = () => { alert('Settings clicked!'); startMenu.style.display = 'none' }
  systemSection.appendChild(settingsItem)

  const powerItem = document.createElement('div')
  powerItem.className = 'start-menu-item'
  powerItem.textContent = 'Shut Down'
  powerItem.onclick = () => { alert('Shut Down clicked!'); startMenu.style.display = 'none' }
  systemSection.appendChild(powerItem)

  startMenu.appendChild(systemSection)

  // Append Start Menu to the body
  document.body.appendChild(startMenu)

  // --- Start Menu Toggle Functionality ---

  // Toggle on Start Button Click
  startButton.addEventListener('click', (event) => {
    event.stopPropagation() // Prevent this click from immediately closing the menu via the document listener
    const isHidden = startMenu.style.display === 'none' || startMenu.style.display === ''
    startMenu.style.display = isHidden ? 'block' : 'none'
  })

  // Close on Click Outside
  document.addEventListener('click', (event) => {
    if (startMenu.style.display === 'block') {
      const isClickInsideMenu = startMenu.contains(event.target)
      const isClickOnStartButton = startButton.contains(event.target)
      if (!isClickInsideMenu && !isClickOnStartButton) {
        startMenu.style.display = 'none'
      }
    }
  })

  // Close on Escape Key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && startMenu.style.display === 'block') {
      startMenu.style.display = 'none'
    }
  })
  // --- End of Start Menu Toggle Functionality ---
  console.log('Start Menu created/updated and toggle functionality added.')
}

// Main execution logic for taskbar
async function initializeTaskbar() {
  if (displayDiv) {
    // Create the #taskbar div
    const taskbarDiv = document.createElement('div')
    taskbarDiv.id = 'taskbar'

    // Append #taskbar to #display
    displayDiv.appendChild(taskbarDiv)

    // Style the #taskbar
    taskbarDiv.style.position = 'fixed' // Or rely on flex parent
    taskbarDiv.style.bottom = '0'
    taskbarDiv.style.left = '0'
    taskbarDiv.style.width = '100%'
    taskbarDiv.style.height = '40px'
    taskbarDiv.style.backgroundColor = '#2c3e50'
    taskbarDiv.style.display = 'flex'
    taskbarDiv.style.alignItems = 'center'
    taskbarDiv.style.padding = '0 10px'
    taskbarDiv.style.boxSizing = 'border-box'
    taskbarDiv.style.zIndex = '1000'

    // Create the Start Button
    const startButton = document.createElement('button')
    startButton.id = 'startButton'
    startButton.textContent = 'Start'

    // Style the Start Button
    startButton.style.height = '30px'
    startButton.style.padding = '0 15px'
    startButton.style.border = 'none'
    const startButtonNormalColor = '#3498db'
    const startButtonHoverColor = '#2980b9'
    startButton.style.backgroundColor = startButtonNormalColor
    startButton.style.color = 'white'
    startButton.style.fontSize = '14px'
    startButton.style.cursor = 'pointer'
    startButton.style.borderRadius = '4px'
    startButton.style.marginRight = '10px' // For spacing if other items are added

    // Add hover effects for Start Button
    startButton.onmouseover = () => {
      startButton.style.backgroundColor = startButtonHoverColor
    }
    startButton.onmouseout = () => {
      startButton.style.backgroundColor = startButtonNormalColor
    }

    // Append Start Button to Taskbar
    taskbarDiv.appendChild(startButton)

    // Setup Start Menu
    await updateStartMenu(startButton)

    // Log a message to confirm execution (optional)
    console.log('Taskbar and Start Button created.')
  } else {
    console.error('#display element not found. Taskbar initialization failed.')
  }
}

initializeTaskbar().catch(error => {
  console.error("Error initializing taskbar:", error)
})
// })(); // Removed IIFE
