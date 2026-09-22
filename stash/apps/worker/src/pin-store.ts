import { randomInt } from "node:crypto";
import { encrypt, decrypt } from "./crypto.js";
import { config } from "./config.js";
import { getDb } from "./mongo.js";

type PinDoc = { _id: "pin"; value: string };

async function pinCollection() {
  const db = await getDb();
  return db.collection<PinDoc>("pin_store");
}

export async function hasPin(): Promise<boolean> {
  const col = await pinCollection();
  return (await col.findOne({ _id: "pin" })) !== null;
}

export async function generateAndStorePin(): Promise<string> {
  const col = await pinCollection();
  const pin = randomInt(100000, 999999).toString();
  const key = config.getRequiredSessionKey();
  await col.updateOne(
    { _id: "pin" },
    { $set: { value: encrypt(pin, key) } },
    { upsert: true },
  );
  return pin;
}

export async function verifyPin(candidate: string): Promise<boolean> {
  const col = await pinCollection();
  const doc = await col.findOne({ _id: "pin" });
  if (!doc) return false;
  const key = config.getRequiredSessionKey();
  return decrypt(doc.value, key) === candidate;
}

export async function resetPin(): Promise<string> {
  return generateAndStorePin();
}
