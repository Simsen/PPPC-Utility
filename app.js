// PPPC Permissions Data
const PPPC_PERMISSIONS = [
    {
        id: 'accessibility',
        name: 'Accessibility',
        description: 'Control your computer using accessibility features',
        tccService: 'Accessibility',
        canForceAllow: true,
    },
    {
        id: 'fullDiskAccess',
        name: 'Full Disk Access',
        description: 'Access all files on the system, including system-protected areas',
        tccService: 'SystemPolicyAllFiles',
        canForceAllow: true,
    },
    {
        id: 'screenRecording',
        name: 'Screen Recording',
        description: 'Record the contents of the screen',
        tccService: 'ScreenCapture',
        canForceAllow: false,
        tooltip: 'Apple requires user consent for Screen Recording. MDM can only allow standard users to enable this permission.',
    },
    {
        id: 'microphone',
        name: 'Microphone',
        description: 'Access the microphone',
        tccService: 'Microphone',
        canForceAllow: false,
        tooltip: 'Apple requires user consent for Microphone access. MDM can only allow standard users to enable this permission.',
    },
    {
        id: 'camera',
        name: 'Camera',
        description: 'Access the camera',
        tccService: 'Camera',
        canForceAllow: false,
        tooltip: 'Apple requires user consent for Camera access. MDM can only allow standard users to enable this permission.',
    },
    {
        id: 'automation',
        name: 'Automation (Apple Events)',
        description: 'Control other apps via Apple Events/AppleScript',
        tccService: 'AppleEvents',
        canForceAllow: true,
    },
    {
        id: 'contacts',
        name: 'Contacts',
        description: 'Access your contacts',
        tccService: 'AddressBook',
        canForceAllow: true,
    },
    {
        id: 'calendars',
        name: 'Calendars',
        description: 'Access your calendars',
        tccService: 'Calendar',
        canForceAllow: true,
    },
    {
        id: 'photos',
        name: 'Photos',
        description: 'Access your photo library',
        tccService: 'Photos',
        canForceAllow: true,
    },
    {
        id: 'bluetooth',
        name: 'Bluetooth',
        description: 'Use Bluetooth devices',
        tccService: 'BluetoothAlways',
        canForceAllow: true,
    },
    {
        id: 'removableVolumes',
        name: 'Removable Volumes',
        description: 'Access files on removable volumes',
        tccService: 'SystemPolicyRemovableVolumes',
        canForceAllow: true,
    },
];

// Known Apps Data
const KNOWN_APPS = [
    {
        bundleId: 'com.microsoft.teams',
        displayName: 'Microsoft Teams',
        codeRequirement: 'identifier "com.microsoft.teams" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = UBF8T346G9',
    },
    {
        bundleId: 'us.zoom.xos',
        displayName: 'Zoom',
        codeRequirement: 'identifier "us.zoom.xos" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = BJ4HAAB9B3',
    },
    {
        bundleId: 'com.microsoft.edgemac',
        displayName: 'Microsoft Edge',
        codeRequirement: 'identifier "com.microsoft.edgemac" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = UBF8T346G9',
    },
    {
        bundleId: 'com.google.Chrome',
        displayName: 'Google Chrome',
        codeRequirement: 'identifier "com.google.Chrome" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = EQHXZ8M8AV',
    },
    {
        bundleId: 'com.tinyspeck.slackmacgap',
        displayName: 'Slack',
        codeRequirement: 'identifier "com.tinyspeck.slackmacgap" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = BQR82RBBHL',
    },
];

// Application State
let selectedApps = []; // Array of { id, app, permissions, expanded, isKnownApp }
let nextAppId = 1;

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const templateTrigger = document.getElementById('template-trigger');
const templateMenu = document.getElementById('template-menu');
const selectedAppsSection = document.getElementById('selected-apps-section');
const selectedAppsList = document.getElementById('selected-apps-list');
const appCountEl = document.getElementById('app-count');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');
const profileSettingsSection = document.getElementById('profile-settings-section');
const previewSection = document.getElementById('preview-section');
const xmlOutput = document.getElementById('xml-output');
const downloadBtn = document.getElementById('download-btn');
const copyBtn = document.getElementById('copy-btn');
const summaryBox = document.getElementById('summary-box');
const permissionTags = document.getElementById('permission-tags');

// Profile Settings
let profileOrganization = '';
let profilePayloadName = '';
let profilePayloadIdentifier = '';
let profilePayloadDescription = '';

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeState();
    setupEventListeners();
    populateTemplateMenu();
    profilePayloadIdentifier = generateRandomUUID();
    document.getElementById('payloadIdentifier').value = profilePayloadIdentifier;
});

// Initialize Default State
function initializeState() {
    // No apps selected initially
}

// Create default permissions object
function createDefaultPermissions() {
    const perms = {};
    PPPC_PERMISSIONS.forEach(perm => {
        perms[perm.id] = { enabled: false, authorization: 'Allow' };
    });
    return perms;
}

// Setup Event Listeners
function setupEventListeners() {
    // Dropzone
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Template Dropdown
    templateTrigger.addEventListener('click', toggleTemplateMenu);
    document.addEventListener('click', (e) => {
        if (!templateTrigger.contains(e.target) && !templateMenu.contains(e.target)) {
            templateMenu.classList.remove('open');
        }
    });

    // Profile Settings Inputs
    document.getElementById('organizationInput').addEventListener('input', (e) => {
        profileOrganization = e.target.value;
        updatePreview();
    });
    document.getElementById('payloadNameInput').addEventListener('input', (e) => {
        profilePayloadName = e.target.value;
        updatePreview();
    });
    document.getElementById('payloadIdentifier').addEventListener('input', (e) => {
        profilePayloadIdentifier = e.target.value;
        updatePreview();
    });
    document.getElementById('payloadDescriptionInput').addEventListener('input', (e) => {
        profilePayloadDescription = e.target.value;
        updatePreview();
    });
    document.getElementById('regenerateUUID').addEventListener('click', () => {
        profilePayloadIdentifier = generateRandomUUID();
        document.getElementById('payloadIdentifier').value = profilePayloadIdentifier;
        updatePreview();
    });

    // Download & Copy Buttons
    downloadBtn.addEventListener('click', downloadMobileconfig);
    copyBtn.addEventListener('click', copyToClipboard);
}

// Populate Template Menu
function populateTemplateMenu() {
    templateMenu.innerHTML = KNOWN_APPS.map(app => `
        <button class="dropdown-item" data-bundle="${app.bundleId}">
            <span class="app-name">${app.displayName}</span>
            <span class="app-bundle">${app.bundleId}</span>
        </button>
    `).join('');

    templateMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const bundleId = item.dataset.bundle;
            const app = KNOWN_APPS.find(a => a.bundleId === bundleId);
            if (app) {
                addApp({ ...app }, true);
                templateMenu.classList.remove('open');
            }
        });
    });
}

// Toggle Template Menu
function toggleTemplateMenu() {
    templateMenu.classList.toggle('open');
}

// Drag & Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFiles(files);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFiles(files);
    }
    fileInput.value = ''; // Reset for re-selection
}

// Process multiple files
async function processFiles(files) {
    for (const file of files) {
        try {
            await processFile(file);
        } catch (error) {
            showError(error.message);
        }
    }
}

// Process File
async function processFile(file) {
    hideError();
    
    if (file.name.endsWith('.zip')) {
        await processZipFile(file);
    } else if (file.name.endsWith('.plist') || file.name === 'Info.plist') {
        await processPlistFile(file);
    } else {
        throw new Error('Please upload a .zip file containing an .app bundle or an Info.plist file');
    }
}

// Process ZIP File
async function processZipFile(file) {
    const zip = await JSZip.loadAsync(file);
    let infoPlistPath = null;
    
    zip.forEach((relativePath, entry) => {
        if (relativePath.match(/\.app\/Contents\/Info\.plist$/)) {
            infoPlistPath = relativePath;
        }
    });

    if (!infoPlistPath) {
        throw new Error('No Info.plist found in the .app bundle');
    }

    const content = await zip.file(infoPlistPath).async('string');
    const appInfo = parsePlist(content);
    addApp(appInfo, false);
}

// Process Plist File
async function processPlistFile(file) {
    const content = await file.text();
    const appInfo = parsePlist(content);
    addApp(appInfo, false);
}

// Parse Plist
function parsePlist(content) {
    try {
        const data = plist.parse(content);
        const bundleId = data.CFBundleIdentifier;
        const displayName = data.CFBundleDisplayName || data.CFBundleName || bundleId;
        
        if (!bundleId) {
            throw new Error('No CFBundleIdentifier found in plist');
        }

        // Check if this is a known app and get its code requirement
        const knownApp = KNOWN_APPS.find(a => a.bundleId === bundleId);
        
        return {
            bundleId,
            displayName,
            codeRequirement: knownApp ? knownApp.codeRequirement : null,
        };
    } catch (error) {
        throw new Error('Failed to parse plist: ' + error.message);
    }
}

// Add App to Selected Apps
function addApp(appInfo, isKnownApp) {
    // Check if app already exists
    const exists = selectedApps.some(item => item.app.bundleId === appInfo.bundleId);
    if (exists) {
        showError(`${appInfo.displayName} is already added`);
        return;
    }

    const appEntry = {
        id: nextAppId++,
        app: appInfo,
        permissions: createDefaultPermissions(),
        expanded: selectedApps.length === 0, // Expand first app by default
        isKnownApp: isKnownApp || KNOWN_APPS.some(a => a.bundleId === appInfo.bundleId),
    };

    selectedApps.push(appEntry);
    hideError();
    updateUI();
}

// Remove App from Selected Apps
function removeApp(appId) {
    selectedApps = selectedApps.filter(item => item.id !== appId);
    updateUI();
}

// Toggle App Expansion
function toggleAppExpansion(appId) {
    selectedApps = selectedApps.map(item => ({
        ...item,
        expanded: item.id === appId ? !item.expanded : item.expanded,
    }));
    renderAppsList();
}

// Update Permission for App
function updatePermission(appId, permId, enabled) {
    const appEntry = selectedApps.find(item => item.id === appId);
    if (appEntry) {
        appEntry.permissions[permId].enabled = enabled;
        renderAppsList();
        updatePreview();
    }
}

// Update Authorization for App's Permission
function updateAuthorization(appId, permId, auth) {
    const appEntry = selectedApps.find(item => item.id === appId);
    if (appEntry) {
        appEntry.permissions[permId].authorization = auth;
        updatePreview();
    }
}

// Update Code Requirement for App
function updateCodeRequirement(appId, codeReq) {
    const appEntry = selectedApps.find(item => item.id === appId);
    if (appEntry) {
        appEntry.app.codeRequirement = codeReq || null;
        updatePreview();
    }
}

// Update UI
function updateUI() {
    const hasApps = selectedApps.length > 0;
    
    // Show/hide sections
    if (hasApps) {
        selectedAppsSection.classList.remove('hidden');
        profileSettingsSection.classList.remove('hidden');
        previewSection.classList.remove('hidden');
    } else {
        selectedAppsSection.classList.add('hidden');
        profileSettingsSection.classList.add('hidden');
        previewSection.classList.add('hidden');
    }
    
    // Update app count
    appCountEl.textContent = `${selectedApps.length} app${selectedApps.length !== 1 ? 's' : ''}`;
    
    renderAppsList();
    updatePreview();
}

// Render Apps List
function renderAppsList() {
    selectedAppsList.innerHTML = selectedApps.map(item => {
        const enabledCount = Object.values(item.permissions).filter(p => p.enabled).length;
        const permCountClass = enabledCount > 0 ? '' : 'none';
        const expandedClass = item.expanded ? 'expanded' : '';
        
        return `
            <div class="app-card ${expandedClass}" data-app-id="${item.id}">
                <div class="app-card-header">
                    <div class="app-card-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="16" height="16" x="4" y="4" rx="2"/>
                            <rect width="6" height="6" x="9" y="9" rx="1"/>
                            <path d="M15 2v2"/>
                            <path d="M15 20v2"/>
                            <path d="M2 15h2"/>
                            <path d="M2 9h2"/>
                            <path d="M20 15h2"/>
                            <path d="M20 9h2"/>
                            <path d="M9 2v2"/>
                            <path d="M9 20v2"/>
                        </svg>
                    </div>
                    <div class="app-card-info">
                        <p class="app-card-name">${escapeHtml(item.app.displayName)}</p>
                        <p class="app-card-bundle">${escapeHtml(item.app.bundleId)}</p>
                    </div>
                    <div class="app-card-meta">
                        <span class="app-perm-count ${permCountClass}">${enabledCount} permission${enabledCount !== 1 ? 's' : ''}</span>
                        <svg class="app-expand-icon" xmlns="https://shadcn.io/og?iconName=chevron-down&iconLibrary=heroicons" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m6 9 6 6 6-6"/>
                        </svg>
                        <button class="app-remove-btn" data-remove-id="${item.id}" title="Remove app">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 6 6 18"/>
                                <path d="m6 6 12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="app-card-body">
                    ${!item.isKnownApp ? renderCodeRequirementSection(item) : ''}
                    <div class="app-permissions-header">
                        <h4>Permissions</h4>
                        <span class="permission-count">${enabledCount} enabled</span>
                    </div>
                    <div class="app-permissions-list">
                        ${renderPermissionsForApp(item)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners
    document.querySelectorAll('.app-card-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking remove button
            if (e.target.closest('.app-remove-btn')) return;
            const appId = parseInt(header.closest('.app-card').dataset.appId);
            toggleAppExpansion(appId);
        });
    });

    document.querySelectorAll('.app-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const appId = parseInt(btn.dataset.removeId);
            removeApp(appId);
        });
    });

    document.querySelectorAll('.app-perm-toggle').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const appId = parseInt(e.target.dataset.appId);
            const permId = e.target.dataset.permId;
            updatePermission(appId, permId, e.target.checked);
        });
    });

    document.querySelectorAll('.app-auth-dropdown').forEach(dropdown => {
        dropdown.addEventListener('change', (e) => {
            const appId = parseInt(e.target.dataset.appId);
            const permId = e.target.dataset.permId;
            updateAuthorization(appId, permId, e.target.value);
        });
    });

    document.querySelectorAll('.app-code-req-input').forEach(textarea => {
        textarea.addEventListener('input', (e) => {
            const appId = parseInt(e.target.dataset.appId);
            updateCodeRequirement(appId, e.target.value);
        });
    });
}

// Render Code Requirement Section for custom apps
function renderCodeRequirementSection(item) {
    return `
        <div class="app-code-requirement">
            <label>
                <svg xmlns="https://i.ytimg.com/vi/nhieMw1vegc/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCtGiiU5JT3JBR3Pny8BLnNI3nfBw" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 18 22 12 16 6"/>
                    <polyline points="8 6 2 12 8 18"/>
                </svg>
                Code Requirement
            </label>
            <textarea 
                class="app-code-req-input" 
                data-app-id="${item.id}" 
                placeholder="identifier &quot;com.example.app&quot; and anchor apple generic..."
            >${item.app.codeRequirement || ''}</textarea>
            <p class="code-req-hint">
                <svg xmlns="https://upload.wikimedia.org/wikipedia/commons/2/23/Warning_circle_exclamation_mark.png" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4"/>
                    <path d="M12 8h.01"/>
                </svg>
                Run <code>codesign -dr - /Applications/YourApp.app</code> to get this value
            </p>
        </div>
    `;
}

// Render Permissions for a specific app
function renderPermissionsForApp(item) {
    return PPPC_PERMISSIONS.map(perm => {
        const state = item.permissions[perm.id];
        const isEnabled = state.enabled;
        const canForce = perm.canForceAllow;
        
        const badgeHtml = canForce 
            ? '<span class="permission-badge mdm">MDM</span>'
            : '<span class="permission-badge user-consent">User Consent</span>';
        
        const authDropdownHtml = isEnabled && canForce ? `
            <select class="auth-dropdown app-auth-dropdown" data-app-id="${item.id}" data-perm-id="${perm.id}">
                <option value="Allow" ${state.authorization === 'Allow' ? 'selected' : ''}>Allow</option>
                <option value="Deny" ${state.authorization === 'Deny' ? 'selected' : ''}>Deny</option>
            </select>
        ` : '';
        
        return `
            <div class="permission-item ${isEnabled ? 'enabled' : ''}">
                <div class="permission-info">
                    <div class="permission-header">
                        <span class="permission-name">${perm.name}</span>
                        ${badgeHtml}
                    </div>
                    <p class="permission-description">${perm.description}</p>
                </div>
                <div class="permission-controls">
                    ${authDropdownHtml}
                    <label class="toggle-switch">
                        <input type="checkbox" class="app-perm-toggle" data-app-id="${item.id}" data-perm-id="${perm.id}" ${isEnabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `;
    }).join('');
}

// Update Preview
function updatePreview() {
    const totalPermissions = getTotalEnabledPermissions();
    const hasPermissions = totalPermissions > 0;
    
    // Enable/disable buttons
    if (hasPermissions) {
        downloadBtn.disabled = false;
        downloadBtn.classList.remove('disabled');
        copyBtn.disabled = false;
        copyBtn.classList.remove('disabled');
    } else {
        downloadBtn.disabled = true;
        downloadBtn.classList.add('disabled');
        copyBtn.disabled = true;
        copyBtn.classList.add('disabled');
    }
    
    // Generate and display XML
    if (selectedApps.length > 0) {
        const xml = generateMobileconfig();
        xmlOutput.textContent = xml;
        updateSummary();
    } else {
        xmlOutput.textContent = '<!-- Add an application to see the generated configuration -->';
    }
}

// Get total enabled permissions across all apps
function getTotalEnabledPermissions() {
    return selectedApps.reduce((total, item) => {
        return total + Object.values(item.permissions).filter(p => p.enabled).length;
    }, 0);
}

// Update Summary Box
function updateSummary() {
    const allPerms = [];
    selectedApps.forEach(item => {
        Object.entries(item.permissions).forEach(([id, state]) => {
            if (state.enabled) {
                const perm = PPPC_PERMISSIONS.find(p => p.id === id);
                if (perm) {
                    allPerms.push({
                        appName: item.app.displayName,
                        permName: perm.name,
                        auth: state.authorization,
                        canForce: perm.canForceAllow,
                    });
                }
            }
        });
    });
    
    if (allPerms.length > 0) {
        summaryBox.classList.remove('hidden');
        permissionTags.innerHTML = allPerms.map(p => `
            <span class="permission-tag ${p.auth.toLowerCase()}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                ${escapeHtml(p.appName)}: ${p.permName} (${p.canForce ? p.auth : 'User Consent'})
            </span>
        `).join('');
    } else {
        summaryBox.classList.add('hidden');
    }
}

// Generate Mobileconfig XML
function generateMobileconfig() {
    const profileName = profilePayloadName || 'PPPC Configuration';
    const organization = profileOrganization || 'IT Department';
    const description = profilePayloadDescription || '';
    const profileUUID = profilePayloadIdentifier || generateRandomUUID();
    
    // Build Services dict with all apps
    const servicesContent = buildServicesDict();
    
    if (!servicesContent) {
        return generateEmptyProfile(profileName, organization, description, profileUUID);
    }
    
    const innerPayloadUUID = generateRandomUUID();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadDescription</key>
            <string>${escapeXml(profileName)}</string>
            <key>PayloadDisplayName</key>
            <string>${escapeXml(profileName)}</string>
            <key>PayloadIdentifier</key>
            <string>${innerPayloadUUID}</string>
            <key>PayloadOrganization</key>
            <string>${escapeXml(organization)}</string>
            <key>PayloadType</key>
            <string>com.apple.TCC.configuration-profile-policy</string>
            <key>PayloadUUID</key>
            <string>${innerPayloadUUID}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Services</key>
            <dict>
${servicesContent}
            </dict>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>${escapeXml(description)}</string>
    <key>PayloadDisplayName</key>
    <string>${escapeXml(profileName)}</string>
    <key>PayloadIdentifier</key>
    <string>${profileUUID}</string>
    <key>PayloadOrganization</key>
    <string>${escapeXml(organization)}</string>
    <key>PayloadScope</key>
    <string>System</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${profileUUID}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;
}

// Build Services dict for all apps
function buildServicesDict() {
    const serviceGroups = {};
    
    // Group permissions by TCC service
    selectedApps.forEach(item => {
        Object.entries(item.permissions).forEach(([permId, state]) => {
            if (state.enabled) {
                const perm = PPPC_PERMISSIONS.find(p => p.id === permId);
                if (perm) {
                    const service = perm.tccService;
                    if (!serviceGroups[service]) {
                        serviceGroups[service] = [];
                    }
                    serviceGroups[service].push({
                        app: item.app,
                        authorization: state.authorization,
                        canForceAllow: perm.canForceAllow,
                    });
                }
            }
        });
    });
    
    if (Object.keys(serviceGroups).length === 0) {
        return null;
    }
    
    // Build XML for each service
    const servicesXml = Object.entries(serviceGroups).map(([service, apps]) => {
        const appsXml = apps.map(({ app, authorization, canForceAllow }) => {
            const codeReq = app.codeRequirement || `identifier "${app.bundleId}" and anchor apple generic`;
            const auth = canForceAllow ? authorization : 'AllowStandardUserToSetSystemService';
            
            return `                    <dict>
                        <key>Authorization</key>
                        <string>${auth}</string>
                        <key>CodeRequirement</key>
                        <string>${escapeXml(codeReq)}</string>
                        <key>Comment</key>
                        <string></string>
                        <key>Identifier</key>
                        <string>${escapeXml(app.bundleId)}</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                    </dict>`;
        }).join('\n');
        
        return `                <key>${service}</key>
                <array>
${appsXml}
                </array>`;
    }).join('\n');
    
    return servicesXml;
}

// Generate Empty Profile
function generateEmptyProfile(name, org, desc, uuid) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array/>
    <key>PayloadDescription</key>
    <string>${escapeXml(desc)}</string>
    <key>PayloadDisplayName</key>
    <string>${escapeXml(name)}</string>
    <key>PayloadIdentifier</key>
    <string>${uuid}</string>
    <key>PayloadOrganization</key>
    <string>${escapeXml(org)}</string>
    <key>PayloadScope</key>
    <string>System</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${uuid}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;
}

// Download Mobileconfig
function downloadMobileconfig() {
    if (selectedApps.length === 0 || getTotalEnabledPermissions() === 0) return;
    
    const xml = generateMobileconfig();
    const blob = new Blob([xml], { type: 'application/x-apple-aspen-config' });
    const url = URL.createObjectURL(blob);
    
    const appNames = selectedApps.map(item => item.app.bundleId.split('.').pop()).join('-');
    const filename = profilePayloadName || `PPPC-${appNames || 'profile'}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.mobileconfig`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Copy to Clipboard
function copyToClipboard() {
    if (selectedApps.length === 0 || getTotalEnabledPermissions() === 0) return;
    
    const xml = generateMobileconfig();
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(xml).then(() => {
            showCopiedFeedback();
        }).catch(() => {
            fallbackCopy(xml);
        });
    } else {
        fallbackCopy(xml);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showCopiedFeedback();
    } catch (e) {
        console.error('Copy failed:', e);
    }
    document.body.removeChild(textarea);
}

function showCopiedFeedback() {
    const originalHtml = copyBtn.innerHTML;
    copyBtn.innerHTML = `
        <svg xmlns="https://i.etsystatic.com/42994182/r/il/57c240/6949088985/il_570xN.6949088985_9oxd.jpg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied!
    `;
    copyBtn.classList.add('copied');
    
    setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
        copyBtn.classList.remove('copied');
    }, 2000);
}

// Show Error
function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
}

// Hide Error
function hideError() {
    errorBox.classList.add('hidden');
}

// Escape XML special characters (not quotes in text content)
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Escape HTML
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Generate Random UUID
function generateRandomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16).toUpperCase();
    });
}
