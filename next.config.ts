import type { NextConfig } from "next";
// NEXT_PUBLIC_BASE_PATH=/SenseGlyph builds for GitHub Pages (see scripts/deploy-pages.mjs).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;
const config: NextConfig = { output: "export", trailingSlash: true, basePath };
export default config;
