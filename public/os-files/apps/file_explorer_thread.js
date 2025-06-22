const { Window, Element } = require("A:/apps/libs/gui.js");

// const mainContainer = new Element("div");

function main() {
    const window = new Window();
    // window.title = "File Explorer";

    // const root = new FlexBox('column')
    // window.content = root

    // const addressContainer = new FlexBox()
    // root.append(addressBarContainer)
    // addressContainer.gap = '5px'

    // const upBtn = new Element('button')
    // upBtn.text = 'up'
    // addressBarContainer.append(upBtn)

    // const addressBar = new Element('div')
    // addressBar.css('flex', '1')
    // addressBarContainer.append(addressBar)

    // mainContainer.css('flex', '1')
}

function update(path) {
    if (!path) {
        const driveNames = syscall("fs.drives", true);
    }
}

// --- Style Element ---
// const styleElement = document.createElement("style");
// styleElement.textContent = `
// .file-explorer-address-bar {
// 		display: flex;
// 		align-items: center;
// 		padding: 5px;
// 		background-color: #fff;
// 		border-bottom: 1px solid #ccc;
// }
// .file-explorer-address-bar button {
// 		margin-right: 5px;
// 		padding: 3px 8px;
// 		border: 1px solid #ccc;
// 		background-color: #e0e0e0;
// 		cursor: pointer;
// }
// .file-explorer-address-bar button:hover {
// 		background-color: #d0d0d0;
// }
// .file-explorer-address-bar input[type='text'] {
// 		flex-grow: 1;
// 		padding: 4px;
// 		border: 1px solid #ccc;
// }
// .file-explorer-content {
// 		flex-grow: 1;
// 		padding: 10px;
// 		overflow-y: auto;
// 		background-color: #fff;
// }
// .file-explorer-item {
// 		display: flex;
// 		align-items: center;
// 		padding: 6px;
// 		cursor: default;
// 		border-radius: 4px;
// }
// .file-explorer-item:hover {
// 		background-color: #e6f3ff;
// }
// .file-explorer-item.folder {
// 		cursor: pointer;
// }
// .file-explorer-item-icon {
// 		margin-right: 8px;
// 		width: 20px;
// 		text-align: center;
// }
// .file-explorer-item-name {
// 		/* flex-grow: 1; */
// }
// `;
// appContainer.appendChild(styleElement);

// const upButton = document.createElement("button");
// upButton.textContent = "↑";

// const pathInput = document.createElement("input");
// pathInput.type = "text";
// pathInput.value = "A:/";
// pathInput.readOnly = true;

// const drivesButton = document.createElement("button");
// drivesButton.textContent = "Drives";
// drivesButton.title = "Show all drives";

// addressBarContainer.appendChild(upButton);
// addressBarContainer.appendChild(drivesButton);
// addressBarContainer.appendChild(pathInput);

// // --- Main Content Area (File/Folder Listing) ---
// const mainContentArea = document.createElement("div");
// mainContentArea.className = "file-explorer-content";
// mainContentArea.innerHTML = "";

// // --- Assemble App UI ---
// appContainer.appendChild(addressBarContainer);
// appContainer.appendChild(mainContentArea);

// // Set the assembled UI as the window's content
// os.win.setContent(windowId, appContainer);

// // --- Navigation Logic ---
// async function showDrives() {
// 	pathInput.value = "Drives";
// 	mainContentArea.innerHTML = "<p><em>Loading drives...</em></p>";

// 	try {
// 		if (!os || !os.drives) {
// 			mainContentArea.innerHTML =
// 				'<p style="color: red;">Error: Drives API not available.</p>';
// 			return;
// 		}

// 		mainContentArea.innerHTML = "";

// 		if (os.drives.size === 0) {
// 			mainContentArea.innerHTML = "<p><em>No drives available.</em></p>";
// 			return;
// 		}

// 		os.drives.forEach(async (driveInfo, driveName) => {
// 			const itemDiv = document.createElement("div");
// 			itemDiv.className = "file-explorer-item folder";

// 			const iconSpan = document.createElement("span");
// 			iconSpan.className = "file-explorer-item-icon";
// 			iconSpan.innerHTML = "&#128190;"; // Disk drive icon

// 			const nameSpan = document.createElement("span");
// 			nameSpan.className = "file-explorer-item-name";

// 			const driveSize = await driveInfo.size();
// 			const sizeText = formatBytes(driveSize);
// 			nameSpan.textContent = `${driveName} (${sizeText})`;

// 			itemDiv.ondblclick = () => {
// 				navigateTo(driveName + "/");
// 			};

// 			itemDiv.appendChild(iconSpan);
// 			itemDiv.appendChild(nameSpan);
// 			mainContentArea.appendChild(itemDiv);
// 		});
// 	} catch (error) {
// 		mainContentArea.innerHTML = `<p style="color: red;">Error loading drives: ${error.message}</p>`;
// 		console.error("showDrives: Error loading drives", error);
// 	}
// }

// function formatBytes(bytes) {
// 	if (bytes === 0) return "0 Bytes";

// 	const k = 1024;
// 	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
// 	const i = Math.floor(Math.log(bytes) / Math.log(k));

// 	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
// }

// async function navigateTo(path) {
// 	if (!os || !os.fs) {
// 		mainContentArea.innerHTML =
// 			'<p style="color: red;">Error: File system API not available.</p>';
// 		pathInput.value = path;
// 		return;
// 	}

// 	pathInput.value = path;
// 	mainContentArea.innerHTML = "<p><em>Loading...</em></p>";

// 	let dirFd = -1;
// 	try {
// 		// Open directory for reading
// 		dirFd = await os.fs.open(path, "read");

// 		if (typeof dirFd !== "number" || dirFd < 0) {
// 			mainContentArea.innerHTML = `<p style="color: red;">Error: Could not open directory '${path}'. Invalid file descriptor: ${dirFd}</p>`;
// 			console.error(
// 				`navigateTo: Invalid file descriptor ${dirFd} for path ${path}`,
// 			);
// 			return;
// 		}

// 		let entries;
// 		try {
// 			entries = await os.fs.readdir(dirFd);
// 		} catch (readdirError) {
// 			mainContentArea.innerHTML = `<p style="color: red;">Error reading directory '${path}': ${readdirError.message}</p>`;
// 			console.error(
// 				`navigateTo: Error reading directory ${path}`,
// 				readdirError,
// 			);
// 			await os.fs.close(dirFd);
// 			return;
// 		}

// 		// Close the directory handle
// 		await os.fs.close(dirFd);
// 		dirFd = -1;

// 		mainContentArea.innerHTML = "";

// 		if (entries.length === 0) {
// 			mainContentArea.innerHTML = "<p><em>Directory is empty.</em></p>";
// 		} else {
// 			entries.forEach((entryName) => {
// 				const itemDiv = document.createElement("div");
// 				itemDiv.className = "file-explorer-item";

// 				const iconSpan = document.createElement("span");
// 				iconSpan.className = "file-explorer-item-icon";

// 				const nameSpan = document.createElement("span");
// 				nameSpan.className = "file-explorer-item-name";
// 				nameSpan.textContent = entryName;

// 				// Simple heuristic for folder/file distinction
// 				const isLikelyFolder =
// 					!entryName.includes(".") ||
// 					entryName.endsWith(".") ||
// 					entryName === "..";
// 				iconSpan.innerHTML = isLikelyFolder ? "&#128193;" : "&#128196;";

// 				if (isLikelyFolder) {
// 					itemDiv.classList.add("folder");
// 					itemDiv.ondblclick = () => {
// 						let currentPath = path;
// 						if (!currentPath.endsWith("/")) {
// 							currentPath += "/";
// 						}

// 						let newPath;
// 						if (entryName === "..") {
// 							// Handle going up one directory
// 							let parts = currentPath
// 								.substring(0, currentPath.length - 1)
// 								.split("/");
// 							parts.pop();

// 							if (parts.length === 1 && parts[0].endsWith(":")) {
// 								newPath = parts[0] + "/";
// 							} else if (parts.length > 1) {
// 								newPath = parts.join("/") + "/";
// 							} else {
// 								newPath = "A:/";
// 							}
// 						} else {
// 							// Navigate into subdirectory
// 							newPath = (currentPath + entryName).replace(/\/\//g, "/");
// 							if (!newPath.endsWith("/")) {
// 								newPath += "/";
// 							}
// 						}

// 						navigateTo(newPath);
// 					};
// 				}

// 				itemDiv.appendChild(iconSpan);
// 				itemDiv.appendChild(nameSpan);
// 				mainContentArea.appendChild(itemDiv);
// 			});
// 		}
// 	} catch (error) {
// 		mainContentArea.innerHTML = `<p style="color: red;">Error reading directory '${path}': ${error.message}</p>`;
// 		console.error(`navigateTo: Error for path ${path}`, error);

// 		if (typeof dirFd === "number" && dirFd >= 0) {
// 			try {
// 				await os.fs.close(dirFd);
// 				console.log(
// 					`navigateTo: Successfully closed directory handle ${dirFd} in error handler.`,
// 				);
// 			} catch (closeError) {
// 				console.error(
// 					`navigateTo: Error closing directory handle ${dirFd} in error handler:`,
// 					closeError,
// 				);
// 			}
// 		}
// 	}
// }

// upButton.onclick = () => {
// 	let currentPath = pathInput.value;

// 	// If we're viewing drives, stay on drives view
// 	if (currentPath === "Drives") {
// 		return;
// 	}

// 	// Ensure it ends with a slash for consistent processing
// 	if (!currentPath.endsWith("/") && currentPath.length > 2) {
// 		currentPath += "/";
// 	} else if (currentPath.length === 2 && currentPath.endsWith(":")) {
// 		currentPath += "/";
// 	}

// 	// If at root of any drive, go to drives view
// 	if (currentPath.match(/^[A-Z]:\/$/)) {
// 		showDrives();
// 		return;
// 	}

// 	// Remove the last segment
// 	let parts = currentPath.substring(0, currentPath.length - 1).split("/");
// 	parts.pop();

// 	if (parts.length === 1 && parts[0].endsWith(":")) {
// 		navigateTo(parts[0] + "/");
// 	} else if (parts.length > 1) {
// 		navigateTo(parts.join("/") + "/");
// 	} else {
// 		showDrives();
// 	}
// };

// drivesButton.onclick = () => {
// 	showDrives();
// };

// // Initialize the file explorer with drives view
// showDrives();

main();
