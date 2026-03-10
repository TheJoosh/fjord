import { storageService } from '../../services/storageService';

export const users = {
  Tradey: {
    wallet: 0,
    admin: false,
    cards: {
      "Loki, God of Mischief": 3,
      "Thrym, Frost Giant King": 3,
      "Odin, King of the Gods": 3,
      "Thor, God of Thunder": 3,
      "Níðhǫggr, Curse Striker": 3,
      "Fenris, Odin's Bane": 3,
      "Hel, Goddess of Death": 3,
      "Eagle of the World Tree": 3,
      "Jörmungandr": 3,
      "Surtr, Fire Giant Lord": 3,
      "Freyja, Goddess of Love": 3,
      "Freyr, God of Prosperity": 3,
      "Ratatoskr, The Messenger": 5,
      "Ymir, Primordial Giant": 5,
      "Sigurd, Dragon-Slayer": 5,
      "Brynhildr, Shieldmaiden": 5,
      "Erik the Red": 7,
      "Cnut the Great": 7,
      "Skaði, Jötunn Huntress": 7,
      "Ragnar Lothbrok": 10,
      "Valkyrie": 10,
      "Leif Erikson": 10,
      "Fire Jötunn": 10,
      "Ice Jötunn": 10,
      "Einherji": 10,
      "Shield Maiden": 16,
      "Bear Shaman": 16,
      "Dökkálfr": 16,
      "Ljósálfr": 16,
      "Dvergr": 16,
      "Drengr": 24,
      "Corsair": 24,
      "Draugr": 24,
      "Stormborn": 24,
      "Marauder": 24,
    },
  },
  Gary: {
    password: "gary123",
    wallet: 0,
    admin: false,
    cards: {
      "Loki, God of Mischief": 2,
      "Odin, King of the Gods": 2,
      "Hel, Goddess of Death": 1,
      "Surtr, Fire Giant Lord": 1,
      "Freyr, God of Prosperity": 1,
      "Ratatoskr, The Messenger": 2,
      "Erik the Red": 2,
      "Ragnar Lothbrok": 3,
      "Valkyrie": 2,
      "Shield Maiden": 3,
      "Dvergr": 2,
      "Drengr": 6,
      "Corsair": 4,
    },
    packs: {
      "Default Pack": 2,
      "Saga Pack": 1,
      "Mythbound Pack": 0,
      "Heroic Pack": 1,
    },
    designed: 4,
  },
  Steven: {
    password: "steve_pw",
    wallet: 0,
    admin: false,
    cards: {
      "Thor, God of Thunder": 2,
      "Thrym, Frost Giant King": 2,
      "Fenris, Odin's Bane": 1,
      "Eagle of the World Tree": 1,
      "Jörmungandr": 2,
      "Freyja, Goddess of Love": 3,
      "Ymir, Primordial Giant": 1,
      "Sigurd, Dragon-Slayer": 2,
      "Cnut the Great": 2,
      "Leif Erikson": 2,
      "Fire Jötunn": 2,
      "Bear Shaman": 2,
      "Dökkálfr": 3,
      "Draugr": 5,
      "Stormborn": 5,
    },
    packs: {
      "Default Pack": 1,
      "Saga Pack": 2,
      "Mythbound Pack": 1,
      "Heroic Pack": 0,
    },
    designed: 16,
  },
  Lucy: {
    password: "lucy$$$",
    wallet: 0,
    admin: false,
    cards: {
      "Níðhǫggr, Curse Striker": 2,
      "Brynhildr, Shieldmaiden": 2,
      "Skaði, Jötunn Huntress": 2,
      "Ice Jötunn": 2,
      "Einherji": 2,
      "Ljósálfr": 3,
      "Marauder": 6,
    },
    packs: {
      "Default Pack": 1,
      "Saga Pack": 1,
      "Mythbound Pack": 1,
      "Heroic Pack": 1,
    },
    designed: 300,
  },
  Packer: {
    password: "123",
    wallet: 1000,
    admin: false,
    packs: {
      "Default Pack": 100,
      "Saga Pack": 100,
      "Mythbound Pack": 100,
      "Heroic Pack": 100,
    },
  },
  Fjord: {
    password: "leif",
    wallet: 1000000,
    admin: true,
    packs: {
      "Default Pack": 1000,
      "Saga Pack": 1000,
      "Mythbound Pack": 1000,
      "Heroic Pack": 1000,
    },
  },
}

export function normalizeWalletValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed.toFixed(2)));
}

function getDefaultWalletForUser(username) {
  if (!username) return 0;
  return normalizeWalletValue(users?.[username]?.wallet);
}

function getDefaultAdminForUser(username) {
  if (!username) return false;
  return Boolean(users?.[username]?.admin);
}

function ensureUserWallet(username, userObj) {
  if (!userObj || typeof userObj !== 'object') return;
  const fallback = getDefaultWalletForUser(username);
  userObj.wallet = normalizeWalletValue(
    userObj.wallet != null ? userObj.wallet : fallback
  );
}

function ensureUserAdmin(username, userObj) {
  if (!userObj || typeof userObj !== 'object') return;
  if (typeof userObj.admin === 'boolean') return;
  userObj.admin = getDefaultAdminForUser(username);
}

function ensureUserProfileFields(username, userObj) {
  if (!userObj || typeof userObj !== 'object') return;
  ensureUserWallet(username, userObj);
  ensureUserAdmin(username, userObj);
}

function ensureUsersWallets() {
  for (const [username, userObj] of Object.entries(users || {})) {
    ensureUserProfileFields(username, userObj);
  }
}

ensureUsersWallets();

async function hydrateUsersFromStorage() {
  const storedUsers = await storageService.getUsersMap();

  let hasChanges = false;
  for (const [username, userObj] of Object.entries(storedUsers || {})) {
    if (!userObj || typeof userObj !== 'object') continue;

    const prevWallet = userObj.wallet;
    const prevAdmin = userObj.admin;
    ensureUserProfileFields(username, userObj);
    if (prevWallet !== userObj.wallet || prevAdmin !== userObj.admin) {
      hasChanges = true;
    }

    if (!users[username]) {
      users[username] = userObj;
    } else {
      ensureUserProfileFields(username, users[username]);
    }
  }

  for (const [username, userObj] of Object.entries(users || {})) {
    const existingStored = storedUsers[username];
    if (!existingStored || typeof existingStored !== 'object') {
      storedUsers[username] = { ...userObj };
      hasChanges = true;
      continue;
    }

    const prevWallet = existingStored.wallet;
    const prevAdmin = existingStored.admin;
    ensureUserProfileFields(username, existingStored);
    if (prevWallet !== existingStored.wallet || prevAdmin !== existingStored.admin) {
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await storageService.setUsersMap(storedUsers);
  }
}

void hydrateUsersFromStorage();

export function getUser(username) {
  if (!username) return null;

  if (users[username]) {
    ensureUserProfileFields(username, users[username]);
    return users[username];
  }

  const insensitiveKey = Object.keys(users || {}).find(
    (name) => name.toLowerCase() === username.toLowerCase()
  );

  if (insensitiveKey) {
    ensureUserProfileFields(insensitiveKey, users[insensitiveKey]);
    return users[insensitiveKey];
  }

  return null;
}
