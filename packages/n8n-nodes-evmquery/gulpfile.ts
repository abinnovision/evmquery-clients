import { dest, parallel, src } from "gulp";

/**
 * Copies SVG icon assets from `src/icons/` to `dist/icons/` so n8n's node
 * loader can resolve `file:` icon paths at runtime. The single shared
 * directory keeps node and credential classes pointing at one source of
 * truth and matches how the icon-validation lint rule resolves paths
 * (relative to the source file).
 */
const buildIcons = () =>
	src("src/icons/**/*.svg", { base: "src" }).pipe(dest("dist"));

/**
 * Copies the codex metadata JSON files (EvmQuery.node.json) alongside the
 * compiled node so n8n can surface categories, subtitles, and doc links.
 */
const buildCodex = () =>
	src("src/nodes/**/*.node.json", { base: "src" }).pipe(dest("dist"));

const buildAssets = parallel(buildIcons, buildCodex);

export { buildAssets as "build:assets" };
export { buildCodex as "build:codex" };
export { buildIcons as "build:icons" };
