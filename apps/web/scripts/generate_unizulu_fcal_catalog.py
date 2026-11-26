from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from pypdf import PdfReader

ROOT = Path(r"C:\Users\molot\Desktop\AI LAB\projects\TDBS\sa-edu-platform")
SOURCE = Path(
    r"C:\Users\molot\Desktop\AI LAB\downloads\sa-universities-academic-docs-organized\University of Zululand\2026\Yearbooks and Handbooks\FCAL Handbook 2026.pdf"
)
OUTPUT = ROOT / "apps" / "web" / "lib" / "generated" / "unizuluFcalAcademicCatalog.generated.json"

HEADING_RE = re.compile(r"^(?:\d+\.)+\s*(.+)\s+\(([0-9A-Z]{6,7})\)(?:\s+\[SAQA:.*)?$", re.I)
PLAIN_HEADING_RE = re.compile(
    r"^(Higher Certificate in Accounting|Diploma in Management of Co-operatives|Diploma in Logistics Management|Diploma in Transport Management|Advanced Certificate in Accountancy)\s+\(([0-9A-Z]{6,7})\)$",
    re.I,
)
MODULE_CODE_RE = re.compile(r"\b(?:[0-9][A-Z]{2,4}\d{3}|CBCTM1|APHP112)\b")
CREDIT_ROW_RE = re.compile(r"\b([0-9][A-Z]{2,4}\d{3}|CBCTM1|APHP112)\s+(\d{1,3})\s+[0-9]\b")
YEAR_RE = re.compile(r"^YEAR\s+(\d)", re.I)
SEMESTER_RE = re.compile(r"^SEMESTER\s+([12])$", re.I)

SKIP_TITLES = {
    "BCOM 4-YEAR AUGMENTED PROGRAMME",
    "BCOM PROGRAMMES",
    "BACHELOR OF PUBLIC ADMINISTRATION",
    "BACHELOR OF LAWS",
}

DISPLAY_RENAMES = {
    "BCOM: ACCOUNTING SCIENCE": "BCom (Accounting Science)",
    "BCOM (ACCOUNTING)": "BCom (Accounting)",
    "BCOM: MANAGEMENT INFORMATION SYSTEMS": "BCom (Management Information Systems)",
    "BCOM: ACCOUNTING AND ECONOMICS": "BCom (Accounting and Economics)",
    "BCOM: BUSINESS MANAGEMENT AND ACCOUNTING": "BCom (Business Management and Accounting)",
    "BCOM: BUSINESS MANAGEMENT AND ECONOMICS": "BCom (Business Management and Economics)",
    "BCOM: BANKING AND BUSINESS MANAGEMENT": "BCom (Banking and Business Management)",
    "BCOM: ECONOMICS AND BANKING": "BCom (Economics and Banking)",
    "BCOM: ECONOMICS AND HR MANAGEMENT": "BCom (Economics and HR Management)",
    "BCOM: HR MANAGEMENT AND BUSINESS MANAGEMENT": "BCom (HR Management and Business Management)",
    "BADMIN: PUBLIC ADMINISTRATION AND POLITICAL SCIENCE": "BAdmin (Public Administration and Political Science)",
    "BADMIN: PUBLIC ADMINISTRATION AND HUMAN RESOURCES": "BAdmin (Public Administration and Human Resources)",
    "BADMIN: PUBLIC ADMINISTRATION AND ECONOMICS": "BAdmin (Public Administration and Economics)",
    "BADMIN: PUBLIC ADMINISTRATION AND BUSINESS MANAGEMENT": "BAdmin (Public Administration and Business Management)",
    "BACHELOR OF LAWS (LLB)": "Bachelor of Laws (LLB)",
    "HIGHER CERTIFICATE IN ACCOUNTING": "Higher Certificate in Accounting",
    "DIPLOMA IN MANAGEMENT OF CO-OPERATIVES": "Diploma in Management of Co-operatives",
    "DIPLOMA IN LOGISTICS MANAGEMENT": "Diploma in Logistics Management",
    "DIPLOMA IN TRANSPORT MANAGEMENT": "Diploma in Transport Management",
    "ADVANCED CERTIFICATE IN ACCOUNTANCY": "Advanced Certificate in Accountancy",
}

NO_INTAKE_CODES = {"2AMIS2", "CBCTM1"}


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
    text = re.sub(r"([0-9A-Z]{4,5})\s+(\d{3})\b", r"\1\2", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return normalized or "course"


def clean_title(value: str) -> str:
    title = normalize_text(value).strip()
    title = re.sub(r"^\d+\s+", "", title).strip()
    title = re.sub(r"\s+\[SAQA:.*$", "", title, flags=re.I).strip()
    title = re.sub(r"\s+NO STUDENT INTAKE.*$", "", title, flags=re.I).strip()
    title = title.replace("4 -Year", "4-Year")
    upper = title.upper()
    if upper in DISPLAY_RENAMES:
        return DISPLAY_RENAMES[upper]
    if upper.startswith("BCOM 4-YEAR AUGMENTED:"):
        suffix = title.split(":", 1)[1].strip()
        return f"BCom 4-Year Augmented ({suffix})"
    return title.title().replace("Bcom", "BCom").replace("Badmin", "BAdmin")


def line_starts_new_record(line: str) -> bool:
    if HEADING_RE.match(line) or PLAIN_HEADING_RE.match(line):
        return True
    if YEAR_RE.match(line) or SEMESTER_RE.match(line):
        return True
    return bool(re.match(r"^(First Semester Second Semester|Electives|Choose only|OR\b|Academic Structure|No intake|NO STUDENT INTAKE)", line, re.I))


def line_is_continuation(line: str) -> bool:
    if not line:
        return False
    if line_starts_new_record(line):
        return False
    return not bool(re.match(r"^(?:[0-9][A-Z]{2,4}\d{3}|CBCTM1|APHP112)\b", line))


def preprocess_page_lines(text: str) -> list[str]:
    cleaned = []
    for raw in text.splitlines():
        line = normalize_text(raw).strip()
        if not line:
            continue
        if line.startswith("FACULTY OF COMMERCE") or line == "2026 HANDBOOK" or re.match(r"^Page \d+ of \d+$", line):
            continue
        cleaned.append(line)

    merged: list[str] = []
    for line in cleaned:
        if merged and line_is_continuation(line):
            merged[-1] = f"{merged[-1]} {line}".strip()
        else:
            merged.append(line)
    return merged


def build_credit_map(pages: list[str]) -> dict[str, int]:
    credits: dict[str, int] = {}
    for text in pages:
        norm = normalize_text(text)
        for match in CREDIT_ROW_RE.finditer(norm):
            code = match.group(1).upper()
            credit = int(match.group(2))
            if 4 <= credit <= 120:
                credits.setdefault(code, credit)
    return credits


def collect_headings(pages: list[str]) -> list[dict[str, Any]]:
    headings: list[dict[str, Any]] = []
    for index, text in enumerate(pages, start=1):
        lines = preprocess_page_lines(text)
        for line in lines[:8]:
            match = HEADING_RE.match(line) or PLAIN_HEADING_RE.match(line)
            if not match:
                continue
            title = normalize_text(match.group(1)).strip()
            code = match.group(2).upper()
            upper_title = title.upper()
            if upper_title in SKIP_TITLES:
                continue
            headings.append({"page": index, "title": title, "code": code})
            break
    return headings


def clean_module_name(value: str) -> str:
    name = normalize_text(value)
    name = re.sub(r"\( ?Continue ?\)", "", name, flags=re.I)
    name = name.replace(";", "")
    name = re.sub(r"\s+\(\d+\s+credits\)", "", name, flags=re.I)
    name = re.sub(r"\s{2,}", " ", name).strip(" -")
    return name


def paired_modules_from_line(line: str, current_year: int, credits: dict[str, int], is_core: bool) -> list[dict[str, Any]]:
    matches = list(MODULE_CODE_RE.finditer(line))
    if not matches:
        return []
    modules: list[dict[str, Any]] = []
    if len(matches) >= 2:
        first, second = matches[0], matches[1]
        code1 = first.group(0).upper()
        code2 = second.group(0).upper()
        name1 = clean_module_name(line[first.end():second.start()])
        name2 = clean_module_name(line[second.end():])
        if name1:
            modules.append({
                "code": code1,
                "name": name1,
                "credits": credits.get(code1),
                "semester": 1,
                "yearOfStudy": current_year,
                "isCore": is_core,
                "durationType": "semester",
                "durationLabel": "Semester 1",
            })
        if name2:
            modules.append({
                "code": code2,
                "name": name2,
                "credits": credits.get(code2),
                "semester": 2,
                "yearOfStudy": current_year,
                "isCore": is_core,
                "durationType": "semester",
                "durationLabel": "Semester 2",
            })
    else:
        match = matches[0]
        code = match.group(0).upper()
        name = clean_module_name(line[match.end():])
        if name:
            modules.append({
                "code": code,
                "name": name,
                "credits": credits.get(code),
                "semester": None,
                "yearOfStudy": current_year,
                "isCore": is_core,
                "durationType": "year",
                "durationLabel": "Year module",
            })
    return modules


def single_semester_module_from_line(line: str, current_year: int, current_semester: int | None, credits: dict[str, int], is_core: bool) -> list[dict[str, Any]]:
    match = MODULE_CODE_RE.search(line)
    if not match:
        return []
    code = match.group(0).upper()
    name = clean_module_name(line[match.end():])
    if not name:
        return []
    return [{
        "code": code,
        "name": name,
        "credits": credits.get(code),
        "semester": current_semester,
        "yearOfStudy": current_year,
        "isCore": is_core,
        "durationType": "semester" if current_semester else "year",
        "durationLabel": f"Semester {current_semester}" if current_semester else "Year module",
    }]


def extract_modules(block_lines: list[str], credit_map: dict[str, int], course_code: str) -> list[dict[str, Any]]:
    modules: list[dict[str, Any]] = []
    current_year: int | None = None
    mode: str | None = None
    current_semester: int | None = None
    is_core = True

    for line in block_lines:
        if YEAR_RE.match(line):
            current_year = int(YEAR_RE.match(line).group(1))
            mode = None
            current_semester = None
            is_core = True
            continue
        if re.match(r"^First Semester Second Semester$", line, re.I):
            mode = "paired"
            current_semester = None
            continue
        if SEMESTER_RE.match(line):
            current_semester = int(SEMESTER_RE.match(line).group(1))
            mode = "single"
            continue
        if line.lower().startswith("electives") or line.lower().startswith("choose only"):
            is_core = False
            mode = "paired"
            continue
        if line == "OR":
            continue
        if current_year is None:
            continue
        if not MODULE_CODE_RE.search(line):
            continue

        if course_code == "2LEDG1" and is_core is False:
            modules.extend(paired_modules_from_line(line, current_year, credit_map, False))
            continue

        if mode == "paired":
            modules.extend(paired_modules_from_line(line, current_year, credit_map, is_core))
        else:
            modules.extend(single_semester_module_from_line(line, current_year, current_semester, credit_map, is_core))

    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    for module in modules:
        key = (module["code"], module["yearOfStudy"], module["semester"], module["isCore"])
        current = deduped.get(key)
        if current is None:
            deduped[key] = module
            continue
        if len(module["name"]) > len(current["name"]):
            current["name"] = module["name"]
        if current.get("credits") is None and module.get("credits") is not None:
            current["credits"] = module["credits"]

    return sorted(deduped.values(), key=lambda item: (item["yearOfStudy"], item["semester"] if item["semester"] is not None else 9, item["code"]))


def parse_courses() -> list[dict[str, Any]]:
    reader = PdfReader(str(SOURCE))
    pages = [page.extract_text() or "" for page in reader.pages]
    credit_map = build_credit_map(pages)
    headings = collect_headings(pages)

    courses: list[dict[str, Any]] = []
    for index, heading in enumerate(headings):
        start_page = heading["page"]
        end_page = headings[index + 1]["page"] - 1 if index + 1 < len(headings) else len(pages)
        block_pages = pages[start_page - 1:end_page]
        block_text = "\n".join(block_pages)
        if "Academic Structure" not in block_text:
            continue
        if heading["code"] in NO_INTAKE_CODES or "NO STUDENT INTAKE" in normalize_text(block_text).upper():
            continue
        block_lines: list[str] = []
        for text in block_pages:
            block_lines.extend(preprocess_page_lines(text))
        modules = extract_modules(block_lines, credit_map, heading["code"])
        if len(modules) < 4:
            continue
        years = [module["yearOfStudy"] for module in modules if module.get("yearOfStudy") is not None]
        duration_years = max(years) if years else 1
        course_name = clean_title(heading["title"])
        courses.append({
            "id": f"unizulu-fcal-{slugify(heading['code'])}",
            "name": course_name,
            "qualificationCode": heading["code"],
            "faculty": "Commerce, Administration and Law",
            "school": None,
            "campuses": [],
            "deliveryMode": "Yearbook",
            "durationYears": duration_years,
            "source": "yearbook",
            "sourceLabel": "University of Zululand FCAL Handbook 2026",
            "sourceDocument": str(SOURCE),
            "modules": modules,
        })

    deduped: dict[str, dict[str, Any]] = {}
    for course in courses:
        key = f"{course['name']}|{course['qualificationCode']}"
        current = deduped.get(key)
        if current is None or len(course["modules"]) > len(current["modules"]):
            deduped[key] = course
    return sorted(deduped.values(), key=lambda item: item["name"])


def main() -> None:
    courses = parse_courses()
    payload = {
        "institutionName": "University of Zululand",
        "displayName": "University of Zululand",
        "academicPeriodType": "semester",
        "academicUnitLabel": "Faculty",
        "campuses": ["KwaDlangezwa", "Richards Bay"],
        "faculties": [
            "Arts",
            "Commerce, Administration and Law",
            "Education",
            "Science, Agriculture and Engineering",
        ],
        "courses": courses,
        "notes": {
            "source": "University of Zululand FCAL Handbook 2026",
            "generatedAt": "2026-03-08",
        },
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(courses)} University of Zululand FCAL courses to {OUTPUT}")


if __name__ == "__main__":
    main()
