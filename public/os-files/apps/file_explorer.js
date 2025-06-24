
const { Window, Element, FlexBox, Button } =
    await require("A:/apps/libs/gui.js");
const { svg } = await require("A:/apps/libs/image.js");

const mainContainer = new FlexBox("column");
let currentPath = null;

function main() {
    const window = new Window();
    window.title = "File Explorer";

    const root = new FlexBox("column");
    window.content = root;

    // Header with navigation
    const headerContainer = new FlexBox();
    root.append(headerContainer);
    headerContainer.css("background", "linear-gradient(135deg, #667eea 0%, #764ba2 100%)");
    headerContainer.css("padding", "12px");
    headerContainer.css("gap", "8px");
    headerContainer.css("align-items", "center");
    headerContainer.css("box-shadow", "0 2px 8px rgba(0,0,0,0.1)");

    const upBtn = new Button("⬆ Up");
    headerContainer.append(upBtn);
    upBtn.css("background", "rgba(255,255,255,0.2)");
    upBtn.css("color", "white");
    upBtn.css("border", "1px solid rgba(255,255,255,0.3)");
    upBtn.css("border-radius", "6px");
    upBtn.css("padding", "8px 16px");
    upBtn.css("font-weight", "500");
    upBtn.css("transition", "all 0.2s ease");
    
    upBtn.element.addEventListener("mouseenter", () => {
        upBtn.css("background", "rgba(255,255,255,0.3)");
        upBtn.css("transform", "translateY(-1px)");
    });
    
    upBtn.element.addEventListener("mouseleave", () => {
        upBtn.css("background", "rgba(255,255,255,0.2)");
        upBtn.css("transform", "translateY(0)");
    });

    upBtn.on("click", () => {
        if (currentPath) {
            const parts = currentPath.split("/");
            if (parts.length > 2) {
                parts.pop();
                if (parts[parts.length - 1] === "") parts.pop();
                update(parts.join("/") + "/");
            } else {
                update();
            }
        }
    });

    // Path display
    const pathDisplay = new Element("div");
    headerContainer.append(pathDisplay);
    pathDisplay.css("flex", "1");
    pathDisplay.css("background", "rgba(255,255,255,0.15)");
    pathDisplay.css("padding", "8px 12px");
    pathDisplay.css("border-radius", "6px");
    pathDisplay.css("color", "white");
    pathDisplay.css("font-family", "monospace");
    pathDisplay.css("font-size", "14px");
    pathDisplay.css("border", "1px solid rgba(255,255,255,0.2)");

    // Main content area
    const contentWrapper = new FlexBox("column");
    root.append(contentWrapper);
    contentWrapper.css("flex", "1");
    contentWrapper.css("background", "#f8f9fa");

    // Drive info panel (only shown for drives)
    const driveInfoPanel = new Element("div");
    contentWrapper.append(driveInfoPanel);
    driveInfoPanel.css("display", "none");
    driveInfoPanel.css("background", "white");
    driveInfoPanel.css("margin", "16px");
    driveInfoPanel.css("padding", "16px");
    driveInfoPanel.css("border-radius", "12px");
    driveInfoPanel.css("box-shadow", "0 2px 12px rgba(0,0,0,0.1)");
    driveInfoPanel.css("border", "1px solid #e9ecef");

    // File grid
    root.append(mainContainer);
    mainContainer.css("flex", "1");
    mainContainer.css("padding", "16px");
    mainContainer.css("gap", "12px");
    mainContainer.css("overflow-y", "auto");

    // Store references for navigation
    window.pathDisplay = pathDisplay;
    window.driveInfoPanel = driveInfoPanel;

    update();
}

async function createDriveCard(driveName) {
    const card = new Element("div");
    card.css("background", "white");
    card.css("border-radius", "12px");
    card.css("padding", "20px");
    card.css("box-shadow", "0 4px 16px rgba(0,0,0,0.08)");
    card.css("border", "1px solid #e9ecef");
    card.css("cursor", "pointer");
    card.css("transition", "all 0.3s ease");
    card.css("min-height", "120px");
    card.css("display", "flex");
    card.css("flex-direction", "column");
    card.css("justify-content", "space-between");

    // Drive icon and name
    const header = new Element("div");
    card.element.appendChild(header.element);
    header.css("display", "flex");
    header.css("align-items", "center");
    header.css("gap", "12px");
    header.css("margin-bottom", "16px");

    const icon = new Element("div");
    header.element.appendChild(icon.element);
    icon.css("width", "40px");
    icon.css("height", "40px");
    icon.css("background", "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)");
    icon.css("border-radius", "8px");
    icon.css("display", "flex");
    icon.css("align-items", "center");
    icon.css("justify-content", "center");
    icon.css("color", "white");
    icon.css("font-size", "20px");
    icon.css("font-weight", "bold");
    icon.text = "💾";

    const nameEl = new Element("div");
    header.element.appendChild(nameEl.element);
    nameEl.css("font-size", "18px");
    nameEl.css("font-weight", "600");
    nameEl.css("color", "#2c3e50");
    nameEl.text = `Drive ${driveName}`;

    // Space usage info
    try {
        const drive = os.drives.get(driveName);
        if (drive) {
            const used = await drive.used();
            const total = await drive.size();
            
            const spaceInfo = new Element("div");
            card.element.appendChild(spaceInfo.element);
            
            const usedMB = (used / (1024 * 1024)).toFixed(1);
            const totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(1) : "∞";
            const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
            
            const spaceText = new Element("div");
            spaceInfo.element.appendChild(spaceText.element);
            spaceText.css("font-size", "12px");
            spaceText.css("color", "#6c757d");
            spaceText.css("margin-bottom", "8px");
            spaceText.text = `${usedMB} MB used${total > 0 ? ` of ${totalMB} MB` : ""}`;
            
            if (total > 0) {
                const progressBar = new Element("div");
                spaceInfo.element.appendChild(progressBar.element);
                progressBar.css("width", "100%");
                progressBar.css("height", "6px");
                progressBar.css("background", "#e9ecef");
                progressBar.css("border-radius", "3px");
                progressBar.css("overflow", "hidden");
                
                const progressFill = new Element("div");
                progressBar.element.appendChild(progressFill.element);
                progressFill.css("height", "100%");
                progressFill.css("width", `${Math.min(percentage, 100)}%`);
                progressFill.css("background", percentage > 80 ? 
                    "linear-gradient(90deg, #ff6b6b, #ee5a24)" : 
                    "linear-gradient(90deg, #4facfe, #00f2fe)");
                progressFill.css("transition", "width 0.3s ease");
            }
        }
    } catch (error) {
        console.warn("Failed to get drive space info:", error);
    }

    // Hover effects
    card.element.addEventListener("mouseenter", () => {
        card.css("transform", "translateY(-4px)");
        card.css("box-shadow", "0 8px 24px rgba(0,0,0,0.12)");
    });

    card.element.addEventListener("mouseleave", () => {
        card.css("transform", "translateY(0)");
        card.css("box-shadow", "0 4px 16px rgba(0,0,0,0.08)");
    });

    card.on("click", () => update(driveName + "/"));

    return card;
}

function createFileItem(name, isDirectory = false) {
    const item = new Element("div");
    item.css("background", "white");
    item.css("border-radius", "8px");
    item.css("padding", "16px");
    item.css("box-shadow", "0 2px 8px rgba(0,0,0,0.06)");
    item.css("border", "1px solid #e9ecef");
    item.css("cursor", "pointer");
    item.css("transition", "all 0.2s ease");
    item.css("display", "flex");
    item.css("align-items", "center");
    item.css("gap", "12px");

    const icon = new Element("div");
    item.element.appendChild(icon.element);
    icon.css("width", "32px");
    icon.css("height", "32px");
    icon.css("display", "flex");
    icon.css("align-items", "center");
    icon.css("justify-content", "center");
    icon.css("border-radius", "6px");
    icon.css("font-size", "16px");

    if (isDirectory) {
        icon.css("background", "linear-gradient(135deg, #ffeaa7, #fdcb6e)");
        icon.text = "📁";
    } else {
        icon.css("background", "linear-gradient(135deg, #e17055, #d63031)");
        icon.text = "📄";
    }

    const nameEl = new Element("div");
    item.element.appendChild(nameEl.element);
    nameEl.css("font-size", "14px");
    nameEl.css("font-weight", "500");
    nameEl.css("color", "#2c3e50");
    nameEl.css("flex", "1");
    nameEl.text = name;

    // Hover effects
    item.element.addEventListener("mouseenter", () => {
        item.css("transform", "translateY(-2px)");
        item.css("box-shadow", "0 4px 16px rgba(0,0,0,0.1)");
        item.css("background", "#f8f9fa");
    });

    item.element.addEventListener("mouseleave", () => {
        item.css("transform", "translateY(0)");
        item.css("box-shadow", "0 2px 8px rgba(0,0,0,0.06)");
        item.css("background", "white");
    });

    return item;
}

async function update(path) {
    currentPath = path;
    
    // Update path display
    const pathDisplay = mainContainer.parent.parent.pathDisplay;
    const driveInfoPanel = mainContainer.parent.parent.driveInfoPanel;
    
    if (!path) {
        pathDisplay.text = "This PC";
        driveInfoPanel.css("display", "none");
        
        const driveNames = await sysget("fs.drives");
        mainContainer.clear();
        
        // Set grid layout for drives
        mainContainer.css("display", "grid");
        mainContainer.css("grid-template-columns", "repeat(auto-fill, minmax(280px, 1fr))");
        mainContainer.css("grid-gap", "16px");

        for (const driveName of driveNames) {
            const driveCard = await createDriveCard(driveName);
            mainContainer.append(driveCard);
        }
    } else {
        pathDisplay.text = path;
        driveInfoPanel.css("display", "block");
        
        // Show drive info for root of drives
        if (path.endsWith(":/")) {
            const driveName = path.slice(0, 2);
            try {
                const drive = os.drives.get(driveName);
                if (drive) {
                    const used = await drive.used();
                    const total = await drive.size();
                    const usedMB = (used / (1024 * 1024)).toFixed(1);
                    const totalMB = total > 0 ? (total / (1024 * 1024)).toFixed(1) : "∞";
                    
                    driveInfoPanel.element.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">💾</div>
                            <div style="flex: 1;">
                                <div style="font-size: 18px; font-weight: 600; color: #2c3e50; margin-bottom: 4px;">Drive ${driveName}</div>
                                <div style="color: #6c757d; font-size: 14px;">
                                    ${usedMB} MB used${total > 0 ? ` of ${totalMB} MB` : " (unlimited)"}
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                driveInfoPanel.css("display", "none");
            }
        } else {
            driveInfoPanel.css("display", "none");
        }

        const dir = await sysget("fs.open", path, "read");
        const entries = await sysget("fs.readdir", dir);
        
        syscall("fs.close", dir);
        mainContainer.clear();
        
        // Set flex layout for files
        mainContainer.css("display", "flex");
        mainContainer.css("flex-direction", "column");
        mainContainer.css("grid-template-columns", "none");

        for (const entry of entries) {
            const isDirectory = entry.endsWith("/") || !entry.includes(".");
            const displayName = entry.replace(/\/$/, "");
            const item = createFileItem(displayName, isDirectory);
            
            item.on("dblclick", () => {
                if (isDirectory) {
                    update(path + entry + (entry.endsWith("/") ? "" : "/"));
                }
            });
            
            mainContainer.append(item);
        }
    }
}

main();
