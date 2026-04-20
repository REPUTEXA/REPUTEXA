#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Merge PublicPages.privacyRoute into messages/{fr,en,es,de,it,pt,ja,zh}.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from privacy_bundle.de import PRIVACY_ROUTE as de  # noqa: E402
from privacy_bundle.en import PRIVACY_ROUTE as en  # noqa: E402
from privacy_bundle.es import PRIVACY_ROUTE as es  # noqa: E402
from privacy_bundle.fr import PRIVACY_ROUTE as fr  # noqa: E402
from privacy_bundle.it import PRIVACY_ROUTE as it  # noqa: E402
from privacy_bundle.ja import PRIVACY_ROUTE as ja  # noqa: E402
from privacy_bundle.pt import PRIVACY_ROUTE as pt  # noqa: E402
from privacy_bundle.zh import PRIVACY_ROUTE as zh  # noqa: E402

BUNDLE = {
    "fr": fr,
    "en": en,
    "es": es,
    "de": de,
    "it": it,
    "pt": pt,
    "ja": ja,
    "zh": zh,
}


def _assert_key_parity() -> None:
    keys = None
    for loc, d in BUNDLE.items():
        ks = set(d.keys())
        if keys is None:
            keys = ks
        elif ks != keys:
            missing = keys - ks
            extra = ks - keys
            raise SystemExit(f"Key mismatch for {loc}: missing {missing!r} extra {extra!r}")


def main() -> None:
    _assert_key_parity()
    for loc, privacy_route in BUNDLE.items():
        p = ROOT / "messages" / f"{loc}.json"
        data = json.loads(p.read_text(encoding="utf-8"))
        data.setdefault("PublicPages", {})["privacyRoute"] = privacy_route
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("Updated", p.relative_to(ROOT))


if __name__ == "__main__":
    main()
