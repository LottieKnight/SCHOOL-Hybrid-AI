import json
import os
import re
import sys
from datetime import datetime

try:
    from PyPDF2 import PdfReader
except ImportError:
    print("PyPDF2 is required. Install with: pip install PyPDF2", file=sys.stderr)
    sys.exit(1)


def label_hint_from_text(text: str) -> str:
    lowered = text.lower()
    if "foundation" in lowered:
        return "foundation"
    if "intermediate" in lowered:
        return "intermediate"
    if "senior" in lowered:
        return "senior"
    return "unknown"


def extract_links(pdf_path: str):
    reader = PdfReader(pdf_path)
    links = []
    for i, page in enumerate(reader.pages):
        page_text = ""
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""
        label_hint = label_hint_from_text(page_text)
        annots = page.get("/Annots") or []
        for annot in annots:
            try:
                obj = annot.get_object()
            except Exception:
                continue
            action = obj.get("/A")
            if action and hasattr(action, "get_object"):
                try:
                    action = action.get_object()
                except Exception:
                    action = None
            if not isinstance(action, dict):
                action = {}
            uri = action.get("/URI")
            if uri:
                links.append(
                    {
                        "url": uri,
                        "page": i + 1,
                        "label_hint": label_hint,
                    }
                )
        # Fallback: extract URLs from text if no annotations were found
        if not annots and page_text:
            for match in re.findall(r"https?://[^\s)>\"]+", page_text):
                links.append(
                    {
                        "url": match,
                        "page": i + 1,
                        "label_hint": label_hint,
                    }
                )
    return links


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf_links.py <pdf_path>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    links = extract_links(pdf_path)
    if not links:
        print("No links found in PDF.", file=sys.stderr)
        sys.exit(1)

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    report_root = os.path.join(repo_root, "content", "gde_lrip_mip_reports")
    os.makedirs(report_root, exist_ok=True)

    manifest = {
        "source_pdf": pdf_path,
        "extracted_at": datetime.utcnow().isoformat() + "Z",
        "links": links,
    }

    manifest_path = os.path.join(report_root, "links_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    links_path = os.path.join(report_root, "links.txt")
    with open(links_path, "w", encoding="utf-8") as f:
        for link in links:
            f.write(link["url"] + "\n")

    print(f"Extracted {len(links)} links.")
    print(f"Manifest: {manifest_path}")
    print(f"Links list: {links_path}")


if __name__ == "__main__":
    main()
