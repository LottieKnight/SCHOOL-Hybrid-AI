from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import pdfplumber
from pypdf import PdfReader


REPO_ROOT = Path(__file__).resolve().parents[3]
PDF_ROOT = REPO_ROOT.parents[2] / "downloads" / "nwu-yearbooks-2026-main-page"
OUTPUT_PATH = REPO_ROOT / "apps" / "web" / "lib" / "generated" / "nwuAcademicCatalog.generated.json"

UG_FILES = [
    PDF_ROOT / "Economic and Management Sciences" / "15-FEMS-UG-2026-003.pdf",
    PDF_ROOT / "Education" / "14 FEDU_ACT_Yearbook 2026 (v2).pdf",
    PDF_ROOT / "Education" / "14 FEDU_ADE_Yearbook 2026 (v2).pdf",
    PDF_ROOT / "Education" / "14 FEDU_BEd New_Yearbook 2026 (v2).pdf",
    PDF_ROOT / "Education" / "14 FEDU_UG DIPL (GR R)_ 2026 (v2).pdf",
    PDF_ROOT / "Engineering" / "17-FENG-UG-2026.pdf",
    PDF_ROOT / "Health Sciences" / "18 FHS_UG_2026.pdf",
    PDF_ROOT / "Humanities" / "11 2026 FHUM UG.pdf",
    PDF_ROOT / "Law" / "FLAW UG_2026_Final.pdf",
    PDF_ROOT / "Natural Sciences" / "12 2026 FNAS UG.pdf",
    PDF_ROOT / "Theology" / "13-Faculty-Theology-2026-March1.pdf",
]

# Postgraduate yearbook PDFs — download from https://www.nwu.ac.za/yearbooks
# Add each faculty PDF once downloaded. Files that don't exist are skipped gracefully.
PG_FILES = [
    PDF_ROOT / "Economic and Management Sciences" / "15-FEMS-PG-2026.pdf",
    PDF_ROOT / "Education" / "14-FEDU-PG-2026.pdf",
    PDF_ROOT / "Engineering" / "17-FENG-PG-2026.pdf",
    PDF_ROOT / "Health Sciences" / "18-FHS-PG-2026.pdf",
    PDF_ROOT / "Humanities" / "11-FHUM-PG-2026.pdf",
    PDF_ROOT / "Law" / "FLAW-PG-2026.pdf",
    PDF_ROOT / "Natural Sciences" / "12-FNAS-PG-2026.pdf",
    PDF_ROOT / "Theology" / "13-FTHEOL-PG-2026.pdf",
]

MODULE_DURATION_PATTERNS = [
    "Year module",
    "Semester 1 and 2",
    "Semester 1 & 2",
    "Semester 1",
    "Semester 2",
    "First semester",
    "Second semester",
]

CODE_PATTERN = re.compile(r"\b[A-Z]{3,6}(?:/[A-Z]{1,3})?\d{3}[A-Z]?\b")
CODE_WITH_CAMPUS_PATTERN = re.compile(r"\b([A-Z]{3,6}(?:/[A-Z]{1,3})?\d{3}[A-Z]?)(?:\s*\([A-Z/]+\))?\b")
QUALIFICATION_CODE_PATTERN = re.compile(r"\b\d[A-Z]{1,4}-[A-Z]\d{2}-[A-Z]\d{3}[A-Z/]*(?:-[A-Z]{2,3})?\b", re.I)
YEAR_LEVEL_PATTERN = re.compile(r"year level\s*(\d+)", re.I)
YEAR_ROW_PATTERN = re.compile(r"^(first|second|third|fourth|fifth|sixth)\s+year$", re.I)
YEAR_WORDS = {
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
    "fifth": 5,
    "sixth": 6,
}
SEMESTER_PATTERN = re.compile(r"(first|second)\s+semester|semester\s*(1|2)", re.I)
PROGRAM_TITLE_PATTERN = re.compile(
    r"\b(bachelor|diploma|certificate|llb|beng|bsc|bcom|badmin|bhrd|ba(?:\s|$)|bed(?:\s|$)|pgce"
    r"|honours|hons|master(?:s)?(?:\s+of)?|msc|mcom|mba|meng|med(?:\s|$)"
    r"|doctor(?:al)?(?:\s+of)?|phd|dphil|dcom|dlit|dsc"
    r"|postgraduate\s+diploma|pg\s*dip)\b",
    re.I,
)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:120]


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ")
    value = value.replace("–", "-").replace("—", "-")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def looks_like_heading(value: str) -> bool:
    lowered = clean_text(value).lower()
    return any(
        marker in lowered
        for marker in [
            "qualification name",
            "kwalifikasienaam",
            "qualification code",
            "kwalifikasiekode",
            "campus",
            "kampus",
            "delivery mode",
            "metode van aflewering",
            "year level",
            "jaarvlak",
            "module code",
            "modulekode",
        ]
    )


def normalize_program_name(value: str) -> str:
    value = clean_text(value)
    value = re.sub(r"^[A-Z]{2,5}\.\d+(?:\.\d+)?\s+", "", value)
    value = value.split(" / ", 1)[0].strip()
    if value.isupper():
        value = value.title()
        replacements = {
            "Bcom": "BCom",
            "Ba ": "BA ",
            "Bed ": "BEd ",
            "Beng": "BEng",
            "Bsc": "BSc",
            "Llb": "LLB",
            "Pgce": "PGCE",
            "Nwu": "NWU",
            "Fet": "FET",
        }
        for source, target in replacements.items():
            value = value.replace(source, target)
    replacements = {
        "Beng": "BEng",
        "Bsc": "BSc",
        "Bcom": "BCom",
        "Bed": "BEd",
        "Badmin": "BAdmin",
        "Bhrd": "BHRD",
        "Llb": "LLB",
        "Pgce": "PGCE",
    }
    for source, target in replacements.items():
        value = re.sub(rf"\b{re.escape(source)}\b", target, value)
    return value.strip()


def extract_code_lines(lines: list[str], start_index: int) -> str | None:
    chunks: list[str] = []
    for offset in range(start_index, min(start_index + 4, len(lines))):
        candidate = clean_text(lines[offset])
        if not candidate or looks_like_heading(candidate):
            if chunks:
                break
            continue
        if re.fullmatch(r"[A-Z0-9/\- ]+", candidate):
            chunks.append(candidate)
            continue
        if chunks:
            break
    if not chunks:
        return None
    return " / ".join(chunk.strip() for chunk in chunks if chunk.strip())


def extract_name_lines(lines: list[str], start_index: int) -> str | None:
    for offset in range(start_index, min(start_index + 4, len(lines))):
        candidate = clean_text(lines[offset])
        if not candidate or looks_like_heading(candidate):
            continue
        if candidate.upper() == candidate and len(candidate) > 6:
            return normalize_program_name(candidate)
        lowered = candidate.lower()
        if any(word in lowered for word in ["bachelor", "diploma", "certificate", "llb", "b.ed", "bed "]):
            return normalize_program_name(candidate)
    return None


def extract_block_lines(lines: list[str], start_index: int, limit: int = 4) -> list[str]:
    values: list[str] = []
    for offset in range(start_index, min(start_index + limit, len(lines))):
        candidate = clean_text(lines[offset])
        if not candidate or looks_like_heading(candidate):
            if values:
                break
            continue
        values.append(candidate)
    return values


def normalize_code(value: str) -> str:
    match = CODE_WITH_CAMPUS_PATTERN.search(value.upper())
    return match.group(1) if match else clean_text(value).upper()


def normalize_faculty_name(folder_name: str) -> str:
    mapping = {
        "Economic and Management Sciences": "Economic and Management Sciences",
        "Education": "Education",
        "Engineering": "Engineering",
        "Health Sciences": "Health Sciences",
        "Humanities": "Humanities",
        "Law": "Law",
        "Natural Sciences": "Natural and Agricultural Sciences",
        "Theology": "Theology",
    }
    return mapping.get(folder_name, folder_name)


def normalize_campus_list(value: str) -> list[str]:
    raw = clean_text(value)
    if not raw:
        return []

    pieces = re.split(r",|/| and ", raw, flags=re.I)
    campuses: list[str] = []
    for piece in pieces:
        part = clean_text(re.sub(r"\([^)]*\)", "", piece))
        if not part:
            continue
        lowered = part.lower()
        if "mahikeng" in lowered or "mafikeng" in lowered:
            campuses.append("Mahikeng")
        elif "potchefstroom" in lowered:
            campuses.append("Potchefstroom")
        elif "vanderbijlpark" in lowered:
            campuses.append("Vanderbijlpark")
    return sorted(set(campuses))


def infer_campuses_from_qualification_code(value: str | None) -> list[str]:
    code = clean_text(value).upper()
    if not code:
        return []

    suffix_match = re.search(r"[A-Z]\d{3}([A-Z/]+)(?:-|$)", code)
    if not suffix_match:
        return []

    campuses: list[str] = []
    suffix = suffix_match.group(1)
    if "M" in suffix:
        campuses.append("Mahikeng")
    if "P" in suffix:
        campuses.append("Potchefstroom")
    if "V" in suffix:
        campuses.append("Vanderbijlpark")
    return sorted(set(campuses))


def extract_inline_meta_value(line: str, label_pattern: str) -> str | None:
    match = re.search(label_pattern, line, re.I)
    if not match:
        return None
    value = clean_text(match.group(1))
    return value or None


@dataclass
class ModuleInfo:
    code: str
    name: str | None = None
    credits: int | None = None
    duration_type: str | None = None
    duration_label: str | None = None


@dataclass
class ProgramModule:
    code: str
    name: str | None
    credits: int | None
    year_of_study: int
    semester: int | None
    is_core: bool | None
    duration_type: str | None
    duration_label: str | None
    source_page: int


@dataclass
class Program:
    faculty: str
    school: str | None
    name: str
    qualification_code: str | None
    campuses: list[str]
    delivery_mode: str | None
    duration_years: int
    source_document: str
    modules: list[ProgramModule] = field(default_factory=list)


@dataclass
class SectionCandidate:
    title: str
    start_page: int


def extract_module_details_from_text(text: str) -> dict[str, ModuleInfo]:
    lines = [clean_text(line) for line in text.splitlines() if clean_text(line)]
    result: dict[str, ModuleInfo] = {}

    for index, line in enumerate(lines):
        if "Module code:" not in line:
            continue
        line_upper = line.upper()
        code_match = CODE_PATTERN.search(line_upper)
        if not code_match:
            continue

        code = normalize_code(code_match.group(0))
        duration_label = None
        for duration in MODULE_DURATION_PATTERNS:
            if duration.lower() in line.lower():
                duration_label = duration
                break

        duration_type = None
        if duration_label:
            duration_type = "year" if "year" in duration_label.lower() else "semester"

        title = None
        for look_ahead in range(0, 4):
            if index + look_ahead >= len(lines):
                break
            candidate = lines[index + look_ahead]
            if candidate.startswith("Title:"):
                title = clean_text(candidate.split("Title:", 1)[1])
                break

        current = result.get(code, ModuleInfo(code=code))
        if title and (not current.name or len(title) > len(current.name)):
            current.name = title
        if duration_type:
            current.duration_type = duration_type
            current.duration_label = duration_label
        result[code] = current

    return result


def extract_module_details_from_inline_text(text: str) -> dict[str, ModuleInfo]:
    lines = [clean_text(line) for line in text.splitlines() if clean_text(line)]
    details: dict[str, ModuleInfo] = {}
    for index, line in enumerate(lines):
        match = re.match(r"^([A-Z]{3,6}(?:/[A-Z]{1,3})?\d{3}[A-Z]?)\s+(.+)$", line)
        if not match:
            continue
        code = normalize_code(match.group(1))
        remainder = clean_text(match.group(2))
        if not remainder or remainder.isdigit():
            continue
        if remainder.startswith("["):
            continue

        duplicate_code_match = CODE_PATTERN.search(remainder)
        if duplicate_code_match:
            prefix = clean_text(remainder[: duplicate_code_match.start()])
            remainder = prefix or remainder

        title_parts = [remainder]
        if remainder.endswith(":") and index + 1 < len(lines):
            next_line = clean_text(lines[index + 1])
            if next_line and not next_line.startswith("[") and not CODE_PATTERN.match(next_line):
                if not re.search(r"\b\d{1,3}\s+\d{1,3}\b", next_line):
                    title_parts.append(next_line)
        title = clean_text(" ".join(title_parts))
        trailing_credit_match = re.search(r"\s+(\d{1,3})$", title)
        if trailing_credit_match:
            trailing_credit = int(trailing_credit_match.group(1))
            if trailing_credit >= 8:
                title = clean_text(title[: trailing_credit_match.start()])

        credits = None
        for probe_index in range(index, min(index + 4, len(lines))):
            number_match = re.search(r"\b(?:\d{1,2}\s+)?(\d{1,3})\b\s*$", lines[probe_index])
            if number_match:
                credits = int(number_match.group(1))
                break

        current = details.get(code, ModuleInfo(code=code))
        if title and (not current.name or len(title) > len(current.name)):
            current.name = title
        if credits is not None and current.credits is None:
            current.credits = credits
        details[code] = current
    return details


def table_to_rows(table: list[list[str | None]]) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table:
        cleaned = [clean_text(cell) for cell in row]
        rows.append(cleaned)
    return rows


def extract_module_details_from_tables(tables: list[list[list[str | None]]]) -> dict[str, ModuleInfo]:
    details: dict[str, ModuleInfo] = {}
    for table in tables:
        rows = table_to_rows(table)
        if not rows:
            continue
        header_joined = " | ".join(" ".join(row) for row in rows[:3]).lower()
        if "module code" not in header_joined:
            continue
        if not any(marker in header_joined for marker in ["descriptive name", "course", "description", "title"]):
            continue

        for row in rows[1:]:
            tokens = [cell for cell in row if cell]
            if not tokens:
                continue
            code = None
            code_index = None
            for index, token in enumerate(tokens):
                if CODE_PATTERN.search(token.upper()):
                    code = normalize_code(token)
                    code_index = index
                    break
            if not code or code_index is None:
                continue
            name = None
            credits = None
            for token in tokens[code_index + 1:]:
                if token.isdigit() and credits is None:
                    credits = int(token)
                    continue
                if CODE_PATTERN.search(token.upper()):
                    continue
                if re.fullmatch(r"[A-Z]{1,3}", token):
                    continue
                if not name:
                    name = token
            current = details.get(code, ModuleInfo(code=code))
            cleaned_name = clean_module_name(name, credits)
            if cleaned_name and (not current.name or len(cleaned_name) > len(current.name)):
                current.name = cleaned_name
            if credits is not None and current.credits is None:
                current.credits = credits
            details[code] = current
    return details


def parse_meta_from_text(text: str, faculty: str) -> dict[str, object]:
    lines = [clean_text(line) for line in text.splitlines() if clean_text(line)]
    qualification_code = None
    school = None
    campuses: list[str] = []
    delivery_mode = None
    name = None
    explicit_meta = False

    for index, line in enumerate(lines):
        lowered = line.lower()
        if "qualification name" in lowered or "kwalifikasienaam" in lowered:
            inline_name = extract_inline_meta_value(line, r"(?:qualification name|kwalifikasienaam)\s*[:/ ]+\s*(.+)$")
            name = normalize_program_name(inline_name) if inline_name else (extract_name_lines(lines, index + 1) or name)
            explicit_meta = True
        if "qualification code" in lowered or "kwalifikasiekode" in lowered:
            inline_code = extract_inline_meta_value(line, r"(?:qualification code|kwalifikasiekode)\s*[:/ ]+\s*(.+)$")
            qualification_code = (
                extract_code_lines([inline_code], 0) if inline_code else extract_code_lines(lines, index + 1)
            ) or qualification_code
            explicit_meta = True
        if line.upper().startswith("CODE AND DELIVERY MODE:") and not qualification_code:
            remainder = clean_text(line.split(":", 1)[1])
            qualification_code = extract_code_lines([remainder], 0) or qualification_code
            explicit_meta = True
        if "campus" in lowered or "kampus" in lowered:
            inline_campus = extract_inline_meta_value(
                line,
                r"(?:campus(?:es)?(?:\s*&\s*language of instruction)?|kampus(?:\s*&\s*onderrigtaal)?)\s*[:/ ]+\s*(.+)$",
            )
            block = inline_campus or " ".join(extract_block_lines(lines, index + 1))
            if not block:
                inline_match = re.search(r"Campus(?:es)?(?: & Language of Instruction)?[:/ ]+(.+)", line, re.I)
                block = clean_text(inline_match.group(1)) if inline_match else ""
            campuses = normalize_campus_list(block) or campuses
            explicit_meta = True
        if "delivery mode" in lowered or "metode van aflewering" in lowered:
            inline_delivery = extract_inline_meta_value(
                line,
                r"(?:delivery mode|metode van aflewering)\s*[:/ ]+\s*(.+)$",
            )
            block = inline_delivery or " ".join(extract_block_lines(lines, index + 1, limit=2))
            if not block and ":" in line:
                block = clean_text(line.split(":", 1)[1])
            delivery_mode = block or delivery_mode
            explicit_meta = True

    if not qualification_code:
        qual_code_match = QUALIFICATION_CODE_PATTERN.search(" ".join(lines[:12]))
        if qual_code_match:
            qualification_code = clean_text(qual_code_match.group(0))
    if not qualification_code:
        qual_code_match = re.search(r"\(([A-Z0-9 -/]+)\)", lines[0] if lines else "", re.I)
        if qual_code_match:
            qualification_code = extract_code_lines([clean_text(qual_code_match.group(1))], 0)

    joined = " ".join(lines)
    school_match = re.search(r"(School of [A-Za-z,&/ -]+)", joined)
    if school_match:
        school = clean_text(school_match.group(1))

    if not name:
        for line in lines[:8]:
            lowered = line.lower()
            if "qualification code" in lowered or "prerequisite" in lowered or "campus" in lowered:
                continue
            if (
                "bachelor" in lowered
                or "honours" in lowered
                or "master" in lowered
                or "doctor" in lowered
                or "postgraduate" in lowered
                or lowered.startswith("bed ")
                or lowered.startswith("bed:")
                or lowered.startswith("b.ed")
                or lowered.startswith("beng")
                or lowered.startswith("bsc")
                or lowered.startswith("llb")
                or lowered.startswith("msc")
                or lowered.startswith("mcom")
                or lowered.startswith("meng")
                or lowered.startswith("mba")
                or lowered.startswith("phd")
                or lowered.startswith("diploma")
                or lowered.startswith("higher certificate")
                or lowered.startswith("advanced diploma")
                or lowered.startswith("pg dip")
            ):
                name = normalize_program_name(line)
                break

    if not name:
        if lines and "(" in lines[0] and ")" in lines[0]:
            name = normalize_program_name(clean_text(re.sub(r"\([^)]*\)", "", lines[0])).strip())

    if not campuses:
        campuses = infer_campuses_from_qualification_code(qualification_code)

    return {
        "name": name,
        "qualification_code": qualification_code,
        "school": school,
        "campuses": campuses,
        "delivery_mode": delivery_mode,
        "faculty": faculty,
        "explicit": explicit_meta,
    }


def clean_program_title(title: str) -> str:
    value = clean_text(title)
    value = re.sub(r"^[A-Z]{2,5}\.\d+(?:\.\d+)*\s+", "", value)
    value = re.sub(r"^\d+(?:\.\d+)*\s+", "", value)
    lower_value = value.lower()
    for marker in [
        "programme:",
        "compilation of programme:",
        "compilation of qualification:",
        "programme ",
    ]:
        if marker in lower_value and ":" in value:
            value = value.split(":", 1)[1].strip()
            break
    value = re.sub(r"\.{3,}.*$", "", value)
    value = re.sub(r"\s+\d{2,3}\s*$", "", value)
    value = value.split(" / ", 1)[0].strip()
    value = re.sub(r"\(\s*phasing[^)]*\)", "", value, flags=re.I).strip()
    value = re.sub(r"\s{2,}", " ", value)
    return normalize_program_name(value)


def title_looks_like_program(title: str) -> bool:
    lowered = clean_text(title).lower()
    if not lowered:
        return False
    if any(
        marker in lowered
        for marker in [
            "admission",
            "requirements",
            "outcomes",
            "authority",
            "module outcomes",
            "qualifications offered",
            "list of modules",
            "non-law modules",
            "elective modules",
            "school of ",
            "faculty rules",
            "entrance requirements",
            "general provisions",
            "changing a programme",
            "total programme credits",
            "qualifications, programmes and curricula",
            "qualification, programmes and curricula",
            "rules for the degree",
            "rules for the bachelor",
            "rules for the qualification",
            "qualifications /",
            "qualifications offered by the faculty",
        ]
    ):
        return False
    if lowered.endswith(" qualifications") or lowered.endswith(" qualification"):
        return False
    return bool(PROGRAM_TITLE_PATTERN.search(lowered)) or "programme:" in lowered or "compilation of programme" in lowered


def build_outline_nodes(items: list[object], reader: PdfReader) -> list[dict[str, object]]:
    nodes: list[dict[str, object]] = []
    index = 0
    while index < len(items):
        item = items[index]
        if isinstance(item, list):
            index += 1
            continue

        children: list[dict[str, object]] = []
        if index + 1 < len(items) and isinstance(items[index + 1], list):
            children = build_outline_nodes(items[index + 1], reader)
            index += 1

        try:
            page_number = reader.get_destination_page_number(item) + 1
        except Exception:
            page_number = None

        nodes.append(
            {
                "title": str(item.get("/Title", "")),
                "page": page_number,
                "children": children,
            }
        )
        index += 1
    return nodes


def collect_outline_section_candidates(nodes: list[dict[str, object]]) -> list[SectionCandidate]:
    sections: list[SectionCandidate] = []
    for node in nodes:
        child_sections = collect_outline_section_candidates(node["children"])
        if title_looks_like_program(str(node["title"])) and not child_sections and node["page"]:
            title = clean_program_title(str(node["title"]))
            if title:
                sections.append(SectionCandidate(title=title, start_page=int(node["page"])))
        sections.extend(child_sections)
    return sections


def build_printed_page_map(reader: PdfReader) -> dict[int, int]:
    mapping: dict[int, int] = {}
    for page_index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        lines = [clean_text(line) for line in text.splitlines() if clean_text(line)]
        for line in lines[:3]:
            if re.fullmatch(r"\d{1,3}", line):
                mapping[int(line)] = page_index
                break
    return mapping


def collect_toc_section_candidates(reader: PdfReader) -> list[SectionCandidate]:
    page_map = build_printed_page_map(reader)
    sections: list[SectionCandidate] = []
    for toc_page in range(4, 8):
        if toc_page - 1 >= len(reader.pages):
            break
        text = reader.pages[toc_page - 1].extract_text() or ""
        lines = [clean_text(line) for line in text.splitlines() if clean_text(line)]
        index = 0
        while index < len(lines):
            line = lines[index]
            if not re.match(r"^EMS\.\d+", line):
                index += 1
                continue

            entry = line
            while index + 1 < len(lines) and not re.match(r"^EMS\.\d+", lines[index + 1]):
                entry += " " + lines[index + 1]
                index += 1
                if re.search(r"\b\d{2,3}$", lines[index]):
                    break

            normalized_entry = re.sub(r"\.{3,}", " ", entry)
            if "error! bookmark not defined" in normalized_entry.lower():
                index += 1
                continue

            page_match = re.search(r"(\d{2,3})\s*$", normalized_entry)
            if not page_match:
                index += 1
                continue

            printed_page = int(page_match.group(1))
            title = clean_program_title(normalized_entry)
            if title and title_looks_like_program(title) and printed_page in page_map:
                sections.append(SectionCandidate(title=title, start_page=page_map[printed_page]))

            index += 1
    return sections


def build_section_candidates(path: Path, reader: PdfReader) -> list[SectionCandidate]:
    outline_sections = collect_outline_section_candidates(build_outline_nodes(reader.outline, reader))
    sections = outline_sections if outline_sections else collect_toc_section_candidates(reader)

    deduped: list[SectionCandidate] = []
    seen: set[tuple[int, str]] = set()
    for section in sorted(sections, key=lambda item: (item.start_page, item.title)):
        key = (section.start_page, section.title.lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(section)
    return deduped


def dedupe_program_modules(modules: list[ProgramModule]) -> list[ProgramModule]:
    deduped: list[ProgramModule] = []
    seen: set[tuple[str, int, int | None]] = set()
    for module in modules:
        key = (module.code, module.year_of_study, module.semester)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(module)
    return deduped


def looks_bad_module_name(name: str | None) -> bool:
    if not name:
        return True
    candidate = clean_text(name)
    if not candidate:
        return True
    if re.fullmatch(r"[\d\s]+", candidate):
        return True
    if candidate.startswith("[") and candidate.endswith("]"):
        return True
    if CODE_PATTERN.fullmatch(candidate.upper()):
        return True
    return False


def is_high_confidence_program(
    name: str,
    qualification_code: str | None,
    campuses: list[str],
    delivery_mode: str | None,
    modules: list[ProgramModule],
) -> bool:
    if not modules:
        return False
    lowered = name.lower()
    if lowered.startswith(("ems.", "hum.", "fedu.", "fhs.", "fnas.", "flaw.", "feng.")):
        return False
    if qualification_code or campuses or delivery_mode:
        return True
    return len(modules) >= 8


def choose_program_name(section_title: str, meta_name: str | None) -> str:
    meta_value = normalize_program_name(meta_name) if meta_name else ""
    section_value = clean_program_title(section_title)

    if meta_value:
        meta_lower = meta_value.lower()
        if (
            "bachelor" in meta_lower
            or meta_lower.startswith(("ba ", "bcom", "bsc", "beng", "bed", "llb", "diploma", "higher certificate", "advanced diploma", "certificate",
                                        "honours", "msc", "mcom", "meng", "mba", "ma ", "med ", "master", "doctor", "phd", "dcom", "postgraduate diploma", "pg dip"))
        ):
            return meta_value

    return section_value


def row_group_boundaries(row: list[str]) -> list[tuple[int, int, int]]:
    groups: list[tuple[int, int, int]] = []
    positions = []
    for index, cell in enumerate(row):
        match = YEAR_LEVEL_PATTERN.search(cell)
        if match:
            positions.append((index, int(match.group(1))))
        else:
            word_match = YEAR_ROW_PATTERN.search(cell)
            if word_match:
                positions.append((index, YEAR_WORDS[word_match.group(1).lower()]))
    if not positions:
        return groups
    for idx, (start, year_number) in enumerate(positions):
        end = positions[idx + 1][0] if idx + 1 < len(positions) else len(row)
        groups.append((start, end, year_number))
    return groups


def simplify_cells(cells: list[str]) -> list[str]:
    values: list[str] = []
    for cell in cells:
        if not cell:
            continue
        for line in cell.split("\n"):
            token = clean_text(line)
            if not token:
                continue
            if values and values[-1] == token:
                continue
            values.append(token)
    return values


def extract_credits(values: list[str]) -> int | None:
    for token in reversed(values):
        match = re.fullmatch(r"\d{1,3}", token)
        if match:
            return int(token)
    return None


def extract_code(values: list[str]) -> str | None:
    for token in values:
        match = CODE_WITH_CAMPUS_PATTERN.search(token.upper())
        if match:
            return match.group(1)
    return None


def extract_name_from_values(values: list[str], code: str | None) -> str | None:
    if not values:
        return None
    start = 0
    if code:
        for index, token in enumerate(values):
            if code in token.upper():
                start = index + 1
                break
    for token in values[start:]:
        upper = token.upper()
        if CODE_PATTERN.search(upper):
            continue
        if token.isdigit():
            continue
        if re.search(r"\d", token):
            continue
        if token.lower().startswith("select "):
            continue
        if token.startswith("["):
            continue
        if re.fullmatch(r"[A-Z]{1,3}", token):
            continue
        if token.lower().startswith("total "):
            continue
        return token
    return None


def clean_module_name(name: str | None, credits: int | None = None) -> str | None:
    candidate = clean_text(name)
    if not candidate:
        return None
    if credits is not None:
        candidate = re.sub(rf"\s+{credits}$", "", candidate).strip()
    candidate = re.sub(r"\s+\d{1,3}$", "", candidate).strip()
    candidate = re.sub(r"\s{2,}", " ", candidate)
    return candidate or None


def detect_semester_label(values: list[str], next_values: list[str] | None = None) -> int | None:
    joined = " ".join(values).lower()
    semester_match = SEMESTER_PATTERN.search(joined)
    if semester_match:
        label = (semester_match.group(1) or semester_match.group(2) or "").lower()
        return 1 if label in {"first", "1"} else 2

    if "semester" in joined:
        if re.search(r"\bfirst\b", joined):
            return 1
        if re.search(r"\bsecond\b", joined):
            return 2

    if re.search(r"\b(first|second)\b", joined):
        next_joined = " ".join(next_values or []).lower()
        if "semester" in next_joined:
            return 1 if "first" in joined else 2

    return None


def parse_curriculum_table(rows: list[list[str]], page_number: int, module_lookup: dict[str, ModuleInfo]) -> list[ProgramModule]:
    header_index = next((idx for idx, row in enumerate(rows) if row_group_boundaries(row)), None)
    if header_index is None:
        return []

    year_groups = row_group_boundaries(rows[header_index])
    if not year_groups:
        return []

    modules: list[ProgramModule] = []

    for start, end, year_number in year_groups:
        current_semester: int | None = None
        current_duration_override: str | None = None
        current_is_core = True
        pending_semester: int | None = None
        body_rows = rows[header_index + 1 :]
        for row_index, row in enumerate(body_rows):
            values = simplify_cells(row[start:end])
            full_values = simplify_cells(row)
            full_joined = " ".join(full_values).lower()
            joined = " ".join(values).lower()
            if not values and not full_values:
                continue

            if joined.startswith("total year level") or joined.startswith("total credits for the curriculum"):
                continue
            if joined.startswith("total "):
                continue
            if "module code" in joined or "module code" in full_joined or "code" == joined:
                continue
            if "year level" in joined or "year level" in full_joined:
                current_is_core = True
                pending_semester = None
                continue
            if "year module" in joined or "year module" in full_joined:
                current_semester = None
                current_duration_override = "year"
                current_is_core = True
                pending_semester = None
                continue
            next_values = simplify_cells(body_rows[row_index + 1]) if row_index + 1 < len(body_rows) else []
            semester_number = detect_semester_label(full_values, next_values)
            if semester_number is not None:
                current_semester = semester_number
                current_duration_override = "semester"
                current_is_core = True
                pending_semester = None
                continue
            if re.search(r"\b(first|second)\b", full_joined) and "semester" not in full_joined:
                pending_semester = 1 if "first" in full_joined else 2
                continue
            if pending_semester is not None and full_joined == "semester":
                current_semester = pending_semester
                current_duration_override = "semester"
                current_is_core = True
                pending_semester = None
                continue

            if joined.startswith("select ") or full_joined.startswith("select "):
                current_is_core = False
                continue

            code = extract_code(values)
            if not code:
                continue

            name = extract_name_from_values(values, code)
            credits = extract_credits(values)
            lookup = module_lookup.get(code) or module_lookup.get(code.replace("/", ""))
            resolved_lookup_name = clean_module_name(lookup.name if lookup else None, lookup.credits if lookup else None)
            final_name = clean_module_name(name, credits) or resolved_lookup_name or code
            final_credits = credits if credits is not None else (lookup.credits if lookup else None)
            if current_duration_override == "year":
                duration_type = "year"
                duration_label = "Year module"
            elif lookup and lookup.duration_type:
                duration_type = lookup.duration_type
                duration_label = lookup.duration_label
            elif current_semester:
                duration_type = "semester"
                duration_label = f"Semester {current_semester}"
            else:
                duration_type = None
                duration_label = None

            modules.append(
                ProgramModule(
                    code=code,
                    name=final_name,
                    credits=final_credits,
                    year_of_study=year_number,
                    semester=current_semester,
                    is_core=current_is_core,
                    duration_type=duration_type,
                    duration_label=duration_label,
                    source_page=page_number,
                )
            )
    return modules


def merge_program(programs: dict[str, Program], program: Program) -> None:
    key = program.qualification_code or program.name
    existing = programs.get(key)
    if not existing:
        programs[key] = program
        return

    existing.campuses = sorted(set(existing.campuses) | set(program.campuses))
    if not existing.school and program.school:
        existing.school = program.school
    if not existing.delivery_mode and program.delivery_mode:
        existing.delivery_mode = program.delivery_mode
    seen = {(module.code, module.year_of_study, module.semester, module.name) for module in existing.modules}
    for module in program.modules:
        identity = (module.code, module.year_of_study, module.semester, module.name)
        if identity not in seen:
            existing.modules.append(module)
            seen.add(identity)
    existing.duration_years = max(existing.duration_years, program.duration_years)


def parse_pdf(path: Path) -> list[Program]:
    faculty = normalize_faculty_name(path.parent.name)
    programs: dict[str, Program] = {}

    reader = PdfReader(str(path))
    texts = [(page.extract_text() or "") for page in reader.pages]
    section_candidates = build_section_candidates(path, reader)

    module_lookup: dict[str, ModuleInfo] = {}
    for page_index, text in enumerate(texts):
        lowered = text.lower()
        if "module code:" in lowered:
            for code, info in extract_module_details_from_text(text).items():
                current = module_lookup.get(code, ModuleInfo(code=code))
                if info.name and (not current.name or len(info.name) > len(current.name)):
                    current.name = info.name
                if info.duration_type:
                    current.duration_type = info.duration_type
                    current.duration_label = info.duration_label
                module_lookup[code] = current
        for code, info in extract_module_details_from_inline_text(text).items():
            current = module_lookup.get(code, ModuleInfo(code=code))
            if info.name and (not current.name or len(info.name) > len(current.name)):
                current.name = info.name
            if info.credits is not None and current.credits is None:
                current.credits = info.credits
            module_lookup[code] = current

    with pdfplumber.open(path) as pdf:
        table_cache: dict[int, list[list[list[str | None]]]] = {}

        def get_tables(page_index: int) -> list[list[list[str | None]]]:
            if page_index not in table_cache:
                table_cache[page_index] = pdf.pages[page_index].extract_tables()
            return table_cache[page_index]

        for page_index in range(len(texts)):
            if "descriptive name" not in texts[page_index].lower() or "module code" not in texts[page_index].lower():
                continue
            for code, info in extract_module_details_from_tables(get_tables(page_index)).items():
                current = module_lookup.get(code, ModuleInfo(code=code))
                if info.name and (not current.name or len(info.name) > len(current.name)):
                    current.name = info.name
                if info.credits is not None and current.credits is None:
                    current.credits = info.credits
                module_lookup[code] = current

        for index, section in enumerate(section_candidates):
            start_page = section.start_page
            end_page = (
                section_candidates[index + 1].start_page - 1
                if index + 1 < len(section_candidates)
                else len(texts)
            )
            span_text = "\n".join(texts[start_page - 1 : min(end_page, start_page + 4)])
            meta = parse_meta_from_text(span_text, faculty)
            qualification_code = clean_text(str(meta.get("qualification_code") or "")) or None
            meta_name = clean_text(str(meta.get("name") or "")) or None
            school = clean_text(str(meta.get("school") or "")) or None
            campuses = meta.get("campuses") if isinstance(meta.get("campuses"), list) else []
            delivery_mode = clean_text(str(meta.get("delivery_mode") or "")) or None
            program_name = choose_program_name(section.title, meta_name)

            section_modules: list[ProgramModule] = []
            for page_index in range(start_page - 1, min(end_page, len(texts))):
                rows_by_table = [table_to_rows(table) for table in get_tables(page_index)]
                for rows in rows_by_table:
                    if not rows:
                        continue
                    joined_rows = " ".join(" ".join(row) for row in rows).lower()
                    if "year level" not in joined_rows and "first year" not in joined_rows:
                        continue
                    section_modules.extend(parse_curriculum_table(rows, page_index + 1, module_lookup))

            if not section_modules:
                continue

            cleaned_modules: list[ProgramModule] = []
            for module in dedupe_program_modules(section_modules):
                lookup = module_lookup.get(module.code) or module_lookup.get(module.code.replace("/", ""))
                preferred_name = lookup.name if lookup and not looks_bad_module_name(lookup.name) else None
                resolved_name = preferred_name or (None if looks_bad_module_name(module.name) else module.name) or module.code
                credits = module.credits if module.credits is not None else (lookup.credits if lookup else None)
                duration_type = module.duration_type or (lookup.duration_type if lookup else None)
                duration_label = module.duration_label or (lookup.duration_label if lookup else None)
                cleaned_modules.append(
                    ProgramModule(
                        code=module.code,
                        name=resolved_name,
                        credits=credits,
                        year_of_study=module.year_of_study,
                        semester=module.semester,
                        is_core=module.is_core,
                        duration_type=duration_type,
                        duration_label=duration_label,
                        source_page=module.source_page,
                    )
                )

            if not is_high_confidence_program(
                program_name,
                qualification_code,
                list(campuses),
                delivery_mode,
                cleaned_modules,
            ):
                continue

            duration_years = max((module.year_of_study for module in cleaned_modules), default=1)
            merge_program(
                programs,
                Program(
                    faculty=faculty,
                    school=school,
                    name=program_name,
                    qualification_code=qualification_code,
                    campuses=list(campuses),
                    delivery_mode=delivery_mode,
                    duration_years=duration_years,
                    source_document=str(path),
                    modules=cleaned_modules,
                ),
            )

    return list(programs.values())


def serialize_program(program: Program, level: str = "undergraduate") -> dict[str, object]:
    modules = sorted(program.modules, key=lambda item: (item.year_of_study, item.semester or 9, item.code, item.name or ""))
    label = "NWU Undergraduate Yearbooks 2026" if level == "undergraduate" else "NWU Postgraduate Yearbooks 2026"
    return {
        "id": slugify(f"{level}-{program.qualification_code or program.name}"),
        "name": program.name,
        "qualificationCode": program.qualification_code,
        "faculty": program.faculty,
        "school": program.school,
        "campuses": program.campuses,
        "deliveryMode": program.delivery_mode,
        "durationYears": program.duration_years,
        "level": level,
        "source": "yearbook",
        "sourceLabel": label,
        "sourceDocument": program.source_document,
        "modules": [
            {
                "code": module.code,
                "name": module.name or module.code,
                "credits": module.credits,
                "yearOfStudy": module.year_of_study,
                "semester": module.semester,
                "isCore": module.is_core,
                "durationType": module.duration_type,
                "durationLabel": module.duration_label,
                "sourcePage": module.source_page,
            }
            for module in modules
        ],
    }


def main() -> None:
    programs_by_faculty: dict[str, list[dict[str, object]]] = defaultdict(list)

    for pdf_path in UG_FILES:
        if not pdf_path.exists():
            print(f"SKIP missing {pdf_path}", flush=True)
            continue
        print(f"Parsing UG {pdf_path.name}...", flush=True)
        programs = parse_pdf(pdf_path)
        for program in programs:
            programs_by_faculty[program.faculty].append(serialize_program(program, level="undergraduate"))
        print(f"  -> {len(programs)} programmes", flush=True)

    for pdf_path in PG_FILES:
        if not pdf_path.exists():
            print(f"SKIP missing PG {pdf_path}", flush=True)
            continue
        print(f"Parsing PG {pdf_path.name}...", flush=True)
        programs = parse_pdf(pdf_path)
        for program in programs:
            programs_by_faculty[program.faculty].append(serialize_program(program, level="postgraduate"))
        print(f"  -> {len(programs)} PG programmes", flush=True)

    payload = {
        "institutionName": "North-West University",
        "displayName": "North-West University",
        "academicPeriodType": "semester",
        "academicUnitLabel": "Faculty",
        "campuses": ["Mahikeng", "Potchefstroom", "Vanderbijlpark"],
        "faculties": sorted(programs_by_faculty.keys()),
        "courses": sorted(
            [course for courses in programs_by_faculty.values() for course in courses],
            key=lambda item: (str(item["faculty"]), str(item["level"]), str(item["name"])),
        ),
        "notes": {
            "source": "Generated from NWU undergraduate and postgraduate yearbooks downloaded into the local archive.",
            "coverage": {faculty: len(courses) for faculty, courses in sorted(programs_by_faculty.items())},
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}", flush=True)
    print(json.dumps(payload["notes"]["coverage"], indent=2), flush=True)


if __name__ == "__main__":
    main()
