import Database from 'better-sqlite3';
const db = new Database(':memory:');
try {
  db.exec("CREATE VIRTUAL TABLE t1 USING fts5(x, tokenize='trigram');");
  console.log("Trigram supported!");
} catch (e) {
  console.error("Error:", e);
}
