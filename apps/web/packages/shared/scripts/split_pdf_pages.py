import sys
from pathlib import Path

try:
    from PyPDF2 import PdfReader, PdfWriter
except Exception as exc:
    sys.stderr.write(f"PyPDF2 import failed: {exc}\n")
    sys.exit(2)


def main():
    if len(sys.argv) != 5:
        sys.stderr.write("Usage: split_pdf_pages.py <input> <output> <start_page> <end_page>\n")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    start_page = int(sys.argv[3])
    end_page = int(sys.argv[4])

    if not input_path.exists():
        sys.stderr.write(f"Input not found: {input_path}\n")
        sys.exit(1)

    reader = PdfReader(str(input_path))
    writer = PdfWriter()
    total_pages = len(reader.pages)
    start_index = max(0, start_page - 1)
    end_index = min(total_pages - 1, end_page - 1)
    if start_index > end_index:
        sys.stderr.write("Invalid page range\n")
        sys.exit(1)

    for i in range(start_index, end_index + 1):
        writer.add_page(reader.pages[i])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as handle:
        writer.write(handle)


if __name__ == "__main__":
    main()
