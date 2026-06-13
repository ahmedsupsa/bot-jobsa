const fs = require("fs");
const path = require("path");

const raw = fs.readFileSync(path.join(__dirname, "..", "attached_assets", "jobs_taxonomy_1779408994690.json"), "utf-8");
const taxonomy = JSON.parse(raw);

const seen = new Map();
for (const major of taxonomy.majors || []) {
  const category = major.major || major.category || "";
  for (const job of major.jobs || []) {
    const name = job.trim();
    if (name && name.length > 1 && !seen.has(name)) {
      seen.set(name, category);
    }
  }
}

console.log(`Total unique jobs: ${seen.size}`);

let sql = `-- أولاً: خلي category يقبل NULL\n`;
sql += `ALTER TABLE job_fields ALTER COLUMN category DROP NOT NULL;\n\n`;
sql += `-- ثانياً: فَرّغ الجدول\n`;
sql += `TRUNCATE job_fields RESTART IDENTITY CASCADE;\n\n`;
sql += `-- ثالثاً: أدخل المسميات مع التصنيف\n`;
sql += `INSERT INTO job_fields (name_ar, category) VALUES\n`;

const rows = [];
for (const [name, cat] of seen) {
  const sn = name.replace(/'/g, "''");
  const sc = cat.replace(/'/g, "''");
  rows.push(`('${sn}', '${sc}')`);
}
sql += rows.join(",\n") + ";\n";

// Also keep a JSON version for the public folder
const compact = [...seen].map(([name], i) => ({ id: i + 1, name_ar: name }));
fs.writeFileSync(
  path.join(__dirname, "..", "admin_frontend", "public", "all_job_titles.json"),
  JSON.stringify(compact), "utf-8"
);

const outPath = path.join(__dirname, "..", "admin_frontend", "scripts", "import_jobs.sql");
fs.writeFileSync(outPath, sql, "utf-8");
console.log(`✅ SQL written: ${outPath} (${(sql.length / 1024).toFixed(0)} KB)`);
