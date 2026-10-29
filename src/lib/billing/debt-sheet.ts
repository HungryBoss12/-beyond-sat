import type { ClassSubject } from "@/lib/classes/types";
import { collectNoteKey, type CollectNote } from "./collect-notes";
import type { BalanceRow } from "./types";

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
  const title = parentClassLabel(name).replace(/[\\/*?:\[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (title || "Class").slice(0, 31);
}

export function debtSheets(rows: readonly BalanceRow[], notes: ReadonlyMap<string, CollectNote>): DebtSheet[] {
  const sheets = new Map<string, DebtSheet>();
  for (const row of rows) {
    if (!row.class_id || !row.class_name) continue;
    const title = sheetTitle(row.class_name);
    const sheet = sheets.get(title) ?? { title, english: [], math: [] };
    const debt = row.balance < 0n ? Number(-row.balance) : 0;
    for (const subject of ["ebrw", "math"] as const) {
      const groups = row.groups.filter((group) => group.subject === subject);
      if (groups.length === 0) continue;
      const note = notes.get(collectNoteKey(row.user_id, row.class_id, subject));
      const side: DebtSideRow = {
        userId: row.user_id,
        classId: row.class_id,
        subject,
        name: row.full_name?.trim() || row.username?.trim() || "Student",
        groups: groups.map((group) => group.name).join(", "),
        debt,
        expectOn: note?.expect_on ?? "",
        reason: note?.reason ?? "",
      };
      if (subject === "ebrw") sheet.english.push(side);
      else sheet.math.push(side);
    }
    sheets.set(title, sheet);
  }
  for (const sheet of sheets.values()) {
    sheet.english.sort((a, b) => a.name.localeCompare(b.name));
    sheet.math.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...sheets.values()].sort((a, b) => a.title.localeCompare(b.title));
}

const HEADERS = ["N", "Name", "Groups", "Debt", "Expect date", "Reason"] as const;

export async function downloadDebtWorkbook(
  filename: string,
  rows: readonly BalanceRow[],
  notes: ReadonlyMap<string, CollectNote>,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheets = debtSheets(rows, notes);
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
      { width: 22 },
      { width: 14 },
      { width: 16 },
      { width: 28 },
      { width: 3 },
      { width: 6 },
      { width: 28 },
      { width: 22 },
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
