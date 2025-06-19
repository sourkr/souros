// apps/os_update.js

const windowId = os.win.openWindow();
os.win.setTitle(windowId, 'OS Update');

const container = document.createElement('div');
Object.assign(container.style, {
  padding: '20px',
  fontFamily: `'Segoe UI', Roboto, sans-serif`,
  color: '#222',
  backgroundColor: '#f9f9f9',
  borderRadius: '8px',
  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
  maxWidth: '400px',
  margin: 'auto'
});

// Heading
const heading = document.createElement('h2');
heading.textContent = 'System Update';
heading.style.fontSize = '1.5rem';
heading.style.marginBottom = '1rem';
container.appendChild(heading);

// Info row helper
function createInfoRow(labelText, valueText, id) {
  const row = document.createElement('div');
  row.style.marginBottom = '0.8rem';

  const label = document.createElement('div');
  label.textContent = labelText;
  label.style.fontSize = '0.9rem';
  label.style.marginBottom = '2px';

  const value = document.createElement('div');
  value.id = id;
  value.textContent = valueText;
  value.style.fontWeight = '600';
  value.style.fontSize = '1rem';

  row.appendChild(label);
  row.appendChild(value);
  return { row, valueElem: value };
}

const { row: currentRow, valueElem: currentVersionElem } = createInfoRow('Current Version', '1.0.0', 'osUpdateCurrentVersion');
const { row: availableRow, valueElem: availableVersionElem } = createInfoRow('Available Version', '-', 'osUpdateAvailableVersion');

container.appendChild(currentRow);
container.appendChild(availableRow);

// Buttons wrapper
const buttonRow = document.createElement('div');
buttonRow.style.marginTop = '1rem';
buttonRow.style.display = 'flex';
buttonRow.style.gap = '10px';

const checkForUpdatesBtn = document.createElement('button');
checkForUpdatesBtn.id = 'osCheckForUpdatesBtn';
checkForUpdatesBtn.textContent = 'Check for Updates';
Object.assign(checkForUpdatesBtn.style, {
  padding: '10px 16px',
  backgroundColor: '#4CAF50',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  flex: '1',
  fontWeight: '500'
});

const applyUpdateBtn = document.createElement('button');
applyUpdateBtn.id = 'osApplyUpdateBtn';
applyUpdateBtn.textContent = 'Apply Update';
applyUpdateBtn.disabled = true;
Object.assign(applyUpdateBtn.style, {
  padding: '10px 16px',
  backgroundColor: '#2196F3',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  flex: '1',
  fontWeight: '500',
  opacity: '0.6'
});

applyUpdateBtn.addEventListener('mouseenter', () => {
  if (!applyUpdateBtn.disabled) applyUpdateBtn.style.opacity = '1';
});
applyUpdateBtn.addEventListener('mouseleave', () => {
  if (!applyUpdateBtn.disabled) applyUpdateBtn.style.opacity = '0.9';
});

buttonRow.appendChild(checkForUpdatesBtn);
buttonRow.appendChild(applyUpdateBtn);
container.appendChild(buttonRow);

// Status text
const statusElem = document.createElement('p');
statusElem.id = 'osUpdateStatus';
statusElem.style.marginTop = '1.2rem';
statusElem.style.fontSize = '0.9rem';
statusElem.style.color = '#555';
container.appendChild(statusElem);

os.win.setContent(windowId, container);

// Logic section (same as before)
let latestServerVersionInfo = null;

async function fetchCurrentOSVersion() {
  try {
    const fd = os.fs.open('A:/os-version.txt', 'read');
    const versionStr = os.fs.read(fd);
    os.fs.close(fd);
    if (versionStr) {
      const version = versionStr.trim();
      currentVersionElem.textContent = version;
      return version;
    }
  } catch (e) {
    console.error('Error reading installed OS version:', e);
    currentVersionElem.textContent = 'Error';
  }
  return '1.0.0';
}

async function updateOSDir(webDir, sysDir) {
  const list = await (await fetch(webDir)).json();

  for (const entry of list) {
    const path = `${sysDir}${entry.name}`;

    if (entry.type === 'file') {
      const content = await (await fetch(`${webDir}/${entry.name}`)).text();
      const fd = os.fs.open(path, 'write');
      os.fs.write(fd, content);
      os.fs.close(fd);
    } else {
      await updateOSDir(`${webDir}/${entry.name}`, `${path}/`);
    }
  }
}

checkForUpdatesBtn.addEventListener('click', async () => {
  statusElem.textContent = 'Checking for updates...';
  applyUpdateBtn.disabled = true;
  applyUpdateBtn.style.opacity = '0.6';
  latestServerVersionInfo = null;

  const currentVersion = await fetchCurrentOSVersion();

  try {
    const response = await fetch('/api/os-version');
    if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
    const latestVersion = (await response.text()).trim();

    availableVersionElem.textContent = latestVersion;
    latestServerVersionInfo = {
      latestVersion,
      description: 'New features and bug fixes.'
    };

    if (latestVersion > currentVersion) {
      statusElem.textContent = `Update available: ${latestVersion} – ${latestServerVersionInfo.description}`;
      applyUpdateBtn.disabled = false;
      applyUpdateBtn.style.opacity = '1';
    } else {
      statusElem.textContent = 'Your OS is up to date.';
    }
  } catch (error) {
    console.error('Error checking for update:', error);
    statusElem.textContent = 'Update check failed.';
    availableVersionElem.textContent = '-';
  }
});

applyUpdateBtn.addEventListener('click', async () => {
  if (!latestServerVersionInfo) return;
  statusElem.textContent = `Applying update to ${latestServerVersionInfo.latestVersion}...`;
  applyUpdateBtn.disabled = true;
  applyUpdateBtn.style.opacity = '0.6';

  try {
    await updateOSDir('/api/os-files-content', 'A:/');
    // const fd = os.fs.open('A:/os-version.txt', 'write');
    // os.fs.write(fd, latestServerVersionInfo.latestVersion + '\n');
    // os.fs.close(fd);

    currentVersionElem.textContent = latestServerVersionInfo.latestVersion;
    availableVersionElem.textContent = '-';
    latestServerVersionInfo = null;
    statusElem.textContent = 'OS updated successfully! Restart might be required.';
  } catch (e) {
    console.error('Update failed:', e);
    statusElem.textContent = 'Failed to apply update.';
    applyUpdateBtn.disabled = false;
    applyUpdateBtn.style.opacity = '1';
  }
});
