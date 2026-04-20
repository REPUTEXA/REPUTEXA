'use strict';

const path = require('path');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  dialog,
} = require('electron');
const { loadConfig, saveConfig } = require('./lib/config');
const { startTicketWatcher } = require('./lib/watcher');
const { trayIconForStatus } = require('./lib/tray-icons');

/** @type {Tray | null} */
let tray = null;
/** @type {BrowserWindow | null} */
let settingsWindow = null;
/** @type {ReturnType<typeof startTicketWatcher> | null} */
let watcherCtl = null;

/** @type {'ok' | 'error'} */
let cloudStatus = 'ok';

function userDataPath() {
  return app.getPath('userData');
}

function getConfig() {
  return loadConfig(userDataPath());
}

function applyOpenAtLogin(enabled) {
  if (process.platform !== 'win32') return;
  const on = !!enabled;
  try {
    app.setLoginItemSettings({
      openAtLogin: on,
      path: process.execPath,
      args: [],
    });
  } catch (e) {
    console.warn('[reputexa-sync] setLoginItemSettings', e);
  }
}

function updateTrayIcon() {
  if (!tray) return;
  const img = trayIconForStatus(nativeImage, cloudStatus);
  tray.setImage(img);
  const cfg = getConfig();
  const tid = typeof cfg.terminalId === 'string' ? cfg.terminalId.trim() : '';
  const staff = typeof cfg.staffName === 'string' ? cfg.staffName.trim() : '';
  const shift =
    tid && staff
      ? `Caisse : ${tid} | Équipier : ${staff}`
      : tid
        ? `Caisse : ${tid}`
        : 'Reputexa Sync';
  const net =
    cloudStatus === 'ok' ? ' — connecté' : ' — erreur réseau ou API';
  tray.setToolTip(`${shift}${net}`);
}

function logLine(msg) {
  const line = `${new Date().toISOString().slice(11, 19)} ${msg}`;
  console.log(line);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('log-line', line);
  }
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 640,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Paramètres',
      click: () => createSettingsWindow(),
    },
    {
      label: 'Scanner le dossier',
      click: async () => {
        if (watcherCtl) await watcherCtl.scanAll();
      },
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => app.quit(),
    },
  ]);
}

function ensureWatcher() {
  if (watcherCtl) {
    watcherCtl.restart();
    return;
  }
  watcherCtl = startTicketWatcher({
    userDataPath: userDataPath(),
    getConfig,
    onCloudStatus: (s) => {
      cloudStatus = s;
      updateTrayIcon();
    },
    log: logLine,
  });
  watcherCtl.restart();
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.reputexa.sync');

  const initial = getConfig();
  applyOpenAtLogin(initial.openAtLogin);

  const icon = trayIconForStatus(nativeImage, 'ok');
  tray = new Tray(icon);
  tray.setContextMenu(buildTrayMenu());
  tray.setToolTip('Reputexa Sync');
  tray.on('double-click', () => createSettingsWindow());

  ipcMain.handle('config:get', () => ({ ...getConfig(), platform: process.platform }));
  ipcMain.handle('config:set', (_e, patch) => {
    const next = saveConfig(userDataPath(), patch);
    if (process.platform === 'win32') {
      applyOpenAtLogin(next.openAtLogin);
    }
    updateTrayIcon();
    ensureWatcher();
    return next;
  });
  ipcMain.handle('dialog:pickFolder', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return r.filePaths[0];
  });
  ipcMain.handle('watcher:scan', async () => {
    if (watcherCtl) await watcherCtl.scanAll();
    return true;
  });

  updateTrayIcon();
  ensureWatcher();

  const tidOk = typeof initial.terminalId === 'string' && initial.terminalId.trim().length > 0;
  const staffOk = typeof initial.staffName === 'string' && initial.staffName.trim().length > 0;
  if (!initial.watchFolder || !initial.apiKey || !tidOk || !staffOk) {
    createSettingsWindow();
  }
});

app.on('window-all-closed', () => {
  /* Garder l'agent actif dans la barre des tâches. */
});
