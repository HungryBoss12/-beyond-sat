"""Active students from Total work(2).xlsx.

Column A is the name. The header row and phone-number cells are skipped.
Two or more empty name cells in a row, after the first real name, end the
active list. Names below that gap are inactive. A single empty row does not.
"""
import json
import re
import sys

import openpyxl

PATH = r"c:\Users\javaz\Downloads\Total work(2).xlsx"

SHEETS = {
    "Eng14": ("SAT 14", "ebrw", {"name": 1, "phone": 4, "parent": 5, "grade": 6, "english": 7, "math": 8, "goal": 9}),
    "Math14": ("SAT 14", "math", {"name": 1, "phone": 3, "parent": 4, "grade": 5, "english": 6, "math": 7, "goal": 8}),
    "Eng13": ("SAT 13", "ebrw", {"name": 1, "phone": 3, "parent": 4, "grade": 5, "english": 7, "math": 8, "goal": 9}),
    "Math13": ("SAT 13", "math", {"name": 1, "phone": 3, "parent": 4, "grade": 5, "english": 6, "math": 7, "goal": 8}),
    "Eng12": ("SAT 12", "ebrw", {"name": 1, "phone": 3, "parent": 4, "grade": 5, "english": 6, "math": 7, "goal": 8}),
    "Math12": ("SAT 12", "math", {"name": 1, "phone": 2, "parent": 3, "grade": 4, "english": 5, "math": 6, "goal": 7}),
    "Eng10": ("SAT 10", "ebrw", {"name": 1, "phone": 3, "parent": 4, "grade": 5, "english": 6, "math": 7, "goal": 8}),
    "Math10": ("SAT 10", "math", {"name": 1, "phone": 3, "parent": 4, "grade": 5, "english": 6, "math": 7, "goal": 8}),
    "PreE": ("Pre-SAT", "ebrw", {"name": 1, "phone": 3, "parent": 4, "grade": 5, "english": 6, "math": 7, "goal": 8}),
    "PreM": ("Pre-SAT", "math", {"name": 1, "phone": 3, "parent": 4, "grade": 5, "english": 6, "math": 7, "goal": 8}),
}

RANK = {"SAT 14": 5, "SAT 13": 4, "SAT 12": 3, "SAT 10": 2, "Pre-SAT": 1}
LABELS = {"english": "English", "math": "Math", "goal": "Goal"}


def digits(text):
    return len(re.findall(r"\d", text or ""))


def as_phone(value):
    if not value:
        return None
    count = digits(value)
    if count < 9 or count > 15:
        return None
    if re.search(r"[A-Za-z]", value):
        return None
    return value


def as_grade(value):
    if not value:
        return None
    if re.search(r"sinf|bitir", value, re.I):
        return value
    if re.fullmatch(r"\d+(\.0)?", value):
        number = int(float(value))
        if 8 <= number <= 12:
            return str(number)
    return None


def as_note(value):
    if not value:
        return None
    if re.fullmatch(r"[\d.\s~+\-/]+", value):
        return None
    if re.fullmatch(r"(d|done|n\.?a\.?|-|\?\?\?|shu hafta|ertaga|continue|qilindi|x)", value, re.I):
        return None
    if len(value) < 2:
        return None
    return value[:200]


def norm_name(raw):
    text = raw.strip().lower().replace("'", "").replace("’", "")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+\d*\s*hafta.*$", "", text).strip()
    return text


def display_name(raw):
    text = re.sub(r"\s+", " ", raw.strip())
    text = re.sub(r"\s+\d*\s*hafta.*$", "", text, flags=re.I).strip()
    return text


def add_line(lines, seen, label, text):
    note = as_note(text)
    if not note:
        return
    key = note.lower()
    if key in seen:
        return
    seen.add(key)
    lines.append(f"{label}: {note}" if label else note)


def is_name(text):
    if not text or text in ("Name", "`"):
        return False
    if re.fullmatch(r"[\d\s.+]+", text):
        return False
    return True


def main():
    wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)
    by_class = {}
    for sheet, (class_name, subject, cols) in SHEETS.items():
        ws = wb[sheet]
        mapped = set(cols.values())
        seen_name = False
        empty_run = 0
        for row in ws.iter_rows(min_row=1, max_col=12):
            raw_cells = []
            for cell in row:
                if cell.value is None:
                    raw_cells.append("")
                else:
                    raw_cells.append(str(cell.value).strip())
            name_cell = raw_cells[0] if raw_cells else ""
            if not name_cell:
                empty_run += 1
                if seen_name and empty_run >= 2:
                    break
                continue
            empty_run = 0
            if not is_name(name_cell):
                continue
            seen_name = True
            values = {}
            extras = []
            for index, text in enumerate(raw_cells, start=1):
                if not text:
                    continue
                hit = False
                for key, col in cols.items():
                    if col == index:
                        hit = True
                        if key != "name":
                            values[key] = text
                if not hit:
                    extras.append(text)
            key = norm_name(name_cell)
            if not key:
                continue
            bucket = by_class.setdefault(class_name, {})
            person = bucket.get(key)
            if person is None:
                person = {
                    "className": class_name,
                    "name": display_name(name_cell),
                    "norm": key,
                    "tokens": len(key.split()),
                    "subjects": [],
                    "phone": None,
                    "parentPhone": None,
                    "grade": None,
                    "englishNote": None,
                    "mathNote": None,
                    "goal": None,
                    "lines": [],
                    "seen": set(),
                    "alsoClasses": [],
                }
                bucket[key] = person
            if subject not in person["subjects"]:
                person["subjects"].append(subject)
            person["phone"] = person["phone"] or as_phone(values.get("phone"))
            person["parentPhone"] = person["parentPhone"] or as_phone(values.get("parent"))
            person["grade"] = person["grade"] or as_grade(values.get("grade"))
            person["englishNote"] = person["englishNote"] or as_note(values.get("english"))
            person["mathNote"] = person["mathNote"] or as_note(values.get("math"))
            person["goal"] = person["goal"] or as_note(values.get("goal"))
            for field in ("english", "math", "goal"):
                text = values.get(field)
                label = LABELS[field]
                if field == "math" and text and re.search(
                    r"sertif|olymp|tugat|diplom|univer|itali|narxoz|biznes", text, re.I
                ):
                    label = "Achievement"
                add_line(person["lines"], person["seen"], label, text)
            for extra in extras:
                add_line(person["lines"], person["seen"], "Achievement", extra)

    kept = {}
    for class_name, people in by_class.items():
        for key, person in people.items():
            if person["tokens"] < 2:
                kept[f"{class_name}|{key}"] = person
                continue
            current = kept.get(key)
            if current is None or RANK[class_name] > RANK[current["className"]]:
                if current is not None and class_name not in current["alsoClasses"]:
                    person["alsoClasses"] = list(dict.fromkeys([*person["alsoClasses"], current["className"], *current["alsoClasses"]]))
                kept[key] = person
            else:
                if class_name not in current["alsoClasses"]:
                    current["alsoClasses"].append(class_name)

    out = []
    for person in kept.values():
        person["description"] = "\n".join(person["lines"]) or None
        person["lastWord"] = person["norm"].split()[-1]
        person.pop("tokens")
        person.pop("lines")
        person.pop("seen")
        out.append(person)
    out.sort(key=lambda row: (row["className"], row["name"].lower()))
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
