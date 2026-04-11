const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DEFAULT_DB_NAME = process.env.MONGODB_DB || 'Fjord';

function readDbConfig() {
  const configPath = path.join(__dirname, '..', 'DBConfig.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function buildMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const config = readDbConfig();
  const configuredUri = String(config?.mongodbUri || '').trim();
  if (configuredUri) return configuredUri;

  const host = String(config?.hostname || '').trim();
  const userName = String(config?.userName || '').trim();
  const password = String(config?.password || '').trim();

  if (!host || !userName || !password) {
    throw new Error('Missing MongoDB configuration. Set MONGODB_URI or DBConfig.json.');
  }

  return `mongodb+srv://${encodeURIComponent(userName)}:${encodeURIComponent(password)}@${host}/?retryWrites=true&w=majority&appName=fjord`;
}

function normalizeQty(value) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function normalizeCardsLength(cards) {
  if (!Array.isArray(cards)) return 0;
  const unique = new Set(
    cards
      .map((name) => String(name || '').trim())
      .filter(Boolean)
  );
  return unique.size;
}

async function reconcileDesignedCounts() {
  const client = new MongoClient(buildMongoUri());

  try {
    await client.connect();
    const db = client.db(DEFAULT_DB_NAME);

    const designedCardsCollection = db.collection('designed_cards');
    const designedCountsCollection = db.collection('designed_counts');

    const [designedCardsDocs, designedCountDocs] = await Promise.all([
      designedCardsCollection.find({}, { projection: { _id: 1, cards: 1 } }).toArray(),
      designedCountsCollection.find({}, { projection: { _id: 1, count: 1 } }).toArray(),
    ]);

    const expectedByUser = new Map();
    for (const doc of designedCardsDocs) {
      const userName = String(doc?._id || '').trim();
      if (!userName || userName === 'Fjord') continue;
      expectedByUser.set(userName, normalizeCardsLength(doc.cards));
    }

    const actualByUser = new Map();
    for (const doc of designedCountDocs) {
      const userName = String(doc?._id || '').trim();
      if (!userName || userName === 'Fjord') continue;
      actualByUser.set(userName, normalizeQty(doc.count));
    }

    const allUsers = new Set([...expectedByUser.keys(), ...actualByUser.keys()]);
    const updates = [];

    for (const userName of allUsers) {
      const expected = expectedByUser.get(userName) || 0;
      const actual = actualByUser.get(userName) || 0;
      if (expected !== actual) {
        updates.push({ userName, from: actual, to: expected });
      }
    }

    if (updates.length > 0) {
      const operations = updates.map((entry) => ({
        updateOne: {
          filter: { _id: entry.userName },
          update: { $set: { count: entry.to } },
          upsert: true,
        },
      }));

      await designedCountsCollection.bulkWrite(operations, { ordered: false });
    }

    console.log(`Reconcile complete. Updated ${updates.length} user(s).`);
    if (updates.length > 0) {
      const preview = updates
        .sort((a, b) => a.userName.localeCompare(b.userName))
        .slice(0, 50);
      console.log('Changes:', JSON.stringify(preview));
    }
  } finally {
    await client.close();
  }
}

reconcileDesignedCounts().catch((error) => {
  console.error('Reconcile failed:', error?.message || error);
  process.exitCode = 1;
});
