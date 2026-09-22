import { encrypt, decrypt } from "./crypto.js";
import { config } from "./config.js";
import { getDb } from "./mongo.js";

type SessionDoc = { _id: "session"; value: string };

export type AccountBinding = {
  userId: string;
  username: string | null;
  firstName: string | null;
  boundAt: number;
};

type BindingDoc = AccountBinding & { _id: "binding" };

async function sessionCollection() {
  const db = await getDb();
  return db.collection<SessionDoc>("session_store");
}

async function bindingCollection() {
  const db = await getDb();
  return db.collection<BindingDoc>("binding_store");
}

export async function hasSession(): Promise<boolean> {
  const col = await sessionCollection();
  return (await col.findOne({ _id: "session" })) !== null;
}

export async function loadSessionString(): Promise<string | null> {
  const col = await sessionCollection();
  const doc = await col.findOne({ _id: "session" });
  if (!doc) return null;
  const key = config.getRequiredSessionKey();
  return decrypt(doc.value, key);
}

export async function saveSessionString(session: string): Promise<void> {
  const col = await sessionCollection();
  const key = config.getRequiredSessionKey();
  await col.updateOne(
    { _id: "session" },
    { $set: { value: encrypt(session, key) } },
    { upsert: true },
  );
}

export async function clearSession(): Promise<void> {
  const sessions = await sessionCollection();
  const bindings = await bindingCollection();
  await sessions.deleteOne({ _id: "session" });
  await bindings.deleteOne({ _id: "binding" });
}

export async function loadBinding(): Promise<AccountBinding | null> {
  const col = await bindingCollection();
  const doc = await col.findOne({ _id: "binding" });
  if (!doc) return null;
  const { _id, ...binding } = doc;
  return binding;
}

export async function saveBinding(binding: AccountBinding): Promise<void> {
  const col = await bindingCollection();
  await col.updateOne({ _id: "binding" }, { $set: binding }, { upsert: true });
}
