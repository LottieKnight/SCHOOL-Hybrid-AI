from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
import sys

from pypdf import PdfReader


def guess_label(text: str) -> str:
    lowered = text.lower()
    hits = []
    if "foundation" in lowered:
        hits.append("foundation")
    if "intermediate" in lowered:
        hits.append("intermediate")
    if "senior" in lowered:
        hits.append("senior")
    if len(hits) == 1:
        return hits[0]
    return "other"


def extract_links(pdf_path: Path):
    reader = PdfReader(str(pdf_path))
    links = []
    for page_index, page in enumerate(reader.pages):
        page_text = ""
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""

        annots = page.get("/Annots", [])
        for annot_ref in annots:
            try:
                annot = annot_ref.get_object()
            except Exception:
                continue
            if annot.get("/Subtype") != "/Link":
                continue
            action = annot.get("/A")
            if not action:
                continue
            uri = action.get("/URI")
            if not uri:
                continue
            url = str(uri)
            context = ""
            if page_text:
                # Try to find a nearby line containing the URL; fallback to a snippet.
                match = None
                for line in page_text.splitlines():
                    if url in line:
                        match = line.strip()
                        break
                if match:
                    context = match[:240]
                else:
                    context = page_text.strip().replace("\n", " ")[:240]

            label = guess_label(f"{context} {url}")
            links.append(
                {
                    "label_guess": label,
                    "url": url,
                    "context": context,
                    "page": page_index + 1,
                }
            )
    return links


def main():
    repo_root = Path(__file__).resolve().parents[2]
    default_pdf = Path(r"C:\Users\molot\Desktop\DBE scraping\LRIP & MIP Digital Resources Poster (8).pdf")
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_pdf

    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}")
        sys.exit(1)

    links = extract_links(pdf_path)

    out_dir = repo_root / "content" / "sources"
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "gde_lrip_mip_links.json"

    # Deduplicate by URL
    unique_links = []
    seen = set()
    for link in links:
        url = link["url"]
        if url in seen:
            continue
        seen.add(url)
        unique_links.append(link)

    payload = {
        "source": "GDE LRIP & MIP Digital Resources Poster",
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "links": [
            {"label_guess": l["label_guess"], "url": l["url"], "context": l["context"]}
            for l in unique_links
        ],
    }

    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Wrote manifest: {manifest_path}")
    print("Extracted links:")
    for link in payload["links"]:
        print(f"- [{link['label_guess']}] {link['url']}")


if __name__ == "__main__":
    main()
