import fs from "fs";

function stripTypes(s) {
  return s
    .replace(/^import .*$/gm, "")
    .replace(/^export type .*$/gm, "")
    .replace(/^type .*$/gm, "")
    .replace(/new Map<[^>]+>/g, "new Map")
    .replace(/Promise<[^>]+>/g, "Promise")
    .replace(/ as BlobPart/g, "")
    .replace(/ as "superscript" \| "subscript"/g, "")
    .replace(/: Record<string, string>/g, "")
    .replace(/: \{[^}]+\}/g, "")
    .replace(/: [A-Za-z0-9_<>\[\]|&?,\s."']+(?=;)/g, "")
    .replace(/\): [A-Za-z0-9_<>\[\]|&?,\s."']+ \{/g, ") {")
    .replace(/\([^)]*: [^)]+\)/g, (m) =>
      m.replace(/: [A-Za-z0-9_<>\[\]|&?,\s."']+/g, ""),
    );
}

let docx = stripTypes(fs.readFileSync("scripts/lib/read-docx-blocks.mjs", "utf8"));
docx += `\nimport fs from "fs";\nexport async function readDocxBlocks(filePath) {
  const buf = fs.readFileSync(filePath).buffer;
  return readDocx(new Blob([buf]));
}\n`;
fs.writeFileSync("scripts/lib/read-docx-blocks.mjs", docx);

const FIGURE = "[FIGURE NEEDED — add an image URL for this question]";
let parse = `const FIGURE_MARKER = ${JSON.stringify(FIGURE)};\n`;
parse += stripTypes(fs.readFileSync("scripts/lib/parse-blocks.mjs", "utf8"))
  .replace(/Array<string \| SourceBlock>/g, "Array")
  .replace(/\[RegExp, string\]\[\]/g, "Array");
fs.writeFileSync("scripts/lib/parse-blocks.mjs", parse);
console.log("stripped");
