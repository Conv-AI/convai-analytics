import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const packages = [
  ["@convai/analytics", "packages/typescript"],
  ["@convai/analytics-cli", "cli"],
  ["@convai/analytics-mcp", "packages/mcp"],
];
const npmCache = process.env.npm_config_cache ?? join(root, ".npm-cache");

const forbiddenPatterns = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)@rollup\/rollup-[^/]+(\/|$)/,
];

let failed = false;

for (const [name, relativeDir] of packages) {
  const cwd = join(root, relativeDir);
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: npmCache,
    },
  });

  if (result.status !== 0) {
    failed = true;
    console.error(`npm pack dry-run failed for ${name}`);
    console.error(result.stderr || result.stdout);
    continue;
  }

  const payload = JSON.parse(result.stdout || "[]");
  const files = payload.flatMap((entry) => entry.files ?? []);
  const bad = files
    .map((file) => String(file.path ?? "").replaceAll("\\", "/"))
    .filter((path) => forbiddenPatterns.some((pattern) => pattern.test(path)));

  if (bad.length > 0) {
    failed = true;
    console.error(`${name} package includes forbidden archive paths:`);
    for (const path of bad) console.error(`  - ${path}`);
  } else {
    console.log(`${name}: package archive is clean (${files.length} files)`);
  }
}

if (failed) process.exit(1);
