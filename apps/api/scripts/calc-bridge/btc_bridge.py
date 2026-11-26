#!/usr/bin/env python3
"""Bridge to btc_multistream.py / btc_sa_stress.py — compute by-product economics.

Reads JSON from stdin, emits JSON to stdout. Does not edit the calculators.
Call: {"mode": "multistream", "rate": 0.75, "heat_price": 0.30, "grid_rate": 6, "green": true}
      {"mode": "stress", "btc_down": 0.40, "btc_down_severe": 0.70}
"""
import json
import os
import sys

sys.path.insert(0, os.environ.get("SCHOOL_CALCULATORS_DIR", "/home/lottie"))
import btc_multistream  # noqa: E402
import btc_sa_stress  # noqa: E402
import btc_mining_calculator as base  # noqa: E402


def multistream(req: dict) -> dict:
    rate = float(req.get("rate", 0.75))
    bagasse = bool(req.get("bagasse", True))
    usd = float(req.get("usd", base.DEFAULTS["usd_per_btc"]))
    m = btc_multistream.model(
        rate, bagasse, usd, float(req.get("fx", 18.5)),
        base.PRESETS["s21pro"]["price_usd"],
        heat_price=float(req.get("heat_price", 0.0)),
        grid_rate=float(req.get("grid_rate", 0.0)),
        green=bool(req.get("green", False)),
    )
    raw = m["streams"]["1_raw_BTC"]
    return {
        "mode": "multistream",
        "rate": rate,
        "bagasse": bagasse,
        "cap_zar": round(m["cap"], 2),
        "power_day": round(m["power_day"], 2),
        "btc_day": m["btc_day"],
        "raw_net": round(m["raw_net"], 2),
        "streams": {k: round(v, 2) for k, v in m["streams"].items()},
        "streams_pct": {k: round(v / raw * 100, 1) if raw else 0 for k, v in m["streams"].items()},
        "total_gross": round(m["total_gross"], 2),
        "net_after_power": round(m["net_after_power"], 2),
        "source": "btc_multistream.py",
    }


def stress(req: dict) -> dict:
    btc_down = float(req.get("btc_down", 0.40))
    btc_down_severe = float(req.get("btc_down_severe", 0.70))
    usd = float(req.get("usd", btc_sa_stress.BTC_BASE))
    price_usd = base.PRESETS["s21pro"]["price_usd"]
    btc_mild = usd * (1 - btc_down)
    btc_sev = usd * (1 - btc_down_severe)

    sites = []
    for site, cfg in btc_sa_stress.SITES.items():
        base_rate = cfg["rate"]
        crisis_rate = cfg["rate"] * cfg["crisis_rate_mult"]
        sb = btc_sa_stress.scenario_net(site, base_rate, cfg["uptime"], usd, btc_sa_stress.FX_BASE, price_usd)
        sm = btc_sa_stress.scenario_net(site, crisis_rate, cfg["uptime"], btc_mild, btc_sa_stress.FX_CRISIS, price_usd)
        ss = btc_sa_stress.scenario_net(site, crisis_rate, cfg["uptime"], btc_sev, btc_sa_stress.FX_CRISIS, price_usd)
        sites.append({
            "site": site,
            "uptime": cfg["uptime"],
            "base": _round(sb),
            "mild": _round(sm),
            "severe": _round(ss),
        })

    return {
        "mode": "stress",
        "btc_base": usd,
        "btc_mild": round(btc_mild, 2),
        "btc_severe": round(btc_sev, 2),
        "fx_base": btc_sa_stress.FX_BASE,
        "fx_crisis": btc_sa_stress.FX_CRISIS,
        "sites": sites,
        "source": "btc_sa_stress.py",
    }


def _round(r: dict) -> dict:
    return {
        "net": round(r["net"], 2),
        "mo": round(r["mo"], 2),
        "payback_mo": round(r["payback"], 1) if r["payback"] != float("inf") else None,
        "cap_zar": round(r["cap_zar"], 2),
        "five_yr": round(r["5yr"], 2),
    }


def main() -> None:
    req = json.load(sys.stdin)
    mode = req.get("mode", "multistream")
    out = multistream(req) if mode == "multistream" else stress(req)
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
