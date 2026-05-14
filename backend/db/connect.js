import mongoose from "mongoose";

/**
 * @param {string} uri MongoDB connection string (Atlas SRV or standard).
 */
export async function connectMongo(uri) {
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });
  console.log("[mongo] connected:", mongoose.connection.host);
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  console.log("[mongo] connection closed");
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}
