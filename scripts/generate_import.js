const fs = require("fs");
const path = require("path");

const raw = fs.readFileSync(path.join(__dirname, "..", "attached_assets", "jobs_taxonomy_1779408994690.json"), "utf-8");
const taxonomy = JSON.parse(raw);

const jobsSet = new Set();
for (const major of taxonomy.majors || []) {
  for (const job of major.jobs || []) {
    const name = job.trim();
    if (name && name.length > 1) jobsSet.add(name);
  }
}

const uniqueJobs = [...jobsSet];
console.log(`Total unique jobs: ${uniqueJobs.length}`);

// Generate batched SQL
let sql = `TRUNCATE job_fields RESTART IDENTITY CASCADE;\n\n`;
const BATCH = 500;
for (let i = 0; i < uniqueJobs.length; i += BATCH) {
  const batch = uniqueJobs.slice(i, i + BATCH);
  const values = batch.map(n => `('${n.replace(/'/g, "''")}')`).join(",\n");
  sql += `INSERT INTO job_fields (name_ar) VALUES\n${values};\n\n`;
}

const outPath = path.join(__dirname, "..", "admin_frontend", "scripts", "import_jobs.sql");
fs.writeFileSync(outPath, sql, "utf-8");
console.log(`Batched SQL written to: ${outPath} (${(sql.length / 1024).toFixed(0)} KB)`);
