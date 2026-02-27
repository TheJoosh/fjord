export const users = {
  Tradey: {
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
    cards: {
      "Loki, God of Mischief": 1,
      "Drengr": 3,
      "Odin, King of the Gods": 1,
      "Shield Maiden": 2,
      "Valkyrie": 1,
      "Bear Shaman": 1,
      "Leif Erikson": 1,
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
    cards: {
      "Thor, God of Thunder": 2,
      "Thrym, Frost Giant King": 1,
      "Ragnar Lothbrok": 2,
      "Dökkálfr": 1,
      "Ljósálfr": 2,
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
    cards: {
      "Níðhǫggr, Curse Striker": 1,
      "Ratatoskr, The Messenger": 1,
      "Erik the Red": 1,
      "Dvergr": 2,
      "Drengr": 4,
      "Shield Maiden": 1,
      "Valkyrie": 1,
      "Leif Erikson": 1,
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
    packs: {
      "Default Pack": 100,
      "Saga Pack": 100,
      "Mythbound Pack": 100,
      "Heroic Pack": 100,
    },
  },
}

function getStoredUsersMap() {
  try {
    const rawUsers = localStorage.getItem('users');
    const parsedUsers = rawUsers ? JSON.parse(rawUsers) : {};
    return parsedUsers && typeof parsedUsers === 'object' && !Array.isArray(parsedUsers)
      ? parsedUsers
      : {};
  } catch {
    return {};
  }
}

export function getUser(username) {
  if (!username) return null;

  if (users[username]) {
    return users[username];
  }

  const storedUsers = getStoredUsersMap();
  if (storedUsers[username]) {
    users[username] = storedUsers[username];
    return users[username];
  }

  const insensitiveKey = Object.keys(storedUsers).find(
    (name) => name.toLowerCase() === username.toLowerCase()
  );

  if (insensitiveKey) {
    users[insensitiveKey] = storedUsers[insensitiveKey];
    return users[insensitiveKey];
  }

  return null;
}
