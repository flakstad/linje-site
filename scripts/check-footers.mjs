import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join, resolve} from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");
const paths = [...sitemap.matchAll(/<loc>https:\/\/linje\.systems\/(.*?)<\/loc>/g)]
  .map((match) => match[1]);

for (const publicPath of paths) {
  const filename = publicPath === ""
    ? "index.html"
    : publicPath.endsWith(".html")
      ? publicPath
      : join(publicPath, "index.html");
  const html = readFileSync(join(root, filename), "utf8");
  const footer = html.match(/<footer class="site-footer[^"]*">[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer, `${filename} is missing its site footer`);
  assert.match(footer, /Flakstad Software AS/);
  assert.match(footer, /Org\. no\. 935 382 017/);
  assert.match(footer, /href="mailto:hello@linje\.systems">hello@linje\.systems<\/a>/);
}

console.log(`Checked ${paths.length} public footers.`);
