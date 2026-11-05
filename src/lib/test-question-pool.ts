/** The test editor lists the newest questions in a section. A test can still
 *  point at older rows, and those have to stay visible in the test itself. */
export function mergeLinkedQuestions<T extends { id: string }>(recent: T[], linked: T[]): T[] {
  if (linked.length === 0) return recent;
  const seen = new Set(recent.map((question) => question.id));
  const missing = linked.filter((question) => !seen.has(question.id));
  return missing.length === 0 ? recent : [...missing, ...recent];
}
