const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const DEFAULT_DB_NAME = process.env.MONGODB_DB || 'Fjord';
const CARDS_ROOT_DOC_ID = process.env.CARDS_ROOT_DOC_ID || '69b045d736b3687c61767638';
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Loric', 'Mythical', 'Legendary'];

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

function normalizeName(value) {
  return String(value || '').trim();
}

function toCardsRootFilter() {
  try {
    return { _id: new ObjectId(CARDS_ROOT_DOC_ID) };
  } catch {
    return { _id: CARDS_ROOT_DOC_ID };
  }
}

function getExpectedDesignedByUser(cardsRootDoc) {
  const expected = new Map();

  for (const rarity of RARITIES) {
    const bucket = cardsRootDoc?.[rarity];
    if (!bucket || typeof bucket !== 'object') continue;

    for (const [cardName, cardData] of Object.entries(bucket)) {
      if (!cardData || typeof cardData !== 'object') continue;

      const author = normalizeName(cardData.author);
      const name = normalizeName(cardName);

      if (!author || !name || author === 'Fjord') continue;

      if (!expected.has(author)) expected.set(author, new Set());
      expected.get(author).add(name);
    }
  }

  return expected;
}

async function reconcileDesignedCards() {
  const client = new MongoClient(buildMongoUri());

  try {
    await client.connect();
    const db = client.db(DEFAULT_DB_NAME);

    const cardsCollection = db.collection('cards');
    const designedCardsCollection = db.collection('designed_cards');

    const cardsRootDoc = await cardsCollection.findOne(toCardsRootFilter(), {
      projection: Object.fromEntries(RARITIES.map((rarity) => [rarity, 1])),
    });

    if (!cardsRootDoc) {
      console.log('No cards root document found; nothing to reconcile.');
      return;
    }

    const expectedByUser = getExpectedDesignedByUser(cardsRootDoc);
    const existingDocs = await designedCardsCollection
      .find({}, { projection: { _id: 1, cards: 1 } })
      .toArray();

    const existingByUser = new Map();
    for (const doc of existingDocs) {
      const userName = normalizeName(doc?._id);
      if (!userName) continue;

      const cards = Array.isArray(doc?.cards)
        ? new Set(doc.cards.map(normalizeName).filter(Boolean))
        : new Set();

      existingByUser.set(userName, cards);
    }

    const operations = [];
    let usersTouched = 0;
    let cardsAdded = 0;

    for (const [userName, expectedCards] of expectedByUser.entries()) {
      const existingCards = existingByUser.get(userName) || new Set();
      const missingCards = [...expectedCards].filter((name) => !existingCards.has(name));
      if (missingCards.length === 0) continue;

      usersTouched += 1;
      cardsAdded += missingCards.length;

      operations.push({
        updateOne: {
          filter: { _id: userName },
          update: { $addToSet: { cards: { $each: missingCards } } },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      await designedCardsCollection.bulkWrite(operations, { ordered: false });
    }

    console.log(
      `Designed cards reconcile complete. Users updated: ${usersTouched}. Cards added: ${cardsAdded}.`
    );
  } finally {
    await client.close();
  }
}

reconcileDesignedCards().catch((error) => {
  console.error('Designed cards reconcile failed:', error?.message || error);
  process.exitCode = 1;
});