#!/usr/bin/env python3
"""Bridge to school_analytics.py — Pareto / SKU-cull decisions.

Reads JSON from stdin, emits JSON to stdout. Does not edit the calculator.
Call: {"rows": [{"sku": "x", "units_sold": 10, "revenue": 1000, "returns": 1}]}
"""
import json
import os
import sys

sys.path.insert(0, os.environ.get("SCHOOL_CALCULATORS_DIR", "/home/lottie"))
import school_analytics  # noqa: E402


def main() -> None:
    req = json.load(sys.stdin)
    rows = [
        (
            r["sku"],
            float(r.get("units_sold", 0)),
            float(r.get("revenue", 0)),
            float(r.get("returns", 0)),
        )
        for r in req.get("rows", [])
    ]
    if not rows:
        rows = school_analytics.DEMO

    data, total_rev, total_units, pareto_pct, n_top, cap_n = school_analytics.analyze(rows)

    keeps = [d for d in data if d["decision"].startswith("KEEP")]
    watch = [d for d in data if d["decision"].startswith("WATCH")]
    culls = [d for d in data if d["decision"].startswith("CULL")]
    core_units = [d["units"] for d in keeps] or [0]
    core_median = sorted(core_units)[len(core_units) // 2]
    stretch = [d["sku"] for d in watch if d["units"] >= 0.5 * core_median]

    json.dump({
        "skus": [{
            "sku": d["sku"],
            "units": d["units"],
            "rev": round(d["rev"], 2),
            "ret": d["ret"],
            "net_units": d["net_units"],
            "ret_rate": round(d["ret_rate"] * 100, 1),
            "cum_pct": round(d["cum_pct"] * 100, 1),
            "decision": d["decision"],
        } for d in data],
        "total_revenue": round(total_rev, 2),
        "total_units": round(total_units),
        "pareto_pct": round(pareto_pct * 100, 1),
        "n_top": n_top,
        "cap_n": cap_n,
        "keeps": len(keeps),
        "watch": len(watch),
        "culls": len(culls),
        "stretch_signal": stretch,
        "source": "school_analytics.py",
    }, sys.stdout)


if __name__ == "__main__":
    main()
