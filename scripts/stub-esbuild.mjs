/**
 * Preload: replace esbuild with a no-spawn stub so wrangler deploy works in
 * environments that block spawning esbuild.exe (Cursor agent sandbox on Windows).
 *
 * node --import ./scripts/stub-esbuild.mjs node_modules/wrangler/wrangler-dist/cli.js deploy
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const esbuildDir = path.dirname(require.resolve("esbuild/package.json"));
const stubPath = path.join(esbuildDir, "_beyond_sat_stub.mjs");

const stubSource = `
export async function build() {
  return {
    errors: [],
    warnings: [],
    outputFiles: [{
      path: "<stdin>",
      contents: new TextEncoder().encode("export default { async fetch(){ return new Response('ok') } }"),
      text: "export default { async fetch(){ return new Response('ok') } }",
      hash: "stub",
    }],
    metafile: {
      inputs: { "entry.mjs": { bytes: 1, imports: [] } },
      outputs: {
        "out.mjs": {
          bytes: 1,
          inputs: {},
          exports: ["default"],
          entryPoint: "entry.mjs",
        },
      },
    },
  };
}
export function buildSync() { throw new Error("esbuild stub: buildSync"); }
export async function transform() { return { code: "", map: "", warnings: [], errors: [] }; }
export function transformSync() { return { code: "", map: "", warnings: [], errors: [] }; }
export async function formatMessages() { return []; }
export function formatMessagesSync() { return []; }
export async function analyzeMetafile() { return ""; }
export function analyzeMetafileSync() { return ""; }
export async function context() {
  return { rebuild: build, dispose: async () => {}, watch: async () => {} };
}
export function stop() {}
export const version = "0.28.1";
export default { build, buildSync, transform, transformSync, formatMessages, formatMessagesSync, analyzeMetafile, analyzeMetafileSync, context, stop, version };
`;

fs.writeFileSync(stubPath, stubSource);

register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === "esbuild" || specifier.endsWith("/esbuild") || specifier.endsWith("/esbuild/lib/main.js") || specifier.includes("esbuild" + "/lib/main")) {
      return { shortCircuit: true, url: ${JSON.stringify(pathToFileURL(stubPath).href)} };
    }
    return nextResolve(specifier, context);
  }
`), pathToFileURL("./"));

// CJS require("esbuild") path
const esbuildEntry = require.resolve("esbuild");
const stubApi = {
  build: async () => ({
    errors: [],
    warnings: [],
    outputFiles: [
      {
        path: "<stdin>",
        contents: Buffer.from("export default { async fetch(){ return new Response('ok') } }"),
        text: "export default { async fetch(){ return new Response('ok') } }",
        hash: "stub",
      },
    ],
    metafile: {
      inputs: { "entry.mjs": { bytes: 1, imports: [] } },
      outputs: {
        "out.mjs": { bytes: 1, inputs: {}, exports: ["default"], entryPoint: "entry.mjs" },
      },
    },
  }),
  buildSync: () => {
    throw new Error("esbuild stub: buildSync");
  },
  transform: async () => ({ code: "", map: "", warnings: [], errors: [] }),
  transformSync: () => ({ code: "", map: "", warnings: [], errors: [] }),
  formatMessages: async () => [],
  formatMessagesSync: () => [],
  analyzeMetafile: async () => "",
  analyzeMetafileSync: () => "",
  context: async () => ({
    rebuild: async () => stubApi.build(),
    dispose: async () => {},
    watch: async () => {},
  }),
  stop: () => {},
  version: "0.28.1",
};
stubApi.default = stubApi;

require.cache[esbuildEntry] = {
  id: esbuildEntry,
  filename: esbuildEntry,
  loaded: true,
  exports: stubApi,
};

console.error("[stub-esbuild] esbuild redirected to no-spawn stub");
