import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, ".open-next", "server-functions", "default");
const handlerOut = path.join(dir, "handler.mjs");
const indexOut = path.join(dir, "index.mjs");
const appIndex = path.join(dir, "apps", "web", "index.mjs");
const nextServerJ = path.join(dir, "apps", "web", "node_modules", "next", "dist", "server", "next-server.js");
const instGlobalsJ = path.join(dir, "apps", "web", "node_modules", "next", "dist", "server", "lib", "router-utils", "instrumentation-globals.external.js");
const indexExists = indexOut;
try {
  await import(indexExists);
} catch {}

mkdirSync(dir, { recursive: true });
writeFileSync(handlerOut, 'export { handler } from "./index.mjs";\n');
console.log(`patched ${handlerOut}`);

const target = [appIndex, indexOut].filter((p) => {
  try {
    readFileSync(p, "utf8");
    return true;
  } catch {
    return false;
  }
});
for (const t of target) {
  const src = readFileSync(t, "utf8");
  const patched = src
    .replace(/(var cacheHandlerPath\s*=\s*)__require\d*\.resolve\("\.\/cache\.cjs"\)/, "$1undefined")
    .replace(/(var composableCacheHandlerPath\s*=\s*)__require\d*\.resolve\("\.\/composable-cache\.cjs"\)/, "$1undefined")
    .replace(
      /function setNextjsServerWorkingDirectory\(\) \{\n  process\.chdir\(__dirname\);\n\}/,
      "function setNextjsServerWorkingDirectory() {}"
    );
  if (patched !== src) {
    writeFileSync(t, patched);
    console.log(`patched require.resolve in ${t}`);
  } else {
    console.log(`no require.resolve stubs found in ${t}`);
  }
}

let nsSrc;
try {
  nsSrc = readFileSync(nextServerJ, "utf8");
} catch {
  nsSrc = "";
}
if (nsSrc.includes("getBuildId() {") && nsSrc.includes("process.env.NEXT_BUILD_ID;") === false) {
  const start = nsSrc.indexOf("getBuildId() {");
  const mid = nsSrc.indexOf("const buildIdFile =", start);
  const from = nsSrc.indexOf("readFileSync", mid);
  const end = nsSrc.indexOf("\n    }\n", from);
  if (start !== -1 && mid !== -1 && from !== -1 && end !== -1) {
    const patchedNs = nsSrc.slice(0, start) + 'getBuildId() {\n    return process.env.NEXT_BUILD_ID;\n  }\n' + nsSrc.slice(end + "\n    }\n".length);
    writeFileSync(nextServerJ, patchedNs);
    console.log(`patched getBuildId in ${nextServerJ}`);
  } else {
    console.log(`getBuildId patch: could not locate boundaries in ${nextServerJ}`);
  }
} else {
  console.log(`getBuildId already patched or not found in ${nextServerJ}`);
}

const lnmStart = "async loadNodeMiddleware() {";
nsSrc = readFileSync(nextServerJ, "utf8");
if (nsSrc.includes(lnmStart) && nsSrc.includes("require((0, _path.join)(/* turbopackIgnore: true */ this.distDir, 'server', _constants.FUNCTIONS_CONFIG_MANIFEST))")) {
  const s = nsSrc.indexOf(lnmStart);
  const cmt = "    /**\n   * Checks if a middleware exists.";
  const tail = nsSrc.indexOf(cmt, s);
  if (s !== -1 && tail !== -1) {
    const stub = "async loadNodeMiddleware() {\n        return undefined;\n    }\n";
    writeFileSync(nextServerJ, nsSrc.slice(0, s) + stub + nsSrc.slice(tail));
    console.log(`patched loadNodeMiddleware in ${nextServerJ}`);
  } else {
    console.log(`loadNodeMiddleware patch: boundaries not found in ${nextServerJ}`);
  }
} else {
  console.log(`loadNodeMiddleware already patched or not found in ${nextServerJ}`);
}

nsSrc = readFileSync(nextServerJ, "utf8");
const gmmStart = "getMiddlewareManifest() {";
if (nsSrc.includes(gmmStart) && nsSrc.includes("const manifest = require(this.middlewareManifestPath);")) {
  const gmmTail = nsSrc.indexOf("    /** Returns the middleware routing item if there is one. */ async getMiddleware() {", nsSrc.indexOf(gmmStart));
  if (gmmTail !== -1) {
    writeFileSync(nextServerJ, nsSrc.slice(0, nsSrc.indexOf(gmmStart)) + "getMiddlewareManifest() {\n        return null;\n    }\n" + nsSrc.slice(gmmTail));
    console.log(`patched getMiddlewareManifest in ${nextServerJ}`);
  } else {
    console.log(`getMiddlewareManifest patch: boundary not found in ${nextServerJ}`);
  }
} else {
  console.log(`getMiddlewareManifest already patched or not found in ${nextServerJ}`);
}

nsSrc = readFileSync(nextServerJ, "utf8");
const gedStart = "getEnabledDirectories(dev) {";
if (nsSrc.includes(gedStart) && nsSrc.includes("app: (0, _findpagesdir.findDir)(dir, 'app') ? true : false,")) {
  const s = nsSrc.indexOf(gedStart);
  const marker = "app: (0, _findpagesdir.findDir)(dir, 'app') ? true : false,";
  const m = nsSrc.indexOf(marker, s);
  if (s !== -1 && m !== -1) {
    writeFileSync(nextServerJ, nsSrc.slice(0, m) + "app: true," + nsSrc.slice(m + marker.length));
    console.log(`patched getEnabledDirectories in ${nextServerJ}`);
  } else {
    console.log(`getEnabledDirectories patch: boundary not found in ${nextServerJ}`);
  }
} else {
  console.log(`getEnabledDirectories already patched or not found in ${nextServerJ}`);
}

let igSrc;
try {
  igSrc = readFileSync(instGlobalsJ, "utf8");
} catch {
  igSrc = "";
}
// Sentry/otel instrumentation hooks (1MB+) require node APIs unavailable or
// undesirable in workerd; neutralize them unconditionally. Replacement is
// idempotent regardless of upstream file shape.
if (!igSrc.includes("_get") || igSrc.includes("return undefined;") || true) {
  try {
    writeFileSync(
      instGlobalsJ,
      '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.ensureInstrumentationRegistered = _ensure;\nexports.getInstrumentationModule = _get;\nexports.instrumentationOnRequestError = _onReqErr;\nasync function _get() { return undefined; }\nasync function _ensure() {}\nasync function _onReqErr() {}\n'
    );
    console.log(`stubbed getInstrumentationModule in ${instGlobalsJ}`);
  } catch (err) {
    console.log(`instrumentation stub: unable to write ${instGlobalsJ}: ${err.message}`);
  }
}

function walk(dirPath, out = []) {
  for (const entry of readdirSync(dirPath)) {
    const full = path.join(dirPath, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}
const posixRel = (from, to) => path.relative(from, to).split(path.sep).join("/");
const stagedDotNext = path.join(dir, "apps", "web", ".next");
const jsonFiles = walk(stagedDotNext).filter((f) => !f.split(path.sep).includes("dev")).filter(
  (f) => /(?:-manifest|required-server-files|prefetch-hints)\.json$/.test(f)
);
const clientRefFiles = walk(stagedDotNext).filter((f) => !f.split(path.sep).includes("dev")).filter((f) => /_client-reference-manifest\.js$/.test(f));

const jsonRows = jsonFiles.map((f) => `  ["${posixRel(stagedDotNext, f)}", ${JSON.stringify(readFileSync(f, "utf8"))}]`);
const evalRows = clientRefFiles.map((f) => {
  const code = readFileSync(f, "utf8");
  const sandbox = { self: { __RSC_MANIFEST: {} }, __RSC_MANIFEST: {} };
  try {
    runInNewContext(code, sandbox);
  } catch {}
  const rsc = sandbox.__RSC_MANIFEST ?? sandbox.self?.__RSC_MANIFEST ?? {};
  return `  ["${posixRel(stagedDotNext, f)}", ${JSON.stringify(JSON.stringify({ __RSC_MANIFEST: rsc }))}]`;
});

const loadManifestModule = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "load-manifest.module.cjs"),
  "utf8"
)
  .replace("__MANIFEST_ROWS__", jsonRows.join(",\n"))
  .replace("__EVAL_ROWS__", evalRows.join(",\n"));
writeFileSync(path.join(dir, "apps", "web", "node_modules", "next", "dist", "server", "load-manifest.external.js"), loadManifestModule);
console.log(`regenerated load-manifest.external.js (${jsonRows.length} json manifests, ${evalRows.length} client-reference manifests)`);

const requireJ = path.join(dir, "apps", "web", "node_modules", "next", "dist", "server", "require.js");
const stagedServerDir = path.join(stagedDotNext, "server");
const routeFiles = walk(stagedServerDir)
  .filter((f) => !f.split(path.sep).includes("dev"))
  .filter((f) => /[\\/](page|route)\.js$/.test(f));
const routePrefix = posixRel(path.dirname(requireJ), stagedServerDir);
const routeRows = routeFiles
  .map((f) => {
    const rel = posixRel(stagedServerDir, f);
    return `    ${JSON.stringify(rel)}: require(${JSON.stringify(`${routePrefix}/${rel}`)})`;
  })
  .join(",\n");
const requireSrc = readFileSync(requireJ, "utf8");
let rpStart = requireSrc.indexOf("const __stagedRoutes = {");
if (rpStart === -1) rpStart = requireSrc.indexOf("async function requirePage(page, distDir, isAppPath) {");
const rpEnd = requireSrc.indexOf("//# sourceMappingURL=require.js.map");
if (rpStart !== -1 && rpEnd !== -1) {
  const replacement = `const __stagedRoutes = {
${routeRows}
};
async function requirePage(page, distDir, isAppPath) {
    const pagePath = getPagePath(page, distDir, undefined, isAppPath);
    const __suffix = pagePath.replace(/^.*?[\\\\/]\\.next[\\\\/]server[\\\\/]/, "");
    const __staged = __stagedRoutes[__suffix];
    if (__staged) return __staged;
    if (pagePath.endsWith('.html')) {
        return _fs.promises.readFile(/* turbopackIgnore: true */ pagePath, 'utf8').catch((err)=>{
            throw new _utils.MissingStaticPage(page, err.message);
        });
    }
    const mod = process.env.NEXT_MINIMAL ? __non_webpack_require__(pagePath) : require(/* turbopackIgnore: true */ pagePath);
    return mod;
}

`;
  writeFileSync(requireJ, requireSrc.slice(0, rpStart) + replacement + requireSrc.slice(rpEnd));
  console.log(`patched requirePage with ${routeFiles.length} staged routes in ${requireJ}`);
} else {
  console.log(`requirePage patch: boundaries not found in ${requireJ}`);
}