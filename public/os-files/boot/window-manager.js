if (!window.os) {
  window.os = {}
}

window.os.win = {
  _windows: {}, // To store window references
  _nextWindowId: 1,
  _activeWindowZIndex: 100, // To manage z-index of active window

  openWindow: function(options = {}) {
    const windowId = this._nextWindowId++
    const desktop = document.getElementById('desktop')

    if (!desktop) {
      console.error('Error: #desktop element not found. Cannot create window.')
      return -1 // Indicate failure
    }

    // --- Main Window Element ---
    const windowElement = document.createElement('div')
    windowElement.id = `os-window-${windowId}`
    windowElement.className = 'os-window' // For potential global styling

    // Basic inline styles for the window
    windowElement.style.position = 'absolute'
    windowElement.style.width = options.width || '400px'
    windowElement.style.height = options.height || '300px'
    windowElement.style.border = '1px solid #ccc'
    windowElement.style.backgroundColor = '#fff'
    windowElement.style.display = 'flex'
    windowElement.style.flexDirection = 'column'
    windowElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)' // Nicer shadow
    windowElement.style.borderRadius = '4px' // Slightly rounded corners
    windowElement.style.overflow = 'hidden' // Ensures content clipping

    // Calculate initial position (simple offset for now, can be improved)
    const existingWindows = Object.keys(this._windows).length
    const baseTop = 50
    const baseLeft = 50
    const offset = existingWindows * 20 // Simple cascade
    windowElement.style.top = `${baseTop + offset}px`
    windowElement.style.left = `${baseLeft + offset}px`

    this._activeWindowZIndex++
    windowElement.style.zIndex = this._activeWindowZIndex


    // --- Title Bar ---
    const titleBar = document.createElement('div')
    titleBar.className = 'os-window-titlebar'

    // Basic inline styles for the title bar
    titleBar.style.backgroundColor = '#eee'
    titleBar.style.padding = '8px 10px'
    titleBar.style.cursor = 'move'
    titleBar.style.display = 'flex'
    titleBar.style.justifyContent = 'space-between'
    titleBar.style.alignItems = 'center'
    titleBar.style.borderBottom = '1px solid #ccc' // Separator

    const titleSpan = document.createElement('span')
    titleSpan.className = 'os-window-title'
    titleSpan.textContent = options.title || 'Untitled Window'
    titleSpan.style.fontWeight = 'bold'
    titleSpan.style.color = '#333'

    const closeButton = document.createElement('button')
    closeButton.className = 'os-window-close-button'
    closeButton.textContent = 'X'
    // Basic styles for close button
    closeButton.style.border = 'none'
    closeButton.style.backgroundColor = '#ff6b6b' // Reddish color
    closeButton.style.color = 'white'
    closeButton.style.padding = '2px 8px'
    closeButton.style.borderRadius = '3px'
    closeButton.style.cursor = 'pointer'
    closeButton.style.fontSize = '12px'

    closeButton.onclick = (e) => {
      e.stopPropagation() // Prevent title bar's mousedown from firing
      this.closeWindow(windowId) // Use 'this' which refers to window.os.win
    }

    titleBar.appendChild(titleSpan)
    titleBar.appendChild(closeButton)

    // --- Content Area ---
    const contentArea = document.createElement('div')
    contentArea.className = 'os-window-content'

    // Basic inline styles for the content area
    contentArea.style.flexGrow = '1'
    contentArea.style.padding = '10px'
    contentArea.style.overflow = 'auto' // Important for scrollable content
    contentArea.innerHTML = options.content || '' // Allow initial HTML content

    // --- Assemble Window ---
    windowElement.appendChild(titleBar)
    windowElement.appendChild(contentArea)

    // --- Store Window Reference ---
    this._windows[windowId] = {
      element: windowElement,
      titleElement: titleSpan,
      contentElement: contentArea,
      originalZIndex: this._activeWindowZIndex
    }

    // --- Append to Desktop ---
    desktop.appendChild(windowElement)

    // --- Bring to Front on Click ---
    windowElement.addEventListener('mousedown', () => {
        this._activeWindowZIndex++
        windowElement.style.zIndex = this._activeWindowZIndex
    })


    // --- Drag Functionality ---
    let isDragging = false
    let offsetX, offsetY

    titleBar.onmousedown = (e) => {
      // Bring window to front when starting drag
      this._activeWindowZIndex++
      windowElement.style.zIndex = this._activeWindowZIndex

      isDragging = true
      offsetX = e.clientX - windowElement.offsetLeft
      offsetY = e.clientY - windowElement.offsetTop

      // Prevent text selection while dragging
      e.preventDefault()

      document.onmousemove = (moveEvent) => {
        if (isDragging) {
          let newX = moveEvent.clientX - offsetX
          let newY = moveEvent.clientY - offsetY

          // Basic boundary checks (optional, can be improved)
          const desktopRect = desktop.getBoundingClientRect()
          newX = Math.max(0, Math.min(newX, desktopRect.width - windowElement.offsetWidth))
          newY = Math.max(0, Math.min(newY, desktopRect.height - windowElement.offsetHeight))


          windowElement.style.left = `${newX}px`
          windowElement.style.top = `${newY}px`
        }
      }

      document.onmouseup = () => {
        isDragging = false
        document.onmousemove = null
        document.onmouseup = null
      }
    }

    console.log(`Window ${windowId} created: ${titleSpan.textContent}`)
    return windowId
  },

  closeWindow: function(id) {
    const win = this._windows[id]
    if (win && win.element) {
      if (win.element.parentNode) {
        win.element.parentNode.removeChild(win.element)
      }
      delete this._windows[id]
      console.log(`Window ${id} closed.`)
      // Optional: Manage z-index focus or decrement _activeWindowZIndex if it makes sense for your logic
      return true
    } else {
      console.warn(`Window ${id} not found or already closed.`)
      return false
    }
  },

  setTitle: function(id, title) {
    const win = this._windows[id]
    if (win && win.titleElement) {
      win.titleElement.textContent = title
      return true
    } else {
      console.warn(`Cannot set title for non-existent window ${id}.`)
      return false
    }
  },

  setContent: function(id, htmlElement) {
    const win = this._windows[id]
    if (win && win.contentElement) {
      if (htmlElement instanceof Node) {
        win.contentElement.innerHTML = '' // Clear existing content
        win.contentElement.appendChild(htmlElement)
        return true
      } else {
        console.error('setContent: Provided content is not a valid HTML Element (Node).')
        // Optionally, handle string HTML content here if desired:
        // win.contentElement.innerHTML = typeof htmlElement === 'string' ? htmlElement : '';
        return false
      }
    } else {
      console.warn(`Cannot set content for non-existent window ${id}.`)
      return false
    }
  },

  getWindow: function(windowId) {
      return this._windows[windowId]
  }
}

console.log('WindowManager initialized (window.os.win)')
