const { app, BrowserWindow, ipcMain, Tray, Menu, powerMonitor, screen } = require('electron');

if (app) {
    // Disable hardware acceleration to save system RAM used by GPU and reduce heat
    app.disableHardwareAcceleration();


    // Limit JS heap and memory usage, and force software rendering consistency
    app.commandLine.appendSwitch('js-flags', '--max-old-space-size=64');
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer'); // Some sources suggest this helps, others say it forces CPU. For "no heat", we want minimal work.
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-gpu-rasterization');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('disable-yuv-image-decoding');
    app.commandLine.appendSwitch('disable-breakpad');

    // Request single instance lock
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
    }
}

if (!app) {
    console.error('FATAL: app object is undefined. Ensure you are running with Electron, not Node.');
    // If we're not in Electron, we can't do much.
}
const path = require('path');
const si = require('systeminformation');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let tray;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: 5, // Extremely thin bar
        x: 0,
        y: 0,
        frame: false,
        resizable: false,
        transparent: true,
        alwaysOnTop: true,
        focusable: false, // Don't steal focus
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false
        }
    });

    // Make it stay on top even above fullscreen apps (optional/risky)
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true);

    console.log('Loading index.html...');
    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window content finished loading.');
    });

    // Right-click menu for settings accessibility
    mainWindow.webContents.on('context-menu', (e, params) => {
        const menu = Menu.buildFromTemplate([
            { label: 'Show Widget', click: () => mainWindow.show() },
            {
                label: 'Always on Top',
                type: 'checkbox',
                checked: mainWindow.isAlwaysOnTop(),
                click: (menuItem) => {
                    mainWindow.setAlwaysOnTop(menuItem.checked);
                }
            },
            {
                label: 'Check for Updates',
                click: () => {
                    autoUpdater.checkForUpdatesAndNotify();
                    electron.dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'PH Reloaded',
                        message: 'Checking for updates...',
                        detail: 'The app will notify you if a new version is found.',
                        buttons: ['OK']
                    });
                }
            },
            {
                label: 'How to Move/Uninstall',
                click: () => {
                    electron.dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'PH Reloaded Help',
                        message: 'App Instructions:',
                        detail: '• MOVE: Click and drag anywhere on the battery.\n• UNINSTALL: Go to Windows "Apps & Features" and search for PH Reloaded.\n• PIN: Toggle "Always on Top" to keep it floating.',
                        buttons: ['OK']
                    });
                }
            },
            {
                label: 'Settings Info',
                click: () => {
                    electron.dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'PH Reloaded Settings',
                        message: 'Current Configuration:',
                        detail: '• Style: Vecna / The Curse\n• Performance: Low RAM & CPU Mode\n• Updates: Automatic & Manual\n• Sync: Windows Power Events & Polling',
                        buttons: ['OK']
                    });
                }
            },
            {
                label: 'Launch on Startup',
                type: 'checkbox',
                checked: app.getLoginItemSettings().openAtLogin,
                click: (menuItem) => {
                    app.setLoginItemSettings({ openAtLogin: menuItem.checked });
                }
            },
            { type: 'separator' },
            { label: 'Quit', click: () => app.quit() }
        ]);
        menu.popup(BrowserWindow.fromWebContents(e.sender));
    });

    // Periodically send battery data - SLOW Heartbeat (Fallback)
    // We rely on the Renderer's navigator.getBattery() for real-time updates.
    // This main process poll is just a backup for "Power Saver" modes where
    // the renderer might be throttled.
    let lastData = { percent: -1, isCharging: null };
    let pollingInterval = null;

    const sendBatteryUpdate = async () => {
        try {
            const battery = await si.battery();
            // Only send if substantial change detected
            if (battery.percent !== lastData.percent ||
                battery.isCharging !== lastData.isCharging ||
                battery.acConnected !== lastData.acConnected) {

                lastData = {
                    percent: battery.percent,
                    isCharging: battery.isCharging,
                    acConnected: battery.acConnected
                };
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('battery-data', battery);
                }
            }
        } catch (error) {
            // Silently fail
        }
    };

    const startPolling = (intervalMs) => {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(sendBatteryUpdate, intervalMs);
    };

    // Very slow poll (5 minutes) - just to ensure we don't drift forever if events fail
    startPolling(300000);

    // Windows Power Event Listeners (Instant Response)
    if (powerMonitor) {
        powerMonitor.on('on-ac', () => {
            sendBatteryUpdate(); // Force update on trigger
            if (mainWindow) mainWindow.webContents.send('power-source-changed', 'ac');
        });
        powerMonitor.on('on-battery', () => {
            sendBatteryUpdate(); // Force update on trigger
            if (mainWindow) mainWindow.webContents.send('power-source-changed', 'battery');
        });
    }

    // Initial call
    sendBatteryUpdate();


    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Auto-Updater logic
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        mainWindow.webContents.send('update_available');
    });

    autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update_downloaded');
    });
}

function createTray() {
    try {
        const iconPath = path.join(__dirname, 'icon.png');
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Show Widget', click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
            {
                label: 'Always on Top',
                type: 'checkbox',
                checked: mainWindow ? mainWindow.isAlwaysOnTop() : true,
                click: (menuItem) => {
                    if (mainWindow) mainWindow.setAlwaysOnTop(menuItem.checked);
                }
            },
            {
                label: 'Launch on Startup',
                type: 'checkbox',
                checked: app.getLoginItemSettings().openAtLogin,
                click: (menuItem) => {
                    app.setLoginItemSettings({ openAtLogin: menuItem.checked });
                }
            },
            { type: 'separator' },
            { label: 'Quit', click: () => app.quit() }
        ]);
        tray.setToolTip('PhReloaded Battery Monitor');
        tray.setContextMenu(contextMenu);
    } catch (e) {
        console.log("Tray icon failed to load, skipping tray creation.");
    }
}

app.whenReady().then(() => {
    // Enable auto-launch
    try {
        app.setLoginItemSettings({
            openAtLogin: true,
            path: process.execPath,
            args: []
        });
    } catch (e) {
        console.error("Failed to set login item settings:", e);
    }

    createWindow();
    createTray();

    ipcMain.on('restart_app', () => {
        autoUpdater.quitAndInstall();
    });

    // Handle Bar Expansion/Collapse
    ipcMain.on('set-window-height', (event, height) => {
        if (mainWindow) {
            const currentBounds = mainWindow.getBounds();
            mainWindow.setBounds({ ...currentBounds, height: height });
        }
    });

    // IPC listener for Tray Tooltip updates from Renderer
    ipcMain.on('update-tray-tooltip', (event, data) => {
        if (tray) {
            const toolTipText = `${data.percent}% - ${data.status}\n${data.warning || ''}`;
            tray.setToolTip(toolTipText.trim());
            // Optionally show balloon/notification if critical?
            // if (data.isCritical) { ... }
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
