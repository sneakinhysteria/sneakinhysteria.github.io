// Emails new posts to Buttondown subscribers, replacing Ghost's send-on-publish
// without the paid RSS-to-email add-on.
//   node tools/notify-subscribers.mjs <before-sha> <after-sha>
// Needs BUTTONDOWN_API_KEY. Without it the script exits quietly, so forks and
// local runs do nothing.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const key = process.env.BUTTONDOWN_API_KEY;
if (!key) {
  console.log("BUTTONDOWN_API_KEY not set — skipping");
  process.exit(0);
}

const [before, after = "HEAD"] = process.argv.slice(2);
const site = JSON.parse(fs.readFileSync("src/_data/site.json", "utf8"));

// Only files ADDED in this push: edits to existing posts must not re-send.
const range = before && !/^0+$/.test(before) ? `${before}..${after}` : null;
const added = range
  ? execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=A", range, "--", "src/posts"],
      { encoding: "utf8" }
    )
      .split("\n")
      .filter((f) => f.endsWith(".md"))
  : [];

if (added.length === 0) {
  console.log("no new posts in this push");
  process.exit(0);
}

const parse = (raw) => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { front: {}, body: raw };
  const front = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) front[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { front, body: m[2] };
};

let sent = 0;
for (const file of added) {
  if (!fs.existsSync(file)) continue;
  const { front, body } = parse(fs.readFileSync(file, "utf8"));
  if (String(front.draft) === "true") {
    console.log(`skip (draft): ${file}`);
    continue;
  }

  const slug = front.slug || file.split("/").pop().replace(/\.md$/, "");
  const url = `${site.url}/${slug}/`;
  // Buttondown rejects a body that opens with YAML frontmatter.
  const content = `${body.trim()}\n\n---\n\n[Read it on the site](${url})`;

  const res = await fetch("https://api.buttondown.com/v1/emails", {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: front.title || slug,
      body: content,
      status: "about_to_send",
    }),
  });

  if (!res.ok) {
    console.error(`Buttondown ${res.status} for ${file}: ${await res.text()}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`sent: ${front.title || slug}`);
  sent++;
}
console.log(`${sent} email(s) queued`);
