/** Course-fee notes name the parent class. Show the sub-groups instead. */
export function subgroupNote(note: string | null, groupNames: string[]): string | null {
  if (!note || groupNames.length === 0 || !note.startsWith("Course fee")) return note;
  const parts = note.split(" · ");
  if (parts.length < 3) return note;
  parts[2] = groupNames.join(" + ");
  return parts.join(" · ");
}

export function withSubgroupNotes<
  T extends {
    kind: string;
    note: string | null;
    class_id?: string | null;
    group_name?: string | null;
  },
>(rows: T[], namesForClass: (classId: string | null | undefined) => string[]): T[] {
  return rows.map((row) => {
    if (row.kind !== "charge") return row;
    const names = namesForClass(row.class_id);
    if (!names.length) return row;
    return {
      ...row,
      note: subgroupNote(row.note, names),
      group_name: row.group_name ?? names.join(" + "),
    };
  });
}
