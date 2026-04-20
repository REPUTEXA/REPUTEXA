'use strict';

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const crypto = require('crypto');
const { parseTicketContent } = require('./parse-ticket');
const { sendTicketToCloud } = require('./api');

/**
 * @param {object} opts
 * @param {string} opts.userDataPath
 * @param {() => { watchFolder: string; baseUrl: string; apiKey: string }} opts.getConfig
 * @param {(status: 'ok' | 'error') => void} opts.onCloudStatus
 * @param {(msg: string) => void} opts.log
 */
function startTicketWatcher(opts) {
  let watcher = /** @type {import('chokidar').FSWatcher | null} */ (null);

  function processedStorePath() {
    return path.join(opts.userDataPath, 'processed-hashes.json');
  }

  function loadHashes() {
    try {
      const raw = fs.readFileSync(processedStorePath(), 'utf8');
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.filter((x) => typeof x === 'string'));
    } catch {
      return new Set();
    }
  }

  function saveHashes(set) {
    const arr = [...set].slice(-8000);
    fs.mkdirSync(opts.userDataPath, { recursive: true });
    fs.writeFileSync(processedStorePath(), JSON.stringify(arr), 'utf8');
  }

  const processed = loadHashes();

  async function handleFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.txt' && ext !== '.json') return;

    let st;
    try {
      st = fs.statSync(filePath);
    } catch {
      return;
    }
    if (!st.isFile()) return;

    let buf;
    try {
      buf = fs.readFileSync(filePath);
    } catch {
      return;
    }

    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    if (processed.has(hash)) return;

    const cfg = opts.getConfig();
    if (!cfg.watchFolder || !cfg.apiKey || !cfg.baseUrl) {
      opts.log('Config incomplète (dossier, URL ou clé).');
      opts.onCloudStatus('error');
      return;
    }

    const rel = path.relative(cfg.watchFolder, filePath);
    const content = buf.toString('utf8');
    const parsed = parseTicketContent(content, ext, st.mtimeMs);
    if (!parsed) {
      opts.log(`Ticket ignoré (parse) : ${filePath}`);
      return;
    }

    const source = rel.split(path.sep).join('/') || path.basename(filePath);
    const ticketFileName = path.basename(filePath);
    const rawSlice = content.length > 115_000 ? content.slice(0, 115_000) : content;
    const result = await sendTicketToCloud({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      amount: parsed.amount,
      timestamp: parsed.timestamp,
      source,
      rawData: rawSlice,
      ticketFileName,
      terminalId: cfg.terminalId,
      staffName: cfg.staffName,
    });

    if (!result.ok) {
      opts.onCloudStatus('error');
      opts.log(`Erreur API ${result.status} : ${filePath}`);
      return;
    }

    processed.add(hash);
    saveHashes(processed);
    opts.onCloudStatus('ok');
    const ref = result.ticketRef || ticketFileName.replace(/\.[^.]+$/, '');
    opts.log(`Ticket #${ref} traité avec succès`);
  }

  function restart() {
    if (watcher) {
      void watcher.close();
      watcher = null;
    }
    const cfg = opts.getConfig();
    if (!cfg.watchFolder || !fs.existsSync(cfg.watchFolder)) {
      opts.log('Dossier de surveillance absent ou vide.');
      return;
    }

    watcher = chokidar.watch(['**/*.txt', '**/*.json'], {
      cwd: cfg.watchFolder,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
      ignored: (p) => path.basename(p).startsWith('.'),
    });

    watcher.on('add', (p) => void handleFile(path.join(cfg.watchFolder, p)));
    watcher.on('change', (p) => void handleFile(path.join(cfg.watchFolder, p)));
    opts.log(`Surveillance : ${cfg.watchFolder}`);
  }

  /**
   * Traite tous les fichiers déjà présents (hors hash connus).
   */
  async function scanAll() {
    const cfg = opts.getConfig();
    if (!cfg.watchFolder || !fs.existsSync(cfg.watchFolder)) return;

    const { readdirSync, statSync } = fs;

    function walk(dir) {
      /** @type {string[]} */
      const out = [];
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return out;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name.startsWith('.')) continue;
          out.push(...walk(full));
        } else {
          const le = path.extname(e.name).toLowerCase();
          if (le === '.txt' || le === '.json') out.push(full);
        }
      }
      return out;
    }

    const files = walk(cfg.watchFolder);
    for (const f of files) {
      await handleFile(f);
    }
  }

  return { restart, scanAll };
}

module.exports = { startTicketWatcher };
