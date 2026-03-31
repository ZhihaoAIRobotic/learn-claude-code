import { plugin } from "bun";

// ── 1. Define build-time MACRO globals ──────────────────────────────
(globalThis as any).MACRO = {
  VERSION: "0.0.1-dev",
  BUILD_TIME: new Date().toISOString(),
  PACKAGE_URL: "@anthropic-ai/claude-code",
  FEEDBACK_CHANNEL: "https://github.com/anthropics/claude-code/issues",
  ISSUES_EXPLAINER:
    "report via /bug command or file a GitHub issue at https://github.com/anthropics/claude-code/issues",
  VERSION_CHANGELOG: "",
};

// ── 2. Shim bun:bundle so `import { feature } from 'bun:bundle'` works ─
//    feature() returns false for all flags → disables all gated features.
//    This is the safest baseline; core CLI/tools/REPL are NOT gated.
plugin({
  name: "bun-bundle-shim",
  setup(build) {
    build.onResolve({ filter: /^bun:bundle$/ }, () => ({
      path: "bun:bundle",
      namespace: "bun-bundle-ns",
    }));
    build.onLoad({ filter: /.*/, namespace: "bun-bundle-ns" }, () => ({
      contents: `export function feature(_name) { return false; }`,
      loader: "js",
    }));
  },
});

// ── 3. Handle .md and .txt imports as text modules ─────────────────────
plugin({
  name: "text-loader",
  setup(build) {
    build.onLoad({ filter: /\.(md|txt)$/ }, async (args) => {
      const { readFileSync } = await import("fs");
      const text = readFileSync(args.path, "utf-8");
      return {
        contents: `export default ${JSON.stringify(text)};`,
        loader: "js",
      };
    });
  },
});
