/**
 * setup-stubs.ts — 一键生成所有缺失模块的桩文件
 *
 * 用法: bun run setup-stubs.ts
 *
 * 源码中有部分模块在公开发布中缺失（内部工具、feature-gated 模块、
 * 资源文件等）。本脚本为它们创建最小桩文件，使源码可以运行。
 */

import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { dirname, join, resolve, relative } from "path";

const srcDir = import.meta.dir;
let createdTs = 0;
let createdRes = 0;
let createdPkg = 0;

// ──────────────────────────────────────────────────────────────────────
// 1. Scan the codebase for missing relative imports and create TS stubs
// ──────────────────────────────────────────────────────────────────────

const missingModules = new Set<string>();

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    if (
      entry === "node_modules" ||
      entry === "claude-code" ||
      entry === ".git"
    )
      continue;
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) scanFile(full);
    } catch {}
  }
}

function scanFile(filePath: string) {
  const content = readFileSync(filePath, "utf-8");
  const dir = dirname(filePath);
  const regex = /(?:from|require\()\s*['"](\.[^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    const rel = m[1]!;
    const base = resolve(dir, rel.replace(/\.jsx?$/, ""));
    const candidates = [
      base + ".ts",
      base + ".tsx",
      base + ".js",
      base + ".jsx",
      base + "/index.ts",
      base + "/index.tsx",
      base + "/index.js",
    ];
    if (!candidates.some((c) => existsSync(c))) {
      missingModules.add(relative(srcDir, base));
    }
  }
}

walk(srcDir);

for (const mod of missingModules) {
  // Skip .md and .txt — handled in resource stubs below
  if (mod.endsWith(".md") || mod.endsWith(".txt")) continue;

  const filePath = join(srcDir, mod + ".ts");
  if (existsSync(filePath) || existsSync(filePath + "x")) continue;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    "// Auto-generated stub for missing module\nexport default null;\nexport {};\n"
  );
  createdTs++;
}

console.log(`Created ${createdTs} TypeScript stub files`);

// ──────────────────────────────────────────────────────────────────────
// 2. Create missing .md / .txt resource stubs
// ──────────────────────────────────────────────────────────────────────

const resourceStubs = [
  "skills/bundled/claude-api/SKILL.md",
  "skills/bundled/claude-api/csharp/claude-api.md",
  "skills/bundled/claude-api/curl/examples.md",
  "skills/bundled/claude-api/go/claude-api.md",
  "skills/bundled/claude-api/java/claude-api.md",
  "skills/bundled/claude-api/php/claude-api.md",
  "skills/bundled/claude-api/python/agent-sdk/README.md",
  "skills/bundled/claude-api/python/agent-sdk/patterns.md",
  "skills/bundled/claude-api/python/claude-api/README.md",
  "skills/bundled/claude-api/python/claude-api/batches.md",
  "skills/bundled/claude-api/python/claude-api/files-api.md",
  "skills/bundled/claude-api/python/claude-api/streaming.md",
  "skills/bundled/claude-api/python/claude-api/tool-use.md",
  "skills/bundled/claude-api/ruby/claude-api.md",
  "skills/bundled/claude-api/shared/error-codes.md",
  "skills/bundled/claude-api/shared/live-sources.md",
  "skills/bundled/claude-api/shared/models.md",
  "skills/bundled/claude-api/shared/prompt-caching.md",
  "skills/bundled/claude-api/shared/tool-use-concepts.md",
  "skills/bundled/claude-api/typescript/agent-sdk/README.md",
  "skills/bundled/claude-api/typescript/agent-sdk/patterns.md",
  "skills/bundled/claude-api/typescript/claude-api/README.md",
  "skills/bundled/claude-api/typescript/claude-api/batches.md",
  "skills/bundled/claude-api/typescript/claude-api/files-api.md",
  "skills/bundled/claude-api/typescript/claude-api/streaming.md",
  "skills/bundled/claude-api/typescript/claude-api/tool-use.md",
  "skills/bundled/verify/SKILL.md",
  "skills/bundled/verify/examples/cli.md",
  "skills/bundled/verify/examples/server.md",
  "skills/bundled/dream/SKILL.md",
  "skills/bundled/hunter/SKILL.md",
  "skills/bundled/runSkillGenerator/SKILL.md",
  "utils/permissions/yolo-classifier-prompts/auto_mode_system_prompt.txt",
  "utils/permissions/yolo-classifier-prompts/permissions_anthropic.txt",
  "utils/permissions/yolo-classifier-prompts/permissions_external.txt",
  "utils/ultraplan/prompt.txt",
];

for (const f of resourceStubs) {
  const full = join(srcDir, f);
  if (existsSync(full)) continue;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, "");
  createdRes++;
}

// Also ensure global.d.ts and ink/global.d.ts exist
for (const gd of ["global.d.ts", "ink/global.d.ts"]) {
  const full = join(srcDir, gd);
  if (!existsSync(full)) {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(
      full,
      [
        "declare const MACRO: {",
        "  VERSION: string;",
        "  BUILD_TIME: string;",
        "  PACKAGE_URL: string;",
        "  FEEDBACK_CHANNEL: string;",
        "  ISSUES_EXPLAINER: string;",
        "  VERSION_CHANGELOG: string;",
        "};",
        "",
      ].join("\n")
    );
    createdRes++;
  }
}

console.log(`Created ${createdRes} resource stub files`);

// ──────────────────────────────────────────────────────────────────────
// 3. Create internal npm package stubs in node_modules
// ──────────────────────────────────────────────────────────────────────

const nm = join(srcDir, "node_modules");

const internalPackages: Record<string, Record<string, string>> = {
  "@ant/claude-for-chrome-mcp": {
    "index.js": "export const BROWSER_TOOLS = [];",
    "sentinelApps.js":
      "export function getSentinelCategory() { return null; }",
  },
  "@ant/computer-use-mcp": {
    "index.js": [
      "export function buildComputerUseTools() { return []; }",
      "export function bindSessionContext() {}",
      "export const DEFAULT_GRANT_FLAGS = {};",
      "export const API_RESIZE_PARAMS = {};",
      "export function targetImageSize() { return {}; }",
    ].join("\n"),
    "types.js": "export const DEFAULT_GRANT_FLAGS = {};",
    "sentinelApps.js":
      "export function getSentinelCategory() { return null; }",
  },
  "@ant/computer-use-swift": { "index.js": "export default null;" },
  "@ant/computer-use-input": { "index.js": "export default null;" },
  "@anthropic-ai/mcpb": { "index.js": "export default null;" },
  "@anthropic-ai/sandbox-runtime": {
    "index.js": [
      'import { z } from "zod";',
      "export const SandboxRuntimeConfigSchema = z.object({}).passthrough();",
      "export class SandboxManager {",
      "  static isEnabled() { return false; }",
      "  static create() { return new SandboxManager(); }",
      "  enable() {} disable() {} isActive() { return false; }",
      "  getViolations() { return []; }",
      "}",
      "export class SandboxViolationStore {",
      "  constructor() { this.violations = []; }",
      "  add() {} getAll() { return []; } clear() {}",
      "}",
    ].join("\n"),
  },
  "audio-capture-napi": { "index.js": "export default null;" },
  "image-processor-napi": { "index.js": "export default null;" },
  "modifiers-napi": { "index.js": "export default null;" },
  "url-handler-napi": { "index.js": "export default null;" },
  "color-diff-napi": {
    "index.js": [
      "export class ColorDiff { constructor() {} diff() { return ''; } }",
      "export class ColorFile { constructor() {} }",
      "export function getSyntaxTheme() { return null; }",
      "export default null;",
    ].join("\n"),
  },
  "asciichart": { "index.js": "export default null;" },
  trim: { "index.js": "export default null;" },
};

for (const [pkg, files] of Object.entries(internalPackages)) {
  const pkgDir = join(nm, pkg);
  // Skip if a real package is installed
  const pkgJson = join(pkgDir, "package.json");
  if (existsSync(pkgJson)) {
    try {
      const existing = JSON.parse(readFileSync(pkgJson, "utf-8"));
      if (existing.version && existing.version !== "0.0.0-stub") continue;
    } catch {}
  }
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    pkgJson,
    JSON.stringify({
      name: pkg,
      version: "0.0.0-stub",
      main: "index.js",
      type: "module",
    })
  );
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(pkgDir, file), content);
  }
  createdPkg++;
}

console.log(`Created ${createdPkg} internal package stubs in node_modules`);

// ──────────────────────────────────────────────────────────────────────
// 4. Ensure shims directory exists
// ──────────────────────────────────────────────────────────────────────

const shimPath = join(srcDir, "shims", "bun-bundle.d.ts");
if (!existsSync(shimPath)) {
  mkdirSync(dirname(shimPath), { recursive: true });
  writeFileSync(
    shimPath,
    'declare module "bun:bundle" {\n  export function feature(name: string): boolean;\n}\n'
  );
  console.log("Created shims/bun-bundle.d.ts");
}

// ──────────────────────────────────────────────────────────────────────
// 5. Ensure TungstenTool stub exists (static import, always needed)
// ──────────────────────────────────────────────────────────────────────

const tungstenPath = join(srcDir, "tools", "TungstenTool", "TungstenTool.ts");
if (!existsSync(tungstenPath)) {
  mkdirSync(dirname(tungstenPath), { recursive: true });
  writeFileSync(
    tungstenPath,
    [
      "// Stub: internal-only tool, not available in open-source build",
      "export const TungstenTool: any = {",
      '  name: "Tungsten",',
      "  isEnabled: () => false,",
      "  inputSchema: {} as any,",
      '  call: async () => ({ data: "Not available" }),',
      '  description: async () => "Internal tool (unavailable)",',
      '  prompt: async () => "Internal tool",',
      "};",
      "",
    ].join("\n")
  );
  console.log("Created TungstenTool stub");
}

console.log("\n✅ All stubs generated. You can now run:");
console.log("   bun --preload ./preload.ts entrypoints/cli.tsx --version");
