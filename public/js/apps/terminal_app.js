// Original initializeTerminal function, adapted for module context
function _initializeTerminalInternal(appWindow, appContainer) {
    // Ensure appContainer has the necessary elements. If not, create them.
    let outputElement = appContainer.querySelector('.terminal-output');
    if (!outputElement) {
        outputElement = document.createElement('div');
        outputElement.className = 'terminal-output';
        outputElement.style.height = 'calc(100% - 30px)';
        outputElement.style.overflowY = 'auto';
        outputElement.style.fontFamily = 'monospace';
        outputElement.style.whiteSpace = 'pre-wrap';
        outputElement.style.padding = '5px';
        appContainer.appendChild(outputElement);
    }

    let inputLineElement = appContainer.querySelector('.terminal-input-line');
    if (!inputLineElement) {
        inputLineElement = document.createElement('div');
        inputLineElement.className = 'terminal-input-line';
        inputLineElement.style.display = 'flex';
        inputLineElement.style.height = '30px';
        inputLineElement.style.backgroundColor = '#333';
        inputLineElement.style.color = 'white';
        inputLineElement.style.padding = '5px';

        const promptElement = document.createElement('span');
        promptElement.className = 'terminal-prompt';
        promptElement.textContent = 'A:/> '; // Default prompt

        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.className = 'terminal-input';
        inputElement.style.flexGrow = '1';
        inputElement.style.background = 'transparent';
        inputElement.style.border = 'none';
        inputElement.style.color = 'white';
        inputElement.style.fontFamily = 'monospace';
        inputElement.style.outline = 'none';

        inputLineElement.appendChild(promptElement);
        inputLineElement.appendChild(inputElement);
        appContainer.appendChild(inputLineElement);
    }

    // Now that elements are ensured, query them again for safety
    outputElement = appContainer.querySelector('.terminal-output');
    const inputElement = appContainer.querySelector('.terminal-input');
    const promptElement = appContainer.querySelector('.terminal-prompt');


    appWindow.dataset.terminalCwd = "A:/"; // Default CWD
    appWindow.dataset.terminalHistory = JSON.stringify([]);
    appWindow.dataset.terminalHistoryIndex = "-1";

    const appendOutput = (text, type = 'info') => {
        const line = document.createElement('div');
        if (type === 'command') {
            line.textContent = `${promptElement.textContent}${text}`; // Use current prompt
            line.style.color = "#80ccff";
        } else if (type === 'error') {
            line.textContent = `Error: ${text}`;
            line.style.color = "#ff8080";
        } else if (type === 'system') {
             line.textContent = `SYSTEM: ${text}`;
             line.style.color = "#a0a0a0";
        } else {
            line.textContent = text;
            line.style.color = 'white'; // Default text color
        }
        outputElement.appendChild(line);
        outputElement.scrollTop = outputElement.scrollHeight;
    };

    const updatePrompt = () => {
        promptElement.textContent = `${appWindow.dataset.terminalCwd}> `;
    };

    updatePrompt(); // Set initial prompt

    const resolvePath = (path) => {
        if (!path || path.trim() === '') return appWindow.dataset.terminalCwd;

        // Handle absolute paths (e.g., "B:/folder" or "a:/")
        if (path.match(/^[a-zA-Z]:\//i)) {
            let drive = path.substring(0,2).toUpperCase();
            let rest = path.substring(2);
            if (!rest.startsWith('/')) rest = '/' + rest; // ensure leading slash
            if (!rest.endsWith('/')) rest += '/'; // ensure trailing slash
            return drive + rest;
        }
         if (path.match(/^[a-zA-Z]:$/i)) { // just "A:"
            return path.toUpperCase() + "/";
        }


        let currentCwd = appWindow.dataset.terminalCwd;
        if (!currentCwd.endsWith('/')) currentCwd += '/';

        if (path === '.') return currentCwd;
        if (path === '..') {
            if (currentCwd.length === 3) return currentCwd; // Already at root of drive e.g. "A:/"
            return currentCwd.substring(0, currentCwd.slice(0, -1).lastIndexOf('/') + 1);
        }
        return currentCwd + path + (path.endsWith('/') ? '' : '/');
    };


    const executeCommand = async (fullCommand) => {
        appendOutput(fullCommand, 'command');
        const [command, ...args] = fullCommand.trim().split(/\s+/);

        const history = JSON.parse(appWindow.dataset.terminalHistory);
        if (fullCommand.trim() !== "" && (history.length === 0 || history[history.length -1] !== fullCommand.trim())) {
             history.push(fullCommand.trim());
        }
        appWindow.dataset.terminalHistory = JSON.stringify(history);
        appWindow.dataset.terminalHistoryIndex = history.length; // Points to one after last

        if (!command) { // Empty command
            updatePrompt();
            inputElement.value = '';
            inputElement.focus();
            return;
        }

        switch (command.toLowerCase()) {
            case 'help':
                appendOutput("Available commands:\n" +
                    "  help                       - Shows this help message\n" +
                    "  ls [path]                  - Lists directory contents\n" +
                    "  cat <filePath>             - Displays file content\n" +
                    "  echo [text ...]            - Displays text\n" +
                    "  clear                      - Clears the terminal output\n" +
                    "  cd <path>                  - Changes current directory\n" +
                    "  mkdir <dirname>            - Creates a new directory\n" +
                    "  touch <filename>           - Creates an empty file (if it doesn't exist)\n" +
                    "  rm <path>                  - Removes a file or empty directory");
                break;
            case 'ls':
                try {
                    const targetPath = args.length > 0 ? resolvePath(args.join(' ')) : appWindow.dataset.terminalCwd;
                    const items = await window.WebOSFileSystem.listDirectory(targetPath);
                    if (items.length === 0) {
                        appendOutput("Directory is empty.");
                    } else {
                        items.forEach(item => appendOutput(`${item.type === 'directory' ? '[D]' : '[F]'} ${item.name}`));
                    }
                } catch (e) {
                    appendOutput(e.message, 'error');
                }
                break;
            case 'cat':
                if (args.length === 0) {
                    appendOutput("Usage: cat <filePath>", 'error');
                    break;
                }
                try {
                    // Resolve path and remove trailing slash if user accidentally adds one for a file
                    const filePath = resolvePath(args.join(' ')).replace(/\/$/, '');
                    const content = await window.WebOSFileSystem.readFile(filePath);
                    if (content === null || content === undefined) {
                         appendOutput("File not found or is empty.", 'error');
                    } else if (typeof content === 'object') { // For JSON files or similar
                       appendOutput(JSON.stringify(content, null, 2));
                    } else {
                       appendOutput(content);
                    }
                } catch (e) {
                    appendOutput(e.message, 'error');
                }
                break;
            case 'echo':
                appendOutput(args.join(' '));
                break;
            case 'clear':
                outputElement.innerHTML = '';
                break;
            case 'cd':
                if (args.length === 0) {
                    appendOutput("Usage: cd <path>", 'error');
                    break;
                }
                try {
                    const newPathArg = args.join(' ');
                    let newPotentialPath = resolvePath(newPathArg);
                    if (!newPotentialPath.endsWith('/')) newPotentialPath += '/';

                    // Attempt to list directory to check if it's valid
                    await window.WebOSFileSystem.listDirectory(newPotentialPath);
                    appWindow.dataset.terminalCwd = newPotentialPath;
                } catch (e) {
                    // If listDirectory fails, it's either not a directory or doesn't exist
                    appendOutput(`cd: ${args.join(' ')}: No such directory or not a directory`, 'error');
                }
                break;
            case 'mkdir':
                if (args.length === 0) {
                    appendOutput("Usage: mkdir <dirname>", 'error');
                    break;
                }
                try {
                    const dirName = args.join(' ');
                    const newDirPath = resolvePath(dirName);
                    await window.WebOSFileSystem.createDirectory(newDirPath);
                    appendOutput(`Directory created: ${newDirPath}`);
                } catch (e) {
                    appendOutput(e.message, 'error');
                }
                break;
            case 'touch':
                 if (args.length === 0) {
                    appendOutput("Usage: touch <filename>", 'error');
                    break;
                }
                try {
                    const fileName = args.join(' ');
                    const newFilePath = resolvePath(fileName).replace(/\/$/, ''); // Ensure no trailing slash for files
                    // Check if file exists, if not, create with empty content
                    if (!await window.WebOSFileSystem.exists(newFilePath)) {
                        await window.WebOSFileSystem.writeFile(newFilePath, "");
                        appendOutput(`File created: ${newFilePath}`);
                    } else {
                        // "touch" on existing file usually updates timestamp, here we just acknowledge it exists
                        appendOutput(`File already exists: ${newFilePath}`);
                    }
                } catch (e) {
                    appendOutput(e.message, 'error');
                }
                break;
            case 'rm':
                if (args.length === 0) {
                    appendOutput("Usage: rm <path>", 'error');
                    break;
                }
                try {
                    const pathArg = args.join(' ');
                    const targetPath = resolvePath(pathArg);

                    // Determine if it's a file or directory for the appropriate delete method
                    // This is a simplification; a real 'rm' would need to know if it's a file or dir
                    // We'll try deleting as file, then as directory if that fails (or use a 'stat' if available)
                    if (targetPath.endsWith('/')) { // Assume it's a directory
                        await window.WebOSFileSystem.deleteDirectory(targetPath);
                        appendOutput(`Directory removed: ${targetPath}`);
                    } else { // Assume it's a file
                        await window.WebOSFileSystem.deleteFile(targetPath);
                        appendOutput(`File removed: ${targetPath}`);
                    }
                } catch (e) {
                     appendOutput(e.message, 'error');
                }
                break;
            default:
                if (command.trim() !== '') {
                    appendOutput(`Unknown command: ${command}`, 'error');
                }
        }
        updatePrompt();
        if(inputElement) {
            inputElement.value = '';
            inputElement.focus();
        }
    };

    if(inputElement) {
        inputElement.addEventListener('keydown', (e) => {
            const history = JSON.parse(appWindow.dataset.terminalHistory);
            let historyIndex = parseInt(appWindow.dataset.terminalHistoryIndex, 10);

            if (e.key === 'Enter') {
                e.preventDefault();
                executeCommand(inputElement.value);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (history.length > 0) {
                    if (historyIndex <= 0) historyIndex = history.length; // wrap to end if at beginning
                    historyIndex--;
                    inputElement.value = history[historyIndex];
                    appWindow.dataset.terminalHistoryIndex = historyIndex;
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (history.length > 0) {
                    if (historyIndex >= history.length -1 ) historyIndex = -1; // wrap to start if at end
                    historyIndex++;
                    inputElement.value = history[historyIndex];
                    appWindow.dataset.terminalHistoryIndex = historyIndex;
                }
            }
        });
        inputElement.focus();
    }

    appendOutput("Sour OS Terminal [Version 1.0.0]", "system");
    appendOutput("Type 'help' for a list of commands.", "system");
}


export function initTerminalApp(appContainer, appWindow) {
    // appContainer is the content div of the window.
    // appWindow is the main window element (for dataset attributes like CWD, history)

    // Define basic HTML Structure for the terminal
    const terminalHtml = `
        <div class="terminal-output" style="height: calc(100% - 30px); overflow-y: auto; font-family: monospace; white-space: pre-wrap; padding: 5px; background-color: #222; color: white;"></div>
        <div class="terminal-input-line" style="display: flex; height: 30px; background-color: #333; color: white; padding: 5px; align-items: center;">
            <span class="terminal-prompt" style="font-family: monospace; margin-right: 5px;"></span>
            <input type="text" class="terminal-input" style="flex-grow: 1; background: transparent; border: none; color: white; font-family: monospace; outline: none;">
        </div>
    `;
    appContainer.innerHTML = terminalHtml;

    // Call the internal initializer function, passing the appWindow and the appContainer
    _initializeTerminalInternal(appWindow, appContainer);
}
