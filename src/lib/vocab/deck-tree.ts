import type { AnkiDeckNode } from "./types";

const DECK_SEP = "\u001f";

/** Parse Anki deck rows into a path tree with optional prefix grouping for flat names. */
export function buildDeckTreeFromAnki(
  rows: { id: number; name: string }[],
): AnkiDeckNode[] {
  const nodes = new Map<string, AnkiDeckNode>();
  let order = 0;

  function ensure(path: string, title: string, parentPath: string | null, isFolder: boolean) {
    if (nodes.has(path)) return;
    nodes.set(path, {
      path,
      title,
      parentPath,
      sortOrder: order++,
      isFolder,
    });
  }

  for (const row of rows) {
    if (row.id <= 0) continue;
    const segments = row.name.split(DECK_SEP).filter(Boolean);
    if (segments.length === 0) continue;

    let parentPath: string | null = null;
    for (let i = 0; i < segments.length; i++) {
      const slice = segments.slice(0, i + 1);
      const path = slice.join("::");
      const title = segments[i];
      const isFolder = i < segments.length - 1;
      ensure(path, title, parentPath, isFolder);
      parentPath = path;
    }
  }

  // Prefix grouping for flat leaf names like "CP 01", "Ivy 03"
  const leaves = [...nodes.values()].filter((n) => !n.isFolder);
  const prefixGroups = new Map<string, string[]>();

  for (const leaf of leaves) {
    if (leaf.path.includes("::")) continue;
    const prefix = leaf.title.split(/\s+/)[0] ?? leaf.title;
    if (!prefixGroups.has(prefix)) prefixGroups.set(prefix, []);
    prefixGroups.get(prefix)!.push(leaf.path);
  }

  for (const [prefix, paths] of prefixGroups) {
    if (paths.length < 2) continue;
    const folderPath = `__group__::${prefix}`;
    if (!nodes.has(folderPath)) {
      ensure(folderPath, prefix, null, true);
    }
    for (const p of paths) {
      const node = nodes.get(p);
      if (node) {
        node.parentPath = folderPath;
      }
    }
  }

  return [...nodes.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Resolve leaf deck path for a note from Anki card deck id. */
export function deckPathFromAnkiName(name: string): string {
  const segments = name.split(DECK_SEP).filter(Boolean);
  if (segments.length === 0) return "Imported";
  return segments.join("::");
}
