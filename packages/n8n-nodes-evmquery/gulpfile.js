const { src, dest, parallel } = require("gulp");

/**
 * Copies SVG icon assets from src/ to the matching dist/ path so n8n's node
 * loader can find them alongside the compiled .js files.
 */
function buildIcons() {
	return src("src/nodes/**/*.svg", { base: "src" }).pipe(dest("dist"));
}

/**
 * Copies the codex metadata JSON files (EvmQuery.node.json) alongside the
 * compiled node so n8n can surface categories, subtitles, and doc links.
 */
function buildCodex() {
	return src("src/nodes/**/*.node.json", { base: "src" }).pipe(dest("dist"));
}

const buildAssets = parallel(buildIcons, buildCodex);

exports["build:icons"] = buildIcons;
exports["build:codex"] = buildCodex;
exports["build:assets"] = buildAssets;
