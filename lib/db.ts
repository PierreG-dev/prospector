import mongoose, { type Mongoose } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

type Cache = { conn: Mongoose | null; promise: Promise<Mongoose> | null };

const globalForMongo = globalThis as unknown as { _mongoose?: Cache };
const cache: Cache = globalForMongo._mongoose ?? { conn: null, promise: null };
if (!globalForMongo._mongoose) globalForMongo._mongoose = cache;

export async function dbConnect(): Promise<Mongoose> {
  if (cache.conn) return cache.conn;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI manquante dans .env.local");
  }
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function dbPing(): Promise<boolean> {
  try {
    const m = await dbConnect();
    if (!m.connection.db) return false;
    await m.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
