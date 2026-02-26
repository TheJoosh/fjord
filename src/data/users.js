export const users = {
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
  },
};

export function getUser(username) {
  return users[username] || null;
}
