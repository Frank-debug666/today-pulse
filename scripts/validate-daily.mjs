import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("public/daily.json", "utf8"));
const errors = [];

const requireText = (value, path) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
};

requireText(data.generatedAt, "generatedAt");
requireText(data.dateLabel, "dateLabel");

if (!Array.isArray(data.githubRepos) || data.githubRepos.length < 3) {
  errors.push("githubRepos must contain at least 3 items");
}
if (!Array.isArray(data.globalNews) || data.globalNews.length < 3) {
  errors.push("globalNews must contain at least 3 items");
}

for (const [index, item] of (data.githubRepos || []).entries()) {
  requireText(item.name, `githubRepos[${index}].name`);
  requireText(item.summary, `githubRepos[${index}].summary`);
  requireText(item.url, `githubRepos[${index}].url`);
}
for (const [index, item] of (data.globalNews || []).entries()) {
  requireText(item.title, `globalNews[${index}].title`);
  requireText(item.summary, `globalNews[${index}].summary`);
  requireText(item.url, `globalNews[${index}].url`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`daily.json valid: ${data.githubRepos.length} repos, ${data.globalNews.length} news items`);

