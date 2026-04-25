import { dest, parallel, src } from "gulp";

/**
 * Copies SVG icon assets from src/ to the matching dist/ path so n8n's node
 * loader can find them alongside the compiled .js files.
 */
const buildIcons = () =>
	src("src/nodes/**/*.svg", { base: "src" }).pipe(dest("dist"));

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
