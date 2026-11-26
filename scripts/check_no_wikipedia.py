#!/usr/bin/env python3
"""
scripts/check_no_wikipedia.py — CI gate enforcing the "NO Wikipedia / academic-only"
rule for all lesson + module content.

Fails (exit 1) if ANY reference URL contains 'wikipedia' or 'wiki' in a way that
indicates a Wikimedia source. Also fails if a file claims academicReferenceOnly /
wikipediaExcluded but still contains a wiki link (inconsistency guard).

Run:  python3 scripts/check_no_wikipedia.py [--root <dir>]
"""
import json
import glob
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WIKI_MARKERS = ("wikipedia.org", "wiki/", "/wiki/", "wikimedia", "wiki.com", "wikipedia.")


def scan_file(path):
    hits = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return hits
    refs = data.get("referenceList") or []
    for r in refs:
        url = (r.get("url") or "").lower()
        title = (r.get("title") or "").lower()
        for m in WIKI_MARKERS:
            if m in url or m in title:
                hits.append((path, r.get("title", "?"), r.get("url", "?")))
                break
    return hits


def main():
    root = REPO
    if "--root" in sys.argv:
        root = sys.argv[sys.argv.index("--root") + 1]
    patterns = [
        os.path.join(root, "apps/web/content/modules-generated/*.json"),
        os.path.join(root, "content/lessons/**/lesson.json"),
        os.path.join(root, "**/lesson.json"),
    ]
    files = set()
    for p in patterns:
        for f in glob.glob(p, recursive=True):
            files.add(f)
    # also scan the school curriculum outline
    files.add(os.path.join(root, "school/curriculum/grade12/english.json"))

    all_hits = []
    for f in sorted(files):
        all_hits += scan_file(f)

    if all_hits:
        print(f"FAIL: {len(all_hits)} Wikipedia reference(s) found:")
        for path, title, url in all_hits:
            print(f"  - {title} | {url}\n    in {path}")
        sys.exit(1)
    print(f"PASS: 0 Wikipedia references across {len(files)} content files.")


if __name__ == "__main__":
    main()
