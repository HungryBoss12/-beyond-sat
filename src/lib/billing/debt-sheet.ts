import type { ClassSubject } from "@/lib/classes/types";
import { collectNoteKey, type CollectNote } from "./collect-notes";
import type { BalanceGroup, BalanceRow } from "./types";

export type DebtSideRow = {
  userId: string;
  classId: string;
  subject: ClassSubject;
  name: string;
  groups: string;
  debt: number;
  expectOn: string;
  reason: string;
};

export type DebtSheet = {
  title: string;
  english: DebtSideRow[];
  math: DebtSideRow[];
};

export function parentClassLabel(name: string): string {
  return name.replace(/\s+(eng|english|maths|math)$/i, "").trim() || name;
}

function sheetTitle(name: string): string {
  const title = name.replace(/[\\/*?:\[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (title || "Class").slice(0, 31);
}

function classKey(group: BalanceGroup): string {
  return group.class_id || `name:${parentClassLabel(group.name)}`;
}

function classTitle(groups: readonly BalanceGroup[], classNames: ReadonlyMap<string, string>): string {
  const id = groups.find((group) => group.class_id)?.class_id;
  const named = id ? classNames.get(id) : undefined;
  if (named) return named;
  const labels = groups.map((group) => parentClassLabel(group.name)).filter(Boolean).sort();
  return labels[0] || "Class";
}

/** Whole classes by name, then single-subject groups. The same text on every sheet. */
export function placementGroups(
  groups: readonly BalanceGroup[],
  classNames: ReadonlyMap<string, string> = new Map(),
): string {
  const byClass = new Map<string, BalanceGroup[]>();
  for (const group of groups) {
    const key = classKey(group);
    byClass.set(key, [...(byClass.get(key) ?? []), group]);
  }
  const whole: string[] = [];
  const partial: string[] = [];
  for (const classGroups of byClass.values()) {
    const subjects = new Set(classGroups.map((group) => group.subject));
    if (subjects.has("ebrw") && subjects.has("math")) {
      whole.push(classTitle(classGroups, classNames));
    } else {
      partial.push(...classGroups.map((group) => group.name));
    }
  }
  whole.sort((a, b) => a.localeCompare(b));
  partial.sort((a, b) => a.localeCompare(b));
  return [...whole, ...partial].join(", ");
}

function uniqueSheetTitle(name: string, used: Set<string>): string {
  const base = sheetTitle(name);
  if (!used.has(base.toLowerCase())) {
    used.add(base.toLowerCase());
    return base;
  }
  for (let n = 2; n < 100; n += 1) {
    const suffix = ` ${n}`;
    const next = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    if (!used.has(next.toLowerCase())) {
      used.add(next.toLowerCase());
      return next;
    }
  }
  return base;
}

export function debtSheets(
  rows: readonly BalanceRow[],
  notes: ReadonlyMap<string, CollectNote>,
  classNames: ReadonlyMap<string, string> = new Map(),
): DebtSheet[] {
  const buckets = new Map<string, { title: string; english: Map<string, DebtSideRow>; math: Map<string, DebtSideRow> }>();
  for (const row of rows) {
    if (row.groups.length === 0) continue;
    const placement = placementGroups(row.groups, classNames);
    const debt = row.balance < 0n ? Number(-row.balance) : 0;
    const name = row.full_name?.trim() || row.username?.trim() || "Student";
    const byClass = new Map<string, BalanceGroup[]>();
    for (const group of row.groups) {
      const key = classKey(group);
      byClass.set(key, [...(byClass.get(key) ?? []), group]);
    }
    for (const [key, classGroups] of byClass) {
      const bucket = buckets.get(key) ?? {
        title: classTitle(classGroups, classNames),
        english: new Map<string, DebtSideRow>(),
        math: new Map<string, DebtSideRow>(),
      };
      const classId = classGroups.find((group) => group.class_id)?.class_id ?? "";
      for (const subject of ["ebrw", "math"] as const) {
        if (!classGroups.some((group) => group.subject === subject)) continue;
        const sideMap = subject === "ebrw" ? bucket.english : bucket.math;
        if (sideMap.has(row.user_id)) continue;
        const note = classId ? notes.get(collectNoteKey(row.user_id, classId, subject)) : undefined;
        sideMap.set(row.user_id, {
          userId: row.user_id,
          classId,
          subject,
          name,
          groups: placement,
          debt,
          expectOn: note?.expect_on ?? "",
          reason: note?.reason ?? "",
        });
      }
      buckets.set(key, bucket);
    }
  }
  const used = new Set<string>();
  return [...buckets.values()]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((bucket) => ({
      title: uniqueSheetTitle(bucket.title, used),
      english: [...bucket.english.values()].sort((a, b) => a.name.localeCompare(b.name)),
      math: [...bucket.math.values()].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

const HEADERS = ["N", "Name", "Groups", "Debt", "Expect date", "Reason"] as const;

function sideCells(side: DebtSideRow | undefined, index: number): (string | number)[] {
  if (!side) return ["", "", "", "", "", ""];
  return [index + 1, side.name, side.groups, side.debt, side.expectOn, side.reason];
}

/** One CSV, with each class stacked in the same English | Math columns as the workbook. */
export function debtCsvRows(
  rows: readonly BalanceRow[],
  notes: ReadonlyMap<string, CollectNote>,
  classNames: ReadonlyMap<string, string> = new Map(),
): (string | number)[][] {
  const sheets = debtSheets(rows, notes, classNames);
  const out: (string | number)[][] = [];
  for (const sheet of sheets) {
    if (out.length) out.push([]);
    out.push([sheet.title]);
    out.push(["English", "", "", "", "", "", "", "Math"]);
    out.push([...HEADERS, "", ...HEADERS]);
    const count = Math.max(sheet.english.length, sheet.math.length);
    for (let index = 0; index < count; index += 1) {
      out.push([...sideCells(sheet.english[index], index), "", ...sideCells(sheet.math[index], index)]);
    }
  }
  return out;
}

export async function downloadDebtWorkbook(
  filename: string,
  rows: readonly BalanceRow[],
  notes: ReadonlyMap<string, CollectNote>,
  classNames: ReadonlyMap<string, string> = new Map(),
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheets = debtSheets(rows, notes, classNames);
  const source = sheets.length > 0 ? sheets : [{ title: "Payments", english: [], math: [] }];
  for (const sheet of source) {
    const ws = workbook.addWorksheet(sheet.title);
    ws.mergeCells("A1:M1");
    ws.getCell("A1").value = sheet.title;
    ws.getCell("A1").font = { bold: true, size: 16 };
    ws.mergeCells("A2:F2");
    ws.getCell("A2").value = "English";
    ws.getCell("A2").font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4E89" } };
    ws.mergeCells("H2:M2");
    ws.getCell("H2").value = "Math";
    ws.getCell("H2").font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell("H2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4E89" } };
    HEADERS.forEach((header, index) => {
      const english = ws.getCell(3, index + 1);
      const math = ws.getCell(3, index + 8);
      english.value = header;
      math.value = header;
      english.font = { bold: true };
      math.font = { bold: true };
    });
    const count = Math.max(sheet.english.length, sheet.math.length);
    for (let index = 0; index < count; index += 1) {
      writeSide(ws, 4 + index, 1, sheet.english[index], index + 1);
      writeSide(ws, 4 + index, 8, sheet.math[index], index + 1);
    }
    ws.columns = [
      { width: 6 },
      { width: 28 },
      { width: 36 },
      { width: 14 },
      { width: 16 },
      { width: 28 },
      { width: 3 },
      { width: 6 },
      { width: 28 },
      { width: 36 },
      { width: 14 },
      { width: 16 },
      { width: 28 },
    ];
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function writeSide(
  ws: { getCell: (row: number, col: number) => { value: unknown; numFmt?: string } },
  row: number,
  start: number,
  side: DebtSideRow | undefined,
  number: number,
): void {
  if (!side) return;
  ws.getCell(row, start).value = number;
  ws.getCell(row, start + 1).value = side.name;
  ws.getCell(row, start + 2).value = side.groups;
  const debt = ws.getCell(row, start + 3);
  debt.value = side.debt;
  debt.numFmt = "#,##0";
  ws.getCell(row, start + 4).value = side.expectOn;
  ws.getCell(row, start + 5).value = side.reason;
}
