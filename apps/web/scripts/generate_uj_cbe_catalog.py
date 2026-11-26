from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from pypdf import PdfReader


ROOT = Path(r"C:\Users\molot\Desktop\AI LAB\projects\TDBS\sa-edu-platform")
SOURCE = Path(
    r"C:\Users\molot\Desktop\AI LAB\downloads\uj-cbe-yearbook-2026-pruned\2025\Yearbooks\CBE Undergraduate Yearbook Latest.pdf"
)
OUTPUT = ROOT / "apps" / "web" / "lib" / "generated" / "ujCbeAcademicCatalog.generated.json"

PROGRAM_START_PAGE = 89

HEADING_RE = re.compile(r"CBE\.(\d+)\s+(.+?)\s+\(([A-Z0-9]{4,})\)\s*$")
ROW_CODE_CREDIT_RE = re.compile(r"\b([A-Z]{2,7}[0-9A-Z]{3,6})\s+(\d{1,2})\b")
ROW_CODE_FIRST_RE = re.compile(r"^([A-Z]{2,7}[0-9A-Z]{3,6})\s+(.+?)\s+(\d{1,2})$")

YEAR_LOOKUP = {
    "FOUNDATION YEAR": 0,
    "FIRST YEAR": 1,
    "SECOND YEAR": 2,
    "THIRD YEAR": 3,
    "FOURTH YEAR": 4,
    "FIFTH YEAR": 5,
    "SIXTH YEAR": 6,
}

COURSE_INCLUDE_PATTERNS = (
    "DIPLOMA",
    "ADVANCED DIPLOMA",
    "BCOM",
    "BACHELOR OF",
)
COURSE_EXCLUDE_PATTERNS = (
    "PROGRAMMES",
    "QUALIFICATIONS OFFERED",
    "ALPHABETICAL LIST",
    "SECTION ",
)

SUBJECT_CODE_BLACKLIST = {
    "NQF",
    "APS",
    "CBE",
    "FULL",
    "TIME",
    "YEAR",
    "CREDITS",
}


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return normalized or "course"


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
        "\u2022": " ",
        "\uf0b7": " ",
        "\x00": " ",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def normalize_heading_title(title: str, code: str) -> str:
    title = " ".join(normalize_text(title).split())
    title = title.replace("BCOM ", "BCOM ")
    if title == "BCOM" and code == "ACCOUNTING":
        return "BCOM (ACCOUNTING)"
    if title == "BCOM" and code == "ACCOUNTANCY":
        return "BCOM (ACCOUNTANCY)"
    if title == "BCOM" and code == "FINANCE":
        return "BCOM (FINANCE)"
    if title == "BACHELOR OF ARTS" and code == "BA":
        return "BACHELOR OF ARTS"
    if title == "BACHELOR OF COMMERCE" and code == "BCOM":
        return "BACHELOR OF COMMERCE"
    if title == "EXTENDED DIPLOMA" and code == "LOGISTICS":
        return "EXTENDED DIPLOMA (LOGISTICS)"
    return title


def is_course_heading(title: str) -> bool:
    title_upper = title.upper()
    if not any(pattern in title_upper for pattern in COURSE_INCLUDE_PATTERNS):
        return False
    if any(pattern in title_upper for pattern in COURSE_EXCLUDE_PATTERNS):
        return False
    return True


def clean_module_name(value: str) -> str:
    text = normalize_text(value)
    text = re.sub(r"\b(FIRST|SECOND)\s+SEMESTER\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(MODULE NAME|MODULE CODE|NQF|CREDITS?|MODULES?)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+\d{1,2}$", "", text)
    text = " ".join(text.split(" ,"))
    text = re.sub(r"\s{2,}", " ", text).strip(" -:")
    return text


def parse_semester_row(line: str) -> list[tuple[str, str, int]]:
    matches = list(ROW_CODE_CREDIT_RE.finditer(line))
    if not matches:
        return []
    if len(matches) == 1:
        match = matches[0]
        code = match.group(1).upper()
        credits = int(match.group(2))
        if code in SUBJECT_CODE_BLACKLIST:
            return []
        name = clean_module_name(line[: match.start()])
        if not name:
            return []
        return [(name, code, credits)]

    parsed: list[tuple[str, str, int]] = []
    first = matches[0]
    second = matches[1]

    code_one = first.group(1).upper()
    if code_one not in SUBJECT_CODE_BLACKLIST:
        name_one = clean_module_name(line[: first.start()])
        if name_one:
            parsed.append((name_one, code_one, int(first.group(2))))

    code_two = second.group(1).upper()
    if code_two not in SUBJECT_CODE_BLACKLIST:
        name_two = clean_module_name(line[first.end() : second.start()])
        if name_two:
            parsed.append((name_two, code_two, int(second.group(2))))

    return parsed


def parse_code_first_row(line: str) -> tuple[str, str, int] | None:
    match = ROW_CODE_FIRST_RE.match(line)
    if not match:
        return None
    code = match.group(1).upper()
    if code in SUBJECT_CODE_BLACKLIST:
        return None
    name = clean_module_name(match.group(2))
    credits = int(match.group(3))
    if not name:
        return None
    return name, code, credits


def build_program_blocks() -> list[dict[str, Any]]:
    reader = PdfReader(str(SOURCE))
    pages = [normalize_text(page.extract_text() or "") for page in reader.pages]

    headings: list[dict[str, Any]] = []
    for index, text in enumerate(pages[PROGRAM_START_PAGE - 1 :], start=PROGRAM_START_PAGE):
        for raw_line in text.splitlines():
            line = " ".join(raw_line.split())
            if not line.startswith("CBE."):
                continue
            match = HEADING_RE.match(line)
            if not match:
                continue
            title = normalize_heading_title(match.group(2), match.group(3))
            if not is_course_heading(title):
                continue
            headings.append(
                {
                    "page": index,
                    "sequence": int(match.group(1)),
                    "title": title,
                    "code": match.group(3).upper(),
                }
            )

    blocks: list[dict[str, Any]] = []
    for idx, heading in enumerate(headings):
        start_page = heading["page"]
        end_page = headings[idx + 1]["page"] - 1 if idx + 1 < len(headings) else len(pages)
        text = "\n".join(pages[start_page - 1 : end_page])
        blocks.append(
            {
                "title": heading["title"],
                "qualificationCode": heading["code"],
                "page": start_page,
                "text": text,
            }
        )
    return blocks


def extract_modules(block_text: str) -> list[dict[str, Any]]:
    lines = [line.strip() for line in block_text.splitlines()]
    modules: list[dict[str, Any]] = []

    current_year: int | None = None
    current_mode: str | None = None
    elective_mode = False
    in_curriculum = False

    for raw_line in lines:
        line = " ".join(raw_line.split())
        if not line:
            continue
        upper = line.upper()

        if "CAROUSEL" in upper:
            break
        if upper.startswith("CURRICULUM"):
            in_curriculum = True
            continue
        if not in_curriculum:
            continue
        if upper.startswith("PROMOTION REQUIREMENTS") or upper.startswith("CONTINUATION OF STUDIES"):
            break

        if upper in YEAR_LOOKUP:
            current_year = YEAR_LOOKUP[upper]
            elective_mode = False
            current_mode = None
            continue

        if "YEAR MODULES" in upper or "PRESENTED OVER A YEAR" in upper:
            current_mode = "year"
            elective_mode = False
            continue

        if upper == "SEMESTER MODULES":
            current_mode = "semester"
            elective_mode = False
            continue

        if "FIRST SEMESTER" in upper and "SECOND SEMESTER" in upper:
            current_mode = "semester-paired"
            elective_mode = False
            continue

        if upper.startswith("ELECTIVES"):
            elective_mode = True
            continue

        if re.match(r"^\d+\s+(SEMESTER|YEAR)\s+MODULE", upper) or upper.endswith("CREDITS") or upper.endswith("CREDITS*"):
            continue

        if current_year is None:
            continue

        if current_mode == "semester-paired":
            paired = parse_semester_row(line)
            if len(paired) == 2:
                left, right = paired
                modules.append(
                    {
                        "code": left[1],
                        "name": left[0],
                        "credits": left[2],
                        "semester": 1,
                        "yearOfStudy": current_year,
                        "isCore": not elective_mode,
                        "durationType": "semester",
                        "durationLabel": "Semester 1",
                    }
                )
                modules.append(
                    {
                        "code": right[1],
                        "name": right[0],
                        "credits": right[2],
                        "semester": 2,
                        "yearOfStudy": current_year,
                        "isCore": not elective_mode,
                        "durationType": "semester",
                        "durationLabel": "Semester 2",
                    }
                )
                continue

            single = parse_code_first_row(line)
            if single:
                modules.append(
                    {
                        "code": single[1],
                        "name": single[0],
                        "credits": single[2],
                        "semester": None,
                        "yearOfStudy": current_year,
                        "isCore": not elective_mode,
                        "durationType": "year",
                        "durationLabel": "Year module",
                    }
                )
                continue

        if current_mode == "year":
            single = parse_code_first_row(line)
            if single:
                modules.append(
                    {
                        "code": single[1],
                        "name": single[0],
                        "credits": single[2],
                        "semester": None,
                        "yearOfStudy": current_year,
                        "isCore": not elective_mode,
                        "durationType": "year",
                        "durationLabel": "Year module",
                    }
                )
                continue

            paired = parse_semester_row(line)
            if len(paired) == 1:
                item = paired[0]
                modules.append(
                    {
                        "code": item[1],
                        "name": item[0],
                        "credits": item[2],
                        "semester": None,
                        "yearOfStudy": current_year,
                        "isCore": not elective_mode,
                        "durationType": "year",
                        "durationLabel": "Year module",
                    }
                )
                continue

        if current_mode in {"semester", "semester-paired"}:
            single = parse_code_first_row(line)
            if single:
                modules.append(
                    {
                        "code": single[1],
                        "name": single[0],
                        "credits": single[2],
                        "semester": None,
                        "yearOfStudy": current_year,
                        "isCore": not elective_mode,
                        "durationType": "year",
                        "durationLabel": "Year module",
                    }
                )
                continue

    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    for module in modules:
        key = (module["code"], module["yearOfStudy"], module["semester"], module["durationType"])
        current = deduped.get(key)
        if not current:
            deduped[key] = module
            continue
        if len(module["name"]) > len(current["name"]):
            current["name"] = module["name"]
        if current["credits"] is None:
            current["credits"] = module["credits"]
        current["isCore"] = current["isCore"] and module["isCore"]

    return sorted(
        deduped.values(),
        key=lambda item: (item["yearOfStudy"], item["semester"] if item["semester"] is not None else 9, item["code"]),
    )


def parse_courses() -> list[dict[str, Any]]:
    blocks = build_program_blocks()
    courses: list[dict[str, Any]] = []

    for block in blocks:
        modules = extract_modules(block["text"])
        years = [module["yearOfStudy"] for module in modules if module["yearOfStudy"] is not None]
        duration_years = max(years) if years else 1
        name = block["title"].title().replace("Bcom", "BCom")
        if name == "Bcom (Accounting)":
            name = "BCom (Accounting)"
        if name == "Bcom (Accountancy)":
            name = "BCom (Accountancy)"
        if name == "Bcom (Finance)":
            name = "BCom (Finance)"
        courses.append(
            {
                "id": f"uj-cbe-{slugify(block['qualificationCode'])}",
                "name": name,
                "qualificationCode": block["qualificationCode"],
                "faculty": "College of Business and Economics",
                "school": None,
                "campuses": [],
                "deliveryMode": "Yearbook",
                "durationYears": duration_years,
                "source": "yearbook",
                "sourceLabel": "UJ CBE Undergraduate Yearbook 2025",
                "sourceDocument": str(SOURCE),
                "modules": modules,
            }
        )

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
        "institutionName": "University of Johannesburg",
        "displayName": "University of Johannesburg",
        "academicPeriodType": "semester",
        "academicUnitLabel": "College",
        "campuses": [],
        "faculties": [
            "College of Business and Economics",
            "Art, Design and Architecture",
            "Education",
            "Engineering and the Built Environment",
            "Health Sciences",
            "Humanities",
            "Law",
            "Science",
        ],
        "courses": courses,
        "notes": {
            "source": "UJ CBE Undergraduate Yearbook 2025",
            "generatedAt": "2026-03-08",
        },
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(courses)} UJ CBE courses to {OUTPUT}")


if __name__ == "__main__":
    main()
