/** PostgREST treats `.` and `,` as syntax unless the value is double-quoted. */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/["\\]/g, "")}"`;
}
