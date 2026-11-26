"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _deepfreeze = require("../shared/lib/deep-freeze");
const __MANIFEST_MAP = new Map([
__MANIFEST_ROWS__
]);
const __EVAL_MAP = new Map([
__EVAL_ROWS__
]);
const sharedCache = new Map();
const __BS = String.fromCharCode(92);
function __nextPathKey(p) {
  p = String(p).replaceAll(__BS, "/");
  const idx = p.lastIndexOf("/.next/");
  if (idx !== -1) p = p.slice(idx + 7);
  else if (p.startsWith(".next/")) p = p.slice(6);
  else if (p.startsWith("next/")) p = p.slice(5);
  p = p.replace(/^\//, "").replace(/^\.\//, "");
  return p;
}
function __nextLoadManifest(pathLike) {
  const p = __nextPathKey(pathLike);
  const v = __MANIFEST_MAP.get(p);
  if (v !== undefined) return v;
  if (p.endsWith("BUILD_ID")) return process.env.NEXT_BUILD_ID;
  const stripped = p.replace(/\.json$/, "");
  if (
    stripped.endsWith("react-loadable-manifest") ||
    stripped.endsWith("subresource-integrity-manifest") ||
    stripped.endsWith("server-reference-manifest") ||
    stripped.endsWith("dynamic-css-manifest") ||
    stripped.endsWith("fallback-build-manifest") ||
    stripped.endsWith("prefetch-hints")
  ) {
    return "{}";
  }
  throw new Error(`Unexpected loadManifest(${pathLike}) call!`);
}
function __nextEvalManifest(pathLike) {
  const p = __nextPathKey(pathLike);
  const v = __EVAL_MAP.get(p);
  if (v !== undefined) return v;
  throw new Error(`Unexpected evalManifest(${pathLike}) call!`);
}
function loadManifest(path, shouldCache = true, cache = sharedCache, skipParse = false, handleMissing) {
  const cached = shouldCache && cache.get(path);
  if (cached) return cached;
  let manifest;
  if (handleMissing) {
    try {
      manifest = __nextLoadManifest(path);
    } catch (err) {
      let result = {};
      cache.set(path, result);
      return result;
    }
  } else {
    manifest = __nextLoadManifest(path);
  }
  if (!skipParse) {
    manifest = JSON.parse(manifest);
    if (shouldCache) manifest = (0, _deepfreeze.deepFreeze)(manifest);
  }
  if (shouldCache) cache.set(path, manifest);
  return manifest;
}
function evalManifest(path, shouldCache = true, cache = sharedCache, handleMissing) {
  const cached = shouldCache && cache.get(path);
  if (cached) return cached;
  let content;
  if (handleMissing) {
    try {
      content = __nextEvalManifest(path);
    } catch (err) {
      let result = {};
      cache.set(path, result);
      return result;
    }
  } else {
    content = __nextEvalManifest(path);
  }
  const parsed = JSON.parse(content);
  if (shouldCache) cache.set(path, parsed);
  return parsed;
}
function loadManifestFromRelativePath({ projectDir, distDir, manifest, shouldCache, cache, skipParse, handleMissing, useEval }) {
  const manifestPath = [projectDir, distDir, manifest].filter(Boolean).join("/");
  if (useEval) return evalManifest(manifestPath, shouldCache, cache, handleMissing);
  return loadManifest(manifestPath, shouldCache, cache, skipParse, handleMissing);
}
function clearManifestCache(path, cache = sharedCache) {
  return cache.delete(path);
}
exports.loadManifest = loadManifest;
exports.evalManifest = evalManifest;
exports.loadManifestFromRelativePath = loadManifestFromRelativePath;
exports.clearManifestCache = clearManifestCache;