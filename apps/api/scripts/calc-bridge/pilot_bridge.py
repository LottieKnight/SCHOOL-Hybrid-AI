#!/usr/bin/env python3
"""Bridge to school_pilot.py — launch pilot + delivery-KPI gate.

Reads JSON from stdin, emits JSON to stdout. Does not edit the calculator.
Call: {"source": 150, "pack": 0.4, "retail": 360, "ddp": 110,
       "lead_time_days": 9, "damage_rate": 0.01, ...}
"""
import json
import os
import sys

sys.path.insert(0, os.environ.get("SCHOOL_CALCULATORS_DIR", "/home/lottie"))
import school_pilot  # noqa: E402


def main() -> None:
    req = json.load(sys.stdin)
    source = float(req.get("source", school_pilot.DEFAULTS["source"]))
    pack = float(req.get("pack", school_pilot.DEFAULTS["pack"]))
    retail = float(req.get("retail", school_pilot.DEFAULTS["retail"]))
    ddp = float(req.get("ddp", school_pilot.DEFAULTS["ddp"]))
    packc = float(req.get("packc", school_pilot.DEFAULTS["pack_cost"]))
    units = float(req.get("units", school_pilot.DEFAULTS["units_mkt_mo"]))
    markets = int(req.get("markets", school_pilot.DEFAULTS["markets"]))
    fx = float(req.get("fx", 0.0))

    lp, landed, us, ud = school_pilot.landed_pct(
        source, pack, ddp + fx, packc, retail)
    gm = retail - landed
    units_mo = units * markets

    scorecard = []
    for k, (op, thr) in school_pilot.KPI_TARGETS.items():
        if k == "landed_cost_pct":
            v = lp
        elif req.get(k) is None:
            continue
        else:
            v = float(req[k])
        ok = (v < thr) if op == "<" else (v >= thr)
        scorecard.append({
            "kpi": k,
            "value": round(v, 4),
            "op": op,
            "target": thr,
            "pass": bool(ok),
        })

    json.dump({
        "landed_cost_pct": round(lp * 100, 1),
        "landed_cost": round(landed, 2),
        "source_cost": round(us, 2),
        "ddp_cost": round(ud, 2),
        "gross_margin": round(gm, 2),
        "gross_margin_pct": round(gm / retail * 100, 1),
        "monthly_units": round(units_mo),
        "monthly_revenue": round(units_mo * retail, 2),
        "monthly_margin": round(units_mo * gm, 2),
        "breakeven_units": round(landed / gm) if gm > 0 else None,
        "scorecard": scorecard,
        "source": "school_pilot.py",
    }, sys.stdout)


if __name__ == "__main__":
    main()
