#!/usr/bin/env python3
"""Bridge to school_dropship.py — R0 dropship/arbitrage cashflow math.

Reads JSON from stdin, emits JSON to stdout. Does not edit the calculator.
Call: {"retail": 349, "wholesale": 190, "courier": 55}
"""
import json
import os
import sys

sys.path.insert(0, os.environ.get("SCHOOL_CALCULATORS_DIR", "/home/lottie"))
import school_dropship  # noqa: E402


def main() -> None:
    req = json.load(sys.stdin)
    retail = float(req["retail"])
    wholesale = float(req["wholesale"])
    courier = float(req.get("courier", school_dropship.DEFAULTS["courier"]))
    gp = float(req.get("gateway_pct", school_dropship.DEFAULTS["gateway_pct"]))
    gf = float(req.get("gateway_fixed", school_dropship.DEFAULTS["gateway_fixed"]))
    orders_mo = int(req.get("orders_mo", school_dropship.DEFAULTS["orders_mo"]))
    gateway_days = int(req.get("gateway_days", school_dropship.DEFAULTS["gateway_days"]))

    gateway, out, margin = school_dropship.per_order(retail, wholesale, courier, gp, gf)
    monthly = margin * orders_mo
    daily_orders = orders_mo / 30.0
    needed_buffer = out * daily_orders * gateway_days

    json.dump({
        "retail": round(retail, 2),
        "wholesale": round(wholesale, 2),
        "courier": round(courier, 2),
        "gateway_pct": gp,
        "gateway_fixed": gf,
        "gateway_fee": round(gateway, 2),
        "outlay": round(out, 2),
        "margin": round(margin, 2),
        "margin_pct": round(margin / retail * 100, 1) if retail else 0.0,
        "monthly_profit": round(monthly, 2),
        "orders_mo": orders_mo,
        "buffer_need": round(needed_buffer, 2),
        "profitable": margin > 0,
        "source": "school_dropship.py",
    }, sys.stdout)


if __name__ == "__main__":
    main()
