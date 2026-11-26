#!/usr/bin/env python3
"""Bridge to school_local.py — local breakeven math.

Reads JSON from stdin, emits JSON to stdout. Does not edit the calculator.
Call: {"fixed": 20000}
"""
import json
import os
import sys

sys.path.insert(0, os.environ.get("SCHOOL_CALCULATORS_DIR", "/home/lottie"))
import school_local  # noqa: E402


def main() -> None:
    req = json.load(sys.stdin)
    fixed = float(req.get("fixed", 20000.0))

    total_mix = sum(p["mix"] for p in school_local.PRODUCTS.values())
    products = []
    weighted_contrib = 0.0
    for name, p in school_local.PRODUCTS.items():
        landed, contrib, gm = school_local.product_metrics(p)
        share = p["mix"] / total_mix
        weighted_contrib += contrib * share
        products.append({
            "name": name,
            "source": round(p["source"], 2),
            "pack": round(p["pack"], 2),
            "courier": round(p["courier"], 2),
            "landed": round(landed, 2),
            "retail": round(p["retail"], 2),
            "contrib": round(contrib, 2),
            "gm_pct": round(gm * 100, 1),
            "mix_pct": round(share * 100, 1),
        })

    be_units = fixed / weighted_contrib if weighted_contrib else 0.0
    split = [
        {"name": p["name"], "units_mo": round(be_units * p["mix_pct"] / 100)}
        for p in products
    ]

    json.dump({
        "fixed": fixed,
        "products": products,
        "blended_contrib": round(weighted_contrib, 2),
        "breakeven_units": round(be_units),
        "per_product_split": split,
        "source": "school_local.py",
    }, sys.stdout)


if __name__ == "__main__":
    main()
