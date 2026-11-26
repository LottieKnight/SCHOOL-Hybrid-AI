#!/usr/bin/env python3
from __future__ import annotations

import math
import re
import sys
import unicodedata
from pathlib import Path


TITLE = "SCHOOL Overview and Future Roadmap"
DEFAULT_INPUT = Path(__file__).resolve().parents[1] / "docs" / "SCHOOL_OVERVIEW_FUTURE.md"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "docs" / "SCHOOL_OVERVIEW_FUTURE.pdf"


def escape_pdf_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return normalized.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def wrap_text(text: str, max_chars: int) -> list[str]:
    if not text:
        return [""]
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def parse_markdown(md: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    for raw_line in md.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            blocks.append(("blank", ""))
            continue
        if line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        elif line.startswith("### "):
            blocks.append(("h3", line[4:].strip()))
        elif line.startswith("- "):
            blocks.append(("bullet", line[2:].strip()))
        elif re.match(r"^\d+\.\s+", line):
            blocks.append(("number", re.sub(r"^\d+\.\s+", "", line)))
        elif line.startswith("> "):
            blocks.append(("quote", line[2:].strip()))
        elif line.strip() == "---":
            blocks.append(("rule", ""))
        else:
            blocks.append(("p", line))
    return blocks


def build_pages(blocks: list[tuple[str, str]], page_width: float = 612, page_height: float = 792):
    margin_x = 54
    margin_top = 54
    margin_bottom = 54
    usable_width = page_width - margin_x * 2
    max_chars = int(usable_width / 5.2)

    pages: list[list[tuple[str, str, float]]] = []
    current: list[tuple[str, str, float]] = []
    y = page_height - margin_top

    def new_page():
        nonlocal current, y
        if current:
            pages.append(current)
        current = []
        y = page_height - margin_top

    def reserve(height: float):
        nonlocal y
        if y - height < margin_bottom:
            new_page()

    for kind, text in blocks:
        if kind == "blank":
            reserve(10)
            y -= 10
            continue

        if kind == "h1":
            reserve(34)
            current.append(("Helvetica-Bold", text, y))
            y -= 28
            continue

        if kind == "h2":
            reserve(24)
            current.append(("Helvetica-Bold", text, y))
            y -= 20
            continue

        if kind == "h3":
            reserve(20)
            current.append(("Helvetica-Bold", text, y))
            y -= 16
            continue

        if kind == "rule":
            reserve(12)
            current.append(("Helvetica", "-" * 42, y))
            y -= 12
            continue

        prefix = "• " if kind == "bullet" else "1. " if kind == "number" else "    " if kind == "quote" else ""
        wrapped = wrap_text(prefix + text, max_chars)
        height = 14 * len(wrapped)
        reserve(height + 6)
        for index, line in enumerate(wrapped):
            display = line if index == 0 else f"  {line}"
            current.append(("Helvetica", display, y))
            y -= 14
        y -= 4

    if current:
        pages.append(current)

    return pages


def pdf_object(obj_id: int, body: str) -> bytes:
    return f"{obj_id} 0 obj\n{body}\nendobj\n".encode("latin-1")


def make_pdf(pages: list[list[tuple[str, str, float]]], output: Path):
    page_width = 612
    page_height = 792

    objects: list[bytes] = []
    # 1: catalog, 2: pages tree
    objects.append(pdf_object(1, "<< /Type /Catalog /Pages 2 0 R >>"))

    page_kids = " ".join(f"{3 + i * 2} 0 R" for i in range(len(pages)))
    objects.append(pdf_object(2, f"<< /Type /Pages /Kids [{page_kids}] /Count {len(pages)} >>"))

    next_obj = 3
    page_objects: list[bytes] = []
    content_objects: list[bytes] = []
    font_obj_id = 3 + len(pages) * 2
    font_object = pdf_object(font_obj_id, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font_bold_obj_id = font_obj_id + 1
    font_bold_object = pdf_object(font_bold_obj_id, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    for page_index, lines in enumerate(pages):
        page_obj_id = next_obj
        content_obj_id = next_obj + 1
        next_obj += 2

        content = ["BT"]
        for font_name, text, y in lines:
            font_ref = "F2" if font_name == "Helvetica-Bold" else "F1"
            if font_name == "Helvetica-Bold" and text == TITLE and y > 700:
                size = 18
            elif font_name == "Helvetica-Bold":
                size = 13
            else:
                size = 10.5
            escaped = escape_pdf_text(text)
            content.append(f"/{font_ref} {size:.1f} Tf")
            content.append(f"1 0 0 1 54 {y:.2f} Tm")
            content.append(f"({escaped}) Tj")
        content.append("ET")
        content_bytes = "\n".join(content).encode("latin-1")
        stream = b"<< /Length " + str(len(content_bytes)).encode("ascii") + b" >>\nstream\n" + content_bytes + b"\nendstream"
        content_objects.append(pdf_object(content_obj_id, stream.decode("latin-1")))

        page_body = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
            f"/Resources << /Font << /F1 {font_obj_id} 0 R /F2 {font_bold_obj_id} 0 R >> >> "
            f"/Contents {content_obj_id} 0 R >>"
        )
        page_objects.append(pdf_object(page_obj_id, page_body))

    xref_objects = [objects[0], objects[1], *page_objects, *content_objects, font_object, font_bold_object]

    pdf = bytearray()
    pdf.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: list[int] = [0]
    for obj in xref_objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_start = len(pdf)
    count = len(offsets)
    pdf.extend(f"xref\n0 {count}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer << /Size {count} /Root 1 0 R >>\n"
            f"startxref\n{xref_start}\n%%EOF\n"
        ).encode("ascii")
    )

    output.write_bytes(pdf)


def main(argv: list[str]) -> int:
    input_path = Path(argv[1]) if len(argv) > 1 else DEFAULT_INPUT
    output_path = Path(argv[2]) if len(argv) > 2 else DEFAULT_OUTPUT
    if not input_path.exists():
        print(f"Missing source document: {input_path}", file=sys.stderr)
        return 1
    md = input_path.read_text(encoding="utf-8")
    blocks = parse_markdown(md)
    pages = build_pages(blocks)
    make_pdf(pages, output_path)
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
