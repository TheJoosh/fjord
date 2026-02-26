export const cardsByRarity = {
    Placeholder: {
      image: "Placeholder.png",
      cardType: "Card",
      cost: "-",
      description: 
        "This is a placeholder card. Please replace it with your own design!",
      strength: "-",
      endurance: "-",
    },
    Legendary: {
    "Loki, God of Mischief": {
      image: "loki.png",
      cardType: "God",
      cost: 5,
      description:
        "Spell - each turn, this card assumes the strength and endurance of any other card in play",
      strength: "-",
      endurance: "-",
    },
    "Thrym, Frost Giant King": {
      image: "frost-giant.png",
      cardType: "Chieftan",
      cost: 5,
      description: "Berserk - gains +2 strength while attacking",
      strength: 3,
      endurance: 5,
    },
    "Odin, King of the Gods": {
      image: "mythologyart-odin-10069805_1280.png",
      cardType: "God",
      cost: 5,
      description: "Passive - +2 maximum fate while this card is in play",
      strength: 4,
      endurance: 5,
    },
    "Thor, God of Thunder": {
      image: "thor.png",
      cardType: "God",
      cost: 5,
      description:
        "Passive - the strength of all enemy cards is reduced by 1 while this card is in play",
      strength: 5,
      endurance: 3,
    },
  },
  Mythical: {
    "Níðhǫggr, Curse Striker": {
      image: "Níðhǫggr.png",
      cardType: "Beast",
      cost: 5,
      description:
        "Spell - each turn, one slain allied card can return to your hand",
      strength: 6,
      endurance: 4,
    },
  },
  Loric: {
    "Ratatoskr, The Messenger": {
      image: "Ratatoskr.png",
      cardType: "Beast",
      cost: 4,
      description:
        "Passive - the endurance of all enemy cards is reduced by 1 while this card is in play",
      strength: 4,
      endurance: 3,
    },
    "Erik the Red": {
      image: "Erik the Red.png",
      cardType: "Chieftan",
      cost: 3,
      description:
        "Command - can temporarily increase the strength of any two allied cards by 1 each turn",
      strength: 2,
      endurance: 2,
    },
  },
  Rare: {
    "Ragnar Lothbrok": {
      image: "Ragnar.png",
      cardType: "Chieftan",
      cost: 3,
      description:
        "Passive - the endurance of all allied cards is increased by 1 while this card is in play",
      strength: 3,
      endurance: 4,
    },
    "Valkyrie": {
      image: "Valkyrie2.png",
      cardType: "Warrior",
      cost: 3,
      description:
        "Flight - requires +2 strength to be blocked by a card without flight",
      strength: 4,
      endurance: 2,
    },
    "Leif Erikson": {
      image: "Leif Erikson.png",
      cardType: "Chieftan",
      cost: 3,
      description:
        "Command - can temporarily increase the endurance of any two allied cards by 1 each turn",
      strength: 3,
      endurance: 3,
    },
  },
  Uncommon: {
    "Shield Maiden": {
      image: "Shield Maiden.png",
      cardType: "Warrior",
      cost: 1,
      description: "Berserk - gains +1 strength while attacking",
      strength: 1,
      endurance: 2,
    },
    "Bear Shaman": {
      image: "Bear Shaman.png",
      cardType: "Warrior",
      cost: 3,
      description: "Berserk - gains +2 strength while attacking",
      strength: 4,
      endurance: 2,
    },
    "Dökkálfr": {
      image: "Dokkalfr.png",
      cardType: "Warrior",
      cost: 2,
      description:
        "Spell - cannot be blocked during its first turn attacking",
      strength: 3,
      endurance: 1,
    },
    "Ljósálfr": {
      image: "Ljosalfr.png",
      cardType: "Warrior",
      cost: 2,
      description:
        "Spell - can raise its endurance to 5 once per game; resets on death",
      strength: 2,
      endurance: 2,
    },
    "Dvergr": {
      image: "Dvergr.png",
      cardType: "Warrior",
      cost: 2,
      description:
        "Forge - permanently increases the strength of any one allied card by 1 when played",
      strength: 3,
      endurance: 1,
    },
  },
  Common: {
    "Drengr": {
      image: "grunt.png",
      cardType: "Warrior",
      cost: 1,
      description: 
        "Swift - this card can attack on the same turn it enters play",
      strength: 2,
      endurance: 1,
    },
  },
};

// Helper lookup by name
export function getCardByName(name) {
  for (const rarity in cardsByRarity) {
    if (cardsByRarity[rarity][name]) {
      return { rarity, name, ...cardsByRarity[rarity][name] };
    }
  }
  return null;
}
