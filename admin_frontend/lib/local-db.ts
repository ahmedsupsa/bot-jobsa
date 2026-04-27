import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
  console.warn("[local-db] DATABASE_URL not set");
}

export const db = postgres(DATABASE_URL, {
  max: 5,
  idle_timeout: 30,
  connect_timeout: 10,
});
