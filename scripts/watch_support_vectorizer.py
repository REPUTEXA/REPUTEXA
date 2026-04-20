#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Surveille le dépôt (watchdog) et relance le vectorizer support après chaque série de modifications.

  pip install -r scripts/requirements-watchdog.txt
  python scripts/watch_support_vectorizer.py

Variables optionnelles :
  SUPPORT_KB_DEBOUNCE   secondes après la dernière modification (défaut : 4)
  SUPPORT_KB_ROOT       chemin racine du repo (défaut : parent de ce script / ..)
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except ImportError:
    print("Installez watchdog : pip install -r scripts/requirements-watchdog.txt", file=sys.stderr)
    sys.exit(1)

DEBOUNCE_S = float(os.environ.get("SUPPORT_KB_DEBOUNCE", "4"))

_SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = Path(os.environ.get("SUPPORT_KB_ROOT", str(_SCRIPT_DIR.parent))).resolve()

SKIP_DIR_NAMES = {
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    "out",
    "htmlcov",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    ".turbo",
    ".vercel",
    ".cursor",
}

TEXT_SUFFIX = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".md",
    ".mdx",
    ".json",
    ".sql",
    ".yml",
    ".yaml",
    ".py",
    ".css",
    ".scss",
    ".html",
    ".toml",
    ".rs",
    ".go",
    ".sh",
    ".prisma",
}

SKIP_FILES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    ".DS_Store",
}


def _under_repo(path: Path) -> bool:
    try:
        path.resolve().relative_to(REPO_ROOT)
        return True
    except ValueError:
        return False


def should_ignore(path: str) -> bool:
    p = Path(path).resolve()
    if not _under_repo(p):
        return True
    rel = p.relative_to(REPO_ROOT)
    for part in rel.parts:
        if part in SKIP_DIR_NAMES:
            return True
    name = p.name
    if name in SKIP_FILES:
        return True
    if name.startswith(".env") and name not in (".env.example", ".env.sample"):
        return True
    if p.suffix.lower() not in TEXT_SUFFIX:
        return True
    return False


_scheduler_lock = threading.Lock()
_timer: Optional[threading.Timer] = None
_runner_lock = threading.Lock()
_pending_again = False


def _run_vectorizer() -> None:
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    cmd = [npm_cmd, "run", "support:index-codebase"]
    print(f"[support-kb-watch] Lancement ({DEBOUNCE_S}s après dernière activité) :", " ".join(cmd))
    print(f"[support-kb-watch] cwd={REPO_ROOT}")
    start = time.monotonic()
    proc = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT),
        shell=False,
        env={**os.environ},
    )
    elapsed = time.monotonic() - start
    if proc.returncode != 0:
        print(f"[support-kb-watch] Échec (code {proc.returncode}) après {elapsed:.1f}s", file=sys.stderr)
    else:
        print(f"[support-kb-watch] OK en {elapsed:.1f}s")


def _debounced_fire() -> None:
    """Relance indexation ; si une indexation est déjà en cours, enfile un second passage."""
    global _pending_again
    if not _runner_lock.acquire(blocking=False):
        _pending_again = True
        print("[support-kb-watch] Indexation déjà en cours — nouveau passage en file d'attente.")
        return
    try:
        _run_vectorizer()
    finally:
        run_again = _pending_again
        _pending_again = False
        _runner_lock.release()
        if run_again:
            threading.Timer(1.0, _debounced_fire).start()


def schedule_reindex() -> None:
    global _timer
    with _scheduler_lock:
        if _timer is not None:
            _timer.cancel()
        _timer = threading.Timer(DEBOUNCE_S, _fire_timer)
        _timer.daemon = True
        _timer.start()


def _fire_timer() -> None:
    global _timer
    with _scheduler_lock:
        _timer = None
    threading.Thread(target=_debounced_fire, daemon=True).start()


class _Handler(FileSystemEventHandler):
    def on_created(self, event):  # type: ignore[override]
        self._handle(event)

    def on_modified(self, event):  # type: ignore[override]
        self._handle(event)

    def on_moved(self, event):  # type: ignore[override]
        if getattr(event, "dest_path", None) and not event.is_directory:
            self._handle_path(event.dest_path)

    def _handle(self, event) -> None:
        if event.is_directory:
            return
        self._handle_path(event.src_path)

    def _handle_path(self, src_path: str) -> None:
        if should_ignore(src_path):
            return
        print(f"[support-kb-watch] Changement : {src_path}")
        schedule_reindex()


def main() -> None:
    if not REPO_ROOT.is_dir():
        print(f"Racine invalide : {REPO_ROOT}", file=sys.stderr)
        sys.exit(1)

    print(f"[support-kb-watch] Racine : {REPO_ROOT}")
    print(f"[support-kb-watch] Debounce : {DEBOUNCE_S}s — Ctrl+C pour quitter")

    observer = Observer()
    handler = _Handler()
    observer.schedule(handler, str(REPO_ROOT), recursive=True)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
