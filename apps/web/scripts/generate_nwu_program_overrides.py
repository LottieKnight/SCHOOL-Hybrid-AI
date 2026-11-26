from __future__ import annotations

import json
from pathlib import Path

from pypdf import PdfReader

from generate_nwu_catalog import (
    UG_FILES,
    build_section_candidates,
    clean_text,
    normalize_faculty_name,
    normalize_program_name,
    parse_meta_from_text,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_PATH = REPO_ROOT / "apps" / "web" / "lib" / "generated" / "nwuProgramOverrides.generated.json"

QUAL_PREFIXES = (
    "Bachelor",
    "Diploma",
    "Higher Certificate",
    "Advanced Diploma",
    "Certificate",
    "LLB",
    "BEd",
    "BEng",
    "BSc",
    "BCom",
    "BAdmin",
    "BHRD",
)


def normalize_name(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = normalize_program_name(clean_text(value)).rstrip("/").strip()
    return cleaned or None


def is_qualification_name(value: str | None) -> bool:
    if not value:
        return False
    return value.startswith(QUAL_PREFIXES)


def build_entry_score(entry: dict[str, object]) -> tuple[int, int, int]:
    qualification_name = str(entry.get("qualificationName") or "")
    qualification_code = str(entry.get("qualificationCode") or "")
    campuses = entry.get("campuses") if isinstance(entry.get("campuses"), list) else []
    return (
        1 if is_qualification_name(qualification_name) else 0,
        1 if qualification_code else 0,
        len(campuses),
    )


def collect_overrides(path: Path) -> list[dict[str, object]]:
    reader = PdfReader(str(path))
    texts = [(page.extract_text() or "") for page in reader.pages]
    sections = build_section_candidates(path, reader)
    faculty = normalize_faculty_name(path.parent.name)
    overrides: list[dict[str, object]] = []

    for index, section in enumerate(sections):
        start_page = section.start_page
        end_page = sections[index + 1].start_page - 1 if index + 1 < len(sections) else len(texts)
        span_text = "\n".join(texts[start_page - 1 : min(end_page, start_page + 4)])
        meta = parse_meta_from_text(span_text, faculty)

        programme_title = normalize_name(section.title)
        qualification_name = normalize_name(meta.get("name"))  # type: ignore[arg-type]
        qualification_code = normalize_name(meta.get("qualification_code"))  # type: ignore[arg-type]
        campuses = meta.get("campuses") if isinstance(meta.get("campuses"), list) else []

        if not programme_title:
            continue
        if not qualification_name and not qualification_code and not campuses:
            continue

        overrides.append(
            {
                "faculty": faculty,
                "programmeTitle": programme_title,
                "qualificationName": qualification_name,
                "qualificationCode": qualification_code,
                "campuses": campuses,
                "sourceDocument": str(path),
                "sourcePage": start_page,
            }
        )

    deduped: dict[tuple[str, str], dict[str, object]] = {}
    for entry in overrides:
        key = (str(entry["faculty"]), str(entry["programmeTitle"]).lower())
        current = deduped.get(key)
        if not current or build_entry_score(entry) > build_entry_score(current):
            deduped[key] = entry

    return sorted(deduped.values(), key=lambda item: (str(item["faculty"]), str(item["programmeTitle"])))


def main() -> None:
    payload: list[dict[str, object]] = []
    for pdf_path in UG_FILES:
        if not pdf_path.exists():
            print(f"SKIP missing {pdf_path}")
            continue
        print(f"Extracting overrides from {pdf_path.name}...", flush=True)
        payload.extend(collect_overrides(pdf_path))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(payload)} overrides to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
