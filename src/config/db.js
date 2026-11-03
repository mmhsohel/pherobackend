import { MongoClient } from "mongodb";
const client = new MongoClient(process.env.MONGODB_URI);
let db;
export async function connectDB() {
  if (!db) { await client.connect(); db = client.db(process.env.DB_NAME); }
  return db;
}
export const col = (name) => db.collection(name);