import { transformFileSync } from "@babel/core";
import reactPreset from "@babel/preset-react";
import { mkdir, readFile, rm, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, "dist");
const sourceFiles = ["sprites.jsx", "data.jsx", "screens.jsx", "dungeon.jsx", "app.jsx"];

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "vendor"), { recursive: true });
await copyFile(path.join(root, "styles.css"), path.join(output, "styles.css"));

for (const file of sourceFiles) {
  const source = path.join(root, file);
  const { code } = transformFileSync(source, {
    babelrc: false,
    configFile: false,
    sourceType: "script",
    presets: [[reactPreset, { runtime: "classic" }]],
  });
  await writeFile(path.join(output, file.replace(/\.jsx$/, ".js")), code);
}

const vendorFiles = [
  ["react/umd/react.production.min.js", "react.production.min.js"],
  ["scheduler/umd/scheduler.production.min.js", "scheduler.production.min.js"],
  ["react-dom/umd/react-dom.production.min.js", "react-dom.production.min.js"],
];

for (const [source, destination] of vendorFiles) {
  await copyFile(
    path.join(root, "node_modules", source),
    path.join(output, "vendor", destination),
  );
}

let html = await readFile(path.join(root, "index.html"), "utf8");
html = html.replace(/<script src="https:\/\/unpkg\.com\/(?:react|react-dom|@babel\/standalone)@[^\"]+"[^>]*><\/script>\s*/g, "");
html = html.replace(
  '<script type="text/babel" src="sprites.jsx"></script>',
  [
    '<script src="vendor/react.production.min.js"></script>',
    '<script src="vendor/scheduler.production.min.js"></script>',
    '<script src="vendor/react-dom.production.min.js"></script>',
    '<script src="sprites.js"></script>',
  ].join("\n"),
);
html = html.replace(/<script type="text\/babel" src="([^\"]+)\.jsx"><\/script>/g, '<script src="$1.js"></script>');
await writeFile(path.join(output, "index.html"), html);