import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

if (!clientPromise) {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export default async function handler(req, res) {
  try {
    await clientPromise;
    const db = client.db("gold_prices");
    const collection = db.collection("rates");

    const rates = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ ingested_at: 1 })
      .toArray();

    const latestPerDay = {};
    for (const r of rates) {
      const key = `${r.date}__${r.brand}`;
      if (!latestPerDay[key] || r.ingested_at > latestPerDay[key].ingested_at) {
        latestPerDay[key] = r;
      }
    }

    const deduped = Object.values(latestPerDay).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    res.status(200).json(deduped);
  } catch (e) {
    console.error("MongoDB fetch error:", e);
    res.status(500).json({ error: "Failed to fetch gold rates" });
  }
}
