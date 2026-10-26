// Inlines style.css, data.js and app.js into one file: spinpath.html (works from a double-click or any previewer).
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (f) => readFile(new URL(f, root), "utf8");
const [html, css, data, app] = await Promise.all([read("index.html"), read("style.css"), read("data.js"), read("app.js")]);

// function replacers so "$" in the source is never treated as a replacement pattern
const out = html
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}</style>`)
  .replace('<script src="data.js"></script>', () => `<script>\n${data}</script>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${app}</script>`)
  .replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', "");

await writeFile(new URL("spinpath.html", root), out);
console.log(`spinpath.html: ${(out.length / 1024).toFixed(1)} KB`);
