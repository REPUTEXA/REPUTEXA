'use strict';

const fs = require('fs');
const path = require('path');

/** @typedef {{ watchFolder: string; baseUrl: string; apiKey: string; openAtLogin: boolean; terminalId: string; staffName: string }} SyncConfig */

const DEFAULTS = {
  watchFolder: '',
  baseUrl: 'http://localhost:3000',
  apiKey: '',
  openAtLogin: false,
  terminalId: '',
  staffName: '',
};

/**
 * @param {string} userDataPath
 * @returns {string}
 */
function configPath(userDataPath) {
  return path.join(userDataPath, 'config.json');
}

/**
 * @param {string} userDataPath
 * @returns {SyncConfig}
 */
function loadConfig(userDataPath) {
  const p = configPath(userDataPath);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      watchFolder: typeof parsed.watchFolder === 'string' ? parsed.watchFolder : DEFAULTS.watchFolder,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl.replace(/\/$/, '') : DEFAULTS.baseUrl,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULTS.apiKey,
      openAtLogin: typeof parsed.openAtLogin === 'boolean' ? parsed.openAtLogin : DEFAULTS.openAtLogin,
      terminalId: typeof parsed.terminalId === 'string' ? parsed.terminalId : DEFAULTS.terminalId,
      staffName: typeof parsed.staffName === 'string' ? parsed.staffName : DEFAULTS.staffName,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * @param {string} userDataPath
 * @param {Partial<SyncConfig>} patch
 * @returns {SyncConfig}
 */
function saveConfig(userDataPath, patch) {
  const cur = loadConfig(userDataPath);
  const next = { ...cur };
  if (typeof patch.watchFolder === 'string') next.watchFolder = patch.watchFolder;
  if (typeof patch.baseUrl === 'string') next.baseUrl = patch.baseUrl.replace(/\/$/, '');
  if (typeof patch.apiKey === 'string') next.apiKey = patch.apiKey;
  if (typeof patch.openAtLogin === 'boolean') next.openAtLogin = patch.openAtLogin;
  if (typeof patch.terminalId === 'string') next.terminalId = patch.terminalId;
  if (typeof patch.staffName === 'string') next.staffName = patch.staffName;
  const p = configPath(userDataPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = { loadConfig, saveConfig, configPath, DEFAULTS };
