import hashlib
import json
import os
import re
import sqlite3
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path

import zstandard as zstd

root = Path(__file__).resolve().parent.parent
buf = (root / "public/fixtures/vocab/def-word.colpkg").read_bytes()
z = zipfile.ZipFile(__import__("io").BytesIO(buf))
data = zstd.ZstdDecompressor().decompress(z.read("collection.anki21b"), max_output_size=50 * 1024 * 1024)
fd, tmp = tempfile.mkstemp(suffix=".db")
os.write(fd, data)
os.close(fd)
conn = sqlite3.connect(tmp)
cur = conn.cursor()

SEP = chr(31)
STUB = "please update to the latest anki version"


def strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


cur.execute("SELECT id,name FROM decks")
deck_rows = cur.fetchall()
nodes: dict[str, dict] = {}
order = 0


def ensure(path: str, title: str, parent: str | None, is_folder: bool) -> None:
    global order
    if path in nodes:
        return
    nodes[path] = {
        "path": path,
        "title": title,
        "parentPath": parent,
        "sortOrder": order,
        "isFolder": is_folder,
    }
    order += 1


for did, name in deck_rows:
    if did <= 0:
        continue
    segs = [s for s in name.split(SEP) if s]
    parent = None
    for i, seg in enumerate(segs):
        path = "::".join(segs[: i + 1])
        ensure(path, seg, parent, i < len(segs) - 1)
        parent = path

leaves = [n for n in nodes.values() if not n["isFolder"]]
groups: dict[str, list[str]] = defaultdict(list)
for leaf in leaves:
    if "::" in leaf["path"]:
        continue
    prefix = leaf["title"].split()[0]
    groups[prefix].append(leaf["path"])
for prefix, paths in groups.items():
    if len(paths) < 2:
        continue
    fp = f"__group__::{prefix}"
    ensure(fp, prefix, None, True)
    for p in paths:
        nodes[p]["parentPath"] = fp

for node in nodes.values():
    parent = node.get("parentPath")
    if parent and parent in nodes:
        nodes[parent]["isFolder"] = True

deck_tree = sorted(nodes.values(), key=lambda x: x["sortOrder"])

cur.execute("SELECT id,name FROM decks")
deck_names = dict(cur.fetchall())
cur.execute("SELECT nid,did FROM cards")
note_deck: dict[int, str] = {}
for nid, did in cur.fetchall():
    if nid in note_deck:
        continue
    nm = deck_names.get(did)
    if nm:
        note_deck[nid] = "::".join([s for s in nm.split(SEP) if s])

cur.execute(
    "SELECT nt.id, nt.name, f.ord, f.name FROM notetypes nt JOIN fields f ON f.ntid=nt.id ORDER BY nt.id, f.ord"
)
models: dict[str, dict] = {}
for nid, name, _ord, fname in cur.fetchall():
    models.setdefault(str(nid), {"name": name, "flds": []})["flds"].append({"name": fname})


def field_idx(model: dict, *names: str) -> int:
    lower = [n.lower() for n in names]
    for i, f in enumerate(model.get("flds", [])):
        if f["name"].lower() in lower:
            return i
    return -1


items = []
seen: set[str] = set()
cur.execute("SELECT id,flds,mid FROM notes")
for note_id, flds, mid in cur.fetchall():
    parts = flds.split(SEP)
    model = models.get(str(mid), {"flds": [{"name": "Word"}, {"name": "Definition"}]})
    wi = field_idx(model, "Word", "Front")
    di = field_idx(model, "Definition", "Back")
    ei = field_idx(model, "Example", "Sentence")
    ai = field_idx(model, "Antonym")
    si = field_idx(model, "Set")
    wf = strip_html(parts[wi if wi >= 0 else 0] if parts else "")
    df = strip_html(parts[di if di >= 0 else 1] if len(parts) > 1 else wf)
    ex = strip_html(parts[ei] if ei >= 0 and ei < len(parts) else (parts[2] if len(parts) > 2 else ""))
    ant = strip_html(parts[ai] if ai >= 0 and ai < len(parts) else "")
    st = strip_html(parts[si] if si >= 0 and si < len(parts) else "")
    word = (wf.split("\n")[0] if wf else "").strip()[:120]
    definition = df or wf
    if wf and df and len(wf) > len(df) and len(df) <= 48 and "," not in df:
        word = df.split("\n")[0].strip()[:120]
        definition = wf
    if not word or not definition or STUB in word.lower() or STUB in definition.lower():
        continue
    dp = note_deck.get(note_id, "Imported")
    key = dp + ":" + word.lower()
    if key in seen:
        continue
    seen.add(key)
    items.append(
        {
            "word": word,
            "partOfSpeech": "noun",
            "definition": definition,
            "dsatPassage": ex
            if len(ex) > 40
            else f'In academic writing, the word "{word}" often appears when authors {definition[:80].lower()}…',
            "exampleSentence": ex if len(ex) > 20 else None,
            "antonym": ant or None,
            "setLabel": f"Set {st}" if st else None,
            "ankiDeckPath": dp,
            "synonyms": [],
            "difficultyTier": "Medium",
        }
    )

out = root / "supabase/seed-data/def-word-tree.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({"deckTree": deck_tree, "items": items}, ensure_ascii=False), encoding="utf-8")
print(f"decks {len(deck_tree)} cards {len(items)}")
conn.close()
os.unlink(tmp)
