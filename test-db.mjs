import mariadb from 'mariadb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  let url = process.env.DATABASE_URL;
  url = url.replace(/^['"]|['"]$/g, "");
  url = url.replace(/^mysql:\/\//, "mariadb://");
  console.log("Connecting to:", url.replace(/:[^:@]*@/, ":***@"));
  
  try {
    const pool = mariadb.createPool(url);
    const conn = await pool.getConnection();
    console.log("Connected successfully!");
    const rows = await conn.query("SELECT 1");
    console.log("Query result:", rows);
    conn.release();
    await pool.end();
  } catch (err) {
    console.error("Connection failed:", err);
  }
}
main();
