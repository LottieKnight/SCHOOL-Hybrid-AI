from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from pypdf import PdfReader

ROOT = Path(r"C:\Users\molot\Desktop\AI LAB\projects\TDBS\sa-edu-platform")
SOURCE = Path(
    r"C:\Users\molot\Desktop\AI LAB\downloads\sa-universities-academic-docs-organized\University of Zululand\2026\Yearbooks and Handbooks\FHSS Undergrad Handbook 2026.pdf"
)
OUTPUT = ROOT / "apps" / "web" / "lib" / "generated" / "unizuluFhssAcademicCatalog.generated.json"

MODULE_CODE_RE = re.compile(r"\b(?:[0-9][A-Z]{2,4}\d{3}|AHIS211|AHIS212|4CPS121|4CPS122)\b")
CREDIT_INLINE_RE = re.compile(r"Credits:\s*(\d{1,3})", re.I)
YEAR_RE = re.compile(r"^YEAR\s+(\d)", re.I)
SEMESTER_RE = re.compile(r"^Semester\s+([12])$", re.I)
PROGRAMME_END_RE = re.compile(
    r"(?:PROGRAMME CODE|DEPARTMENT OF |The Department offers the following programmes|The Department offers:)",
    re.I,
)

COURSE_SPECS: list[dict[str, Any]] = [
    {
        "code": "1DDEG1",
        "id": "unizulu-fhss-1ddeg1",
        "name": "Bachelor of Arts in Development Studies",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 33,
        "endPage": 37,
    },
    {
        "code": "1CMDP1",
        "id": "unizulu-fhss-1cmdp1",
        "name": "Diploma in Media Studies",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 39,
        "endPage": 42,
    },
    {
        "code": "1CPDP1",
        "id": "unizulu-fhss-1cpdp1",
        "name": "Diploma in Public Relations Management",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["Richards Bay"],
        "durationYears": 3,
        "startPage": 43,
        "endPage": 47,
    },
    {
        "code": "1CADP1",
        "id": "unizulu-fhss-1cadp1",
        "name": "Advanced Diploma in Communication Science",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["Richards Bay"],
        "durationYears": 1,
        "startPage": 48,
        "endPage": 49,
    },
    {
        "code": "1CDEG1",
        "id": "unizulu-fhss-1cdeg1",
        "name": "Bachelor of Arts in Intercultural Communication",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 51,
        "endPage": 54,
    },
    {
        "code": "1UDEG2",
        "id": "unizulu-fhss-1udeg2",
        "name": "Bachelor of Arts in Drama, Theatre and Performance",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 57,
        "endPage": 60,
    },
    {
        "code": "1JDEG2",
        "id": "unizulu-fhss-1jdeg2",
        "name": "Bachelor of Arts in Correctional Studies",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 62,
        "endPage": 65,
    },
    {
        "code": "1BDEG3",
        "id": "unizulu-fhss-1bdeg3",
        "name": "Bachelor of Arts (Linguistics and English)",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 68,
        "endPage": 69,
    },
    {
        "code": "1GBA01",
        "id": "unizulu-fhss-1gba01",
        "name": "Bachelor of Arts in Environmental Planning and Development",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 71,
        "endPage": 75,
    },
    {
        "code": "1IDEG1",
        "id": "unizulu-fhss-1ideg1",
        "name": "Bachelor of Arts in Information Studies",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 79,
        "endPage": 83,
    },
    {
        "code": "1IDEG2",
        "id": "unizulu-fhss-1ideg2",
        "name": "Bachelor of Library and Information Science",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 4,
        "startPage": 85,
        "endPage": 90,
    },
    {
        "code": "1PDEG1",
        "id": "unizulu-fhss-1pdeg1",
        "name": "Bachelor of Social Science in Political and International Studies",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 95,
        "endPage": 100,
    },
    {
        "code": "1YDEG1",
        "id": "unizulu-fhss-1ydeg1",
        "name": "Bachelor of Arts in Psychology",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 104,
        "endPage": 107,
    },
    {
        "code": "1DPTM1",
        "id": "unizulu-fhss-1dptm1",
        "name": "Diploma in Tourism Management",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["Richards Bay"],
        "durationYears": 3,
        "startPage": 109,
        "endPage": 117,
    },
    {
        "code": "1RDEG1",
        "id": "unizulu-fhss-1rdeg1",
        "name": "Bachelor of Tourism Studies",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 119,
        "endPage": 123,
    },
    {
        "code": "1WDEG1",
        "id": "unizulu-fhss-1wdeg1",
        "name": "Bachelor of Social Work",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 4,
        "startPage": 126,
        "endPage": 131,
    },
    {
        "code": "1SDEG1",
        "id": "unizulu-fhss-1sdeg1",
        "name": "Bachelor of Arts in Sociology",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 133,
        "endPage": 138,
    },
    {
        "code": "1SDEG2",
        "id": "unizulu-fhss-1sdeg2",
        "name": "Bachelor of Arts in Industrial Sociology",
        "faculty": "Humanities and Social Sciences",
        "campuses": ["KwaDlangezwa"],
        "durationYears": 3,
        "startPage": 139,
        "endPage": 145,
    },
]


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", value)
    replacements = {
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\ufb01": "fi",
        "\ufb02": "fl",
        "\xa0": " ",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()


def preprocess_page_lines(text: str) -> list[str]:
    raw_lines = text.splitlines()
    lines: list[str] = []
    for index, raw in enumerate(raw_lines):
        line = normalize_text(raw)
        if not line:
            continue
        if line.startswith("UNDERGRADUATE FACULTY HANDBOOK-2026"):
            continue
        if index <= 2 and re.fullmatch(r"\d{1,3}", line):
            continue
        lines.append(line)
    return lines


def collect_pages() -> list[list[str]]:
    reader = PdfReader(str(SOURCE))
    return [preprocess_page_lines(page.extract_text() or "") for page in reader.pages]


def is_programme_boundary(line: str) -> bool:
    return bool(PROGRAMME_END_RE.search(line))


def clean_module_name(value: str) -> str:
    name = normalize_text(value)
    name = re.sub(r"^\W+", "", name)
    name = name.replace("ﬁ", "fi")
    name = re.sub(r"(?<=[a-z])(?=This module|The purpose of this module|On successful completion|Students who|To introduce|The aim of this module)", " ", name)
    name = re.split(
        r"(?:(?<!\w)(?:This module|The purpose of this module|On successful completion|Students who|To introduce|The aim of this module))",
        name,
        maxsplit=1,
        flags=re.I,
    )[0]
    name = re.sub(r"\s{2,}", " ", name)
    name = name.rstrip(":")
    if name.isupper() and 2 <= len(name.split()) <= 6:
        name = name.title()
    return name.strip(" -:")


def find_credit(block: list[str]) -> int | None:
    for index, line in enumerate(block):
        match = CREDIT_INLINE_RE.search(line)
        if match:
            return int(match.group(1))
        if line.startswith("Credits") and index + 1 < len(block) and re.fullmatch(r"\d{1,3}", block[index + 1]):
            return int(block[index + 1])
    return None


def parse_module_block(
    block: list[str],
    year_of_study: int | None,
    semester: int | None,
    fallback_is_core: bool | None = None,
) -> dict[str, Any] | None:
    if year_of_study is None:
        return None
    code: str | None = None
    code_index = -1
    for index, line in enumerate(block):
        match = MODULE_CODE_RE.search(line)
        if match:
            code = match.group(0).replace(" ", "").upper()
            code_index = index
            break
    if not code:
        return None

    name: str | None = None
    for line in block[code_index + 1 :]:
        if line.startswith("Credits:") or line.startswith("NQF:"):
            continue
        if re.fullmatch(r"\d{1,3}", line):
            continue
        if line.startswith("Pre-requisite") or line.startswith("Co-requisite"):
            continue
        if line.startswith("Compulsory "):
            continue
        if YEAR_RE.match(line) or SEMESTER_RE.match(line):
            continue
        if is_programme_boundary(line):
            break
        if MODULE_CODE_RE.search(line):
            break
        if line in {"Subject", "Code", "Module Name", "Undergraduate Module Structure and Composition"}:
            continue
        name = clean_module_name(line)
        break
    if not name:
        return None

    is_core = fallback_is_core if fallback_is_core is not None else True
    for line in block:
        if "Compulsory Y" in line:
            is_core = True
        elif "Compulsory N" in line:
            is_core = False

    return {
        "code": code,
        "name": name,
        "credits": find_credit(block),
        "semester": semester,
        "yearOfStudy": year_of_study,
        "isCore": is_core,
        "durationType": "semester" if semester else "year",
        "durationLabel": f"Semester {semester}" if semester else "Year module",
    }


def extract_modules(pages: list[list[str]], spec: dict[str, Any]) -> list[dict[str, Any]]:
    modules: list[dict[str, Any]] = []
    current_year: int | None = None
    current_semester: int | None = None
    current_block: list[str] = []
    current_fallback_core: bool | None = None

    def flush_current() -> None:
        nonlocal current_block, current_fallback_core
        if not current_block:
            return
        module = parse_module_block(current_block, current_year, current_semester, current_fallback_core)
        if module:
            modules.append(module)
        current_block = []
        current_fallback_core = None

    for page_index in range(spec["startPage"] - 1, spec["endPage"]):
        for line in pages[page_index]:
            if YEAR_RE.match(line):
                flush_current()
                current_year = int(YEAR_RE.match(line).group(1))
                current_semester = None
                continue
            if SEMESTER_RE.match(line):
                flush_current()
                current_semester = int(SEMESTER_RE.match(line).group(1))
                continue
            if is_programme_boundary(line) and current_block:
                flush_current()
                continue
            if line.startswith("Elective") or line.startswith("Select any"):
                flush_current()
                current_fallback_core = False
                continue
            if MODULE_CODE_RE.search(line):
                if current_block:
                    flush_current()
                current_block = [line]
                continue
            if current_block:
                current_block.append(line)

    flush_current()

    deduped: dict[tuple[str, int, int | None], dict[str, Any]] = {}
    for module in modules:
        key = (module["code"], module["yearOfStudy"], module["semester"])
        current = deduped.get(key)
        if not current:
            deduped[key] = module
            continue
        if len(module["name"]) > len(current["name"]):
            current["name"] = module["name"]
        current["credits"] = current["credits"] or module["credits"]
        if current["isCore"] is None:
            current["isCore"] = module["isCore"]

    return sorted(
        deduped.values(),
        key=lambda item: (
            item["yearOfStudy"],
            9 if item["semester"] is None else item["semester"],
            item["code"],
        ),
    )


def main() -> None:
    pages = collect_pages()
    courses = []
    for spec in COURSE_SPECS:
        modules = extract_modules(pages, spec)
        if len(modules) < 4:
            continue
        courses.append(
            {
                "id": spec["id"],
                "name": spec["name"],
                "qualificationCode": spec["code"],
                "faculty": spec["faculty"],
                "school": None,
                "campuses": spec["campuses"],
                "deliveryMode": "Yearbook",
                "durationYears": spec["durationYears"],
                "source": "yearbook",
                "sourceLabel": "University of Zululand FHSS Handbook 2026",
                "sourceDocument": str(SOURCE),
                "modules": modules,
            }
        )

    payload = {
        "institutionName": "University of Zululand",
        "displayName": "University of Zululand",
        "academicPeriodType": "semester",
        "academicUnitLabel": "Faculty",
        "campuses": ["KwaDlangezwa", "Richards Bay"],
        "faculties": [
            "Humanities and Social Sciences",
            "Commerce, Administration and Law",
            "Education",
            "Science, Agriculture and Engineering",
        ],
        "courses": courses,
        "notes": {
            "source": str(SOURCE),
        },
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(courses)} University of Zululand FHSS courses to {OUTPUT}")


if __name__ == "__main__":
    main()
