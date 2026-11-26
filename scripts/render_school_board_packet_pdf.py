#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

TITLE = "SCHOOL Board Packet"
SUBTITLE = "Current state, risks, and roadmap"
INPUT = Path(__file__).resolve().parents[1] / "docs" / "SCHOOL_BOARD_PACKET.md"
OUTPUT = Path(__file__).resolve().parents[1] / "docs" / "SCHOOL_BOARD_PACKET.pdf"


def esc(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return normalized.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def wrap(text: str, max_chars: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]
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
    return lines


def parse(md: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    for raw in md.splitlines():
        line = raw.rstrip()
        if not line.strip():
            blocks.append(("blank", ""))
        elif line.startswith("# "):
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


def pdf_obj(obj_id: int, body: str) -> bytes:
    return f"{obj_id} 0 obj\n{body}\nendobj\n".encode("latin-1")


def add_text(content: list[str], text: str, x: float, y: float, size: float, font: str = "F1", color=(0, 0, 0)):
    r, g, b = color
    content.append("BT")
    content.append(f"{r:.3f} {g:.3f} {b:.3f} rg")
    content.append(f"/{font} {size:.1f} Tf")
    content.append(f"1 0 0 1 {x:.2f} {y:.2f} Tm")
    content.append(f"({esc(text)}) Tj")
    content.append("ET")


def add_rect(content: list[str], x: float, y: float, w: float, h: float, color=(0, 0, 0), stroke=None, line_width=1.0):
    r, g, b = color
    content.append(f"{r:.3f} {g:.3f} {b:.3f} rg")
    if stroke is not None:
        sr, sg, sb = stroke
        content.append(f"{sr:.3f} {sg:.3f} {sb:.3f} RG")
        content.append(f"{line_width:.2f} w")
    content.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re")
    content.append("B" if stroke is not None else "f")


def build_cover_page() -> list[str]:
    lines: list[str] = ["q"]
    add_rect(lines, 0, 0, 612, 792, color=(0.03, 0.07, 0.13))
    add_rect(lines, 0, 748, 612, 44, color=(0.9, 0.72, 0.1))
    add_rect(lines, 54, 706, 110, 8, color=(0.9, 0.72, 0.1))
    add_text(lines, "SCHOOL", 54, 676, 30, font="F2", color=(1, 1, 1))
    add_text(lines, TITLE, 54, 632, 24, font="F2", color=(1, 1, 1))
    add_text(lines, SUBTITLE, 54, 604, 14, font="F1", color=(0.85, 0.89, 0.98))
    cover_bullets = [
        "Hardened web platform with Redis caching, AI throttling, and launch gates.",
        "Live mobile app with module, lesson, quiz, wallet, onboarding, and past papers flows.",
        "Canonical learner route model centered on /learn/ekrp211 and live content wiring.",
        "Operational readiness now depends on load evidence and device-grade validation.",
    ]
    y = 548
    for bullet in cover_bullets:
        add_rect(lines, 54, y - 2, 8, 8, color=(0.9, 0.72, 0.1))
        wrapped = wrap(bullet, 58)
        for i, part in enumerate(wrapped):
            add_text(lines, part, 70 if i == 0 else 78, y, 11.5, color=(0.95, 0.97, 1))
            y -= 16
        y -= 4
    add_rect(lines, 54, 156, 504, 1.2, color=(0.9, 0.72, 0.1))
    add_text(lines, "Prepared for internal review", 54, 134, 12, font="F2", color=(0.9, 0.72, 0.1))
    add_text(lines, "Current build state and roadmap packet", 54, 116, 10.5, color=(0.85, 0.89, 0.98))
    lines.append("Q")
    return lines


def section_header(lines: list[str], title: str, subtitle: str | None = None):
    add_rect(lines, 0, 748, 612, 44, color=(0.03, 0.07, 0.13))
    add_rect(lines, 0, 748, 18, 44, color=(0.9, 0.72, 0.1))
    add_text(lines, TITLE, 30, 760, 15, font="F2", color=(1, 1, 1))
    add_text(lines, title, 54, 718, 19, font="F2", color=(0.09, 0.14, 0.23))
    if subtitle:
        add_text(lines, subtitle, 54, 698, 10.8, color=(0.38, 0.43, 0.54))


def build_body_pages(blocks: list[tuple[str, str]]) -> list[list[str]]:
    pages: list[list[str]] = []
    current: list[str] = []
    y = 668
    current_section = "Overview"
    max_chars = 68

    def new_page(section: str | None = None):
        nonlocal current, y, current_section
        if current:
            pages.append(current)
        current = []
        y = 668
        if section:
            current_section = section

    def reserve(lines_needed: int):
        nonlocal y
        if y - (lines_needed * 16) < 60:
            new_page(current_section)

    for kind, text in blocks:
        if kind == "h1":
            new_page(text)
            section_header(current, text, "Board packet overview")
            continue
        if kind == "h2":
            reserve(3)
            add_rect(current, 54, y - 4, 504, 1.2, color=(0.9, 0.72, 0.1))
            y -= 16
            add_text(current, text, 54, y, 17, font="F2", color=(0.09, 0.14, 0.23))
            y -= 14
            continue
        if kind == "h3":
            reserve(2)
            add_text(current, text, 54, y, 12.5, font="F2", color=(0.12, 0.2, 0.32))
            y -= 14
            continue
        if kind == "rule":
            reserve(1)
            add_rect(current, 54, y - 2, 504, 0.8, color=(0.85, 0.87, 0.91))
            y -= 10
            continue
        if kind == "blank":
            y -= 8
            continue

        prefix = "• " if kind == "bullet" else "1. " if kind == "number" else "    " if kind == "quote" else ""
        wrapped = wrap(prefix + text, max_chars)
        reserve(len(wrapped) + 1)
        if kind == "bullet":
            add_rect(current, 54, y - 3, 5, 5, color=(0.9, 0.72, 0.1))
            x = 66
        elif kind == "number":
            x = 54
        else:
            x = 54
        for i, part in enumerate(wrapped):
            add_text(current, part, x, y, 11.2, color=(0.14, 0.18, 0.24))
            y -= 14
        y -= 3

    if current:
        pages.append(current)
    return pages


def build_pdf_stream(pages: list[list[str]], output: Path):
    page_width, page_height = 612, 792
    font_obj_id = 3 + len(pages) * 2
    font_bold_obj_id = font_obj_id + 1

    xref_objects: list[bytes] = [
        pdf_obj(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    ]

    page_kids = " ".join(f"{3 + i * 2} 0 R" for i in range(len(pages)))
    xref_objects.append(pdf_obj(2, f"<< /Type /Pages /Kids [{page_kids}] /Count {len(pages)} >>"))

    page_objects: list[bytes] = []
    content_objects: list[bytes] = []

    for idx, lines in enumerate(pages):
        page_obj_id = 3 + idx * 2
        content_obj_id = page_obj_id + 1
        content_bytes = "\n".join(lines).encode("latin-1")
        stream = b"<< /Length " + str(len(content_bytes)).encode("ascii") + b" >>\nstream\n" + content_bytes + b"\nendstream"
        content_objects.append(pdf_obj(content_obj_id, stream.decode("latin-1")))
        page_objects.append(
            pdf_obj(
                page_obj_id,
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
                f"/Resources << /Font << /F1 {font_obj_id} 0 R /F2 {font_bold_obj_id} 0 R >> >> "
                f"/Contents {content_obj_id} 0 R >>",
            )
        )

    font_regular = pdf_obj(font_obj_id, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font_bold = pdf_obj(font_bold_obj_id, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    xref_objects.extend(page_objects)
    xref_objects.extend(content_objects)
    xref_objects.extend([font_regular, font_bold])

    pdf = bytearray()
    pdf.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets: list[int] = [0]
    for obj in xref_objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_start = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n".encode("ascii"))
    output.write_bytes(pdf)


def main(argv: list[str]) -> int:
    input_path = Path(argv[1]) if len(argv) > 1 else INPUT
    output_path = Path(argv[2]) if len(argv) > 2 else OUTPUT
    if not input_path.exists():
        print(f"Missing source document: {input_path}", file=sys.stderr)
        return 1

    md = input_path.read_text(encoding="utf-8")
    blocks = parse(md)
    pages = [build_cover_page(), *build_body_pages(blocks)]
    build_pdf_stream(pages, output_path)
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
