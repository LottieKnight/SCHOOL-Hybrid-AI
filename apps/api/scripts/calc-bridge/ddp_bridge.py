#!/usr/bin/env python3
"""Bridge to school_ddp.py — borderless DDP landed-cost math.

Reads JSON from stdin, emits JSON to stdout. Does not edit the calculator.
Call: {"source": 150, "pack": 0.4, "retail": 360, "packc": 18}
"""
import json
import os
import sys

sys.path.insert(0, os.environ.get("SCHOOL_CALCULATORS_DIR", "/home/lottie"))
import school_ddp  # noqa: E402


def main() -> None:
    req = json.load(sys.stdin)
    source = float(req["source"])
    pack = float(req.get("pack", 0.40))
    retail = float(req["retail"])
    packc = float(req.get("packc", 18.0))

    markets = []
    worst = None
    for name, cfg in school_ddp.MARKETS.items():
        r = school_ddp.market_landed(
            source, pack, cfg["freight"], cfg["duty"], cfg["lastmile"],
            retail, packc, cfg["fx_surcharge"],
        )
        loss_lane = r["margin"] <= 0
        if worst is None or r["landed"] > worst["landed"]:
            worst = {"market": name, "landed": r["landed"]}
        markets.append({
            "market": name,
            "landed": round(r["landed"], 2),
            "source": round(r["source"], 2),
            "freight": round(r["freight"], 2),
            "duty": round(r["duty"], 2),
            "lastmile": round(r["lastmile"], 2),
            "margin": round(r["margin"], 2),
            "pct": round(r["pct"] * 100, 1),
            "loss_lane": loss_lane,
        })

    json.dump({
        "markets": markets,
        "worst_lane": worst,
        "source": "school_ddp.py",
    }, sys.stdout)


if __name__ == "__main__":
    main()
