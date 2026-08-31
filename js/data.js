const RACES = {
  human: {
    id: "human",
    name: "Human",
    blurb: "Versatile and ambitious. Bonus skill, an extra feat, balanced stat boosts.",
    traits: ["Bonus Skill Proficiency", "Extra Feat: Skilled", "Adaptable"],
    bonuses: { str: 1, dex: 1, cha: 1, int: 1, hp: 1 },
    features: "You pick up languages, tools, and customs quickly. Once per rest you may reroll a failed skill check."
  },
  elf: {
    id: "elf",
    name: "Elf",
    blurb: "Graceful and long-lived. Darkvision, charm resistance, Trance instead of sleep.",
    traits: ["Darkvision", "Fey Ancestry", "Trance"],
    bonuses: { str: 0, dex: 2, cha: 0, int: 1, hp: 0 },
    features: "You cannot be magically put to sleep. Advantage on saves against charm. Four hours of trance counts as a full rest."
  },
  dwarf: {
    id: "dwarf",
    name: "Dwarf",
    blurb: "Stout underground builders. Poison resistance, Darkvision, stonecunning.",
    traits: ["Darkvision", "Poison Resistance", "Stonecunning", "Axe & Hammer Training"],
    bonuses: { str: 2, dex: 0, cha: 0, int: 0, hp: 3 },
    features: "Resistance to poison. You notice unusual stonework automatically. Warhammers and battleaxes feel like heirlooms in your hands."
  },
  dragonborn: {
    id: "dragonborn",
    name: "Dragonborn",
    blurb: "Proud draconic humanoids. A breath weapon and matching damage resistance.",
    traits: ["Breath Weapon", "Draconic Resistance"],
    bonuses: { str: 2, dex: 0, cha: 1, int: 0, hp: 1 },
    features: "Once per combat you exhale elemental ruin in a short cone. You resist the same element as your breath."
  },
  tiefling: {
    id: "tiefling",
    name: "Tiefling",
    blurb: "Infernal heritage. Fire resistance, Darkvision, innate hellish spellcasting.",
    traits: ["Darkvision", "Fire Resistance", "Infernal Legacy"],
    bonuses: { str: 0, dex: 0, cha: 2, int: 1, hp: 0 },
    features: "You resist fire. Once per rest you may wreath a strike or retort in hellish flame."
  }
};

const CLASSES = {
  fighter: {
    id: "fighter", name: "Fighter",
    primary: "str",
    hp: 12,
    features: ["Second Wind", "Martial Adept"],
    attack: "str",
    damage: "1d8+STR",
    blurb: "Steel, grit, and the will to stand when others fall."
  },
  wizard: {
    id: "wizard", name: "Wizard",
    primary: "int",
    hp: 6,
    features: ["Arcane Recovery", "Cantrip: Force Bolt"],
    attack: "int",
    damage: "1d10+INT",
    blurb: "The world is a puzzle written in runes. You intend to solve it."
  },
  rogue: {
    id: "rogue", name: "Rogue",
    primary: "dex",
    hp: 8,
    features: ["Sneak Attack", "Cunning Action"],
    attack: "dex",
    damage: "1d6+DEX",
    blurb: "You go where locks, lies, and shadows meet."
  },
  cleric: {
    id: "cleric", name: "Cleric",
    primary: "cha",
    hp: 8,
    features: ["Turn the Unholy", "Healing Word"],
    attack: "cha",
    damage: "1d8+CHA",
    blurb: "A voice older than kings still answers when you pray."
  },
  ranger: {
    id: "ranger", name: "Ranger",
    primary: "dex",
    hp: 10,
    features: ["Hunter's Mark", "Wilderness Stride"],
    attack: "dex",
    damage: "1d8+DEX",
    blurb: "Roads end. The trail does not."
  }
};

const WORLD_Q = [
  {
    key: "tone",
    prompt: "What kind of tale should this world tell?",
    options: [
      { id: "heroic", label: "Heroic high adventure", text: "Banners, oaths, and last stands that songs remember." },
      { id: "grim", label: "Grim and costly", text: "Every victory leaves a scar. Mercy is a luxury." },
      { id: "mythic", label: "Mythic and strange", text: "Gods walk thinly veiled. Dreams leak into noon." },
      { id: "folk", label: "Hearth-and-hedge folk tale", text: "Village wards, borrowed names, and bargains at dusk." }
    ]
  },
  {
    key: "threat",
    prompt: "What doom gathers at the edge of the map?",
    options: [
      { id: "undead", label: "A sleepless empire of the dead", text: "Bells ring for those who will not stay buried." },
      { id: "dragon", label: "A draconic god-tyrant", text: "The sky itself has learned to hunger." },
      { id: "rift", label: "A widening planar rift", text: "Other laws are leaking into this one." },
      { id: "crown", label: "A living crown of conquest", text: "A monarch who cannot die, and will not share." },
      { id: "green", label: "A devouring wild", text: "The forest has remembered it was here first." }
    ]
  },
  {
    key: "land",
    prompt: "Where does your story first put boots on the ground?",
    options: [
      { id: "coast", label: "Salt-cut coastal marches", text: "Cliff roads, wreck-lights, and tide-forts." },
      { id: "mount", label: "Holdfasts in the high stone", text: "Gate-towns carved into the ribs of mountains." },
      { id: "wood", label: "A mistwood border", text: "Paths that move when no one watches." },
      { id: "desert", label: "Oasis cities on a white waste", text: "Law is water. Everything else is negotiable." },
      { id: "ruin", label: "A city half-sunk in its own past", text: "New markets stacked on old temples." }
    ]
  },
  {
    key: "magic",
    prompt: "How does magic sit in this world?",
    options: [
      { id: "rare", label: "Rare and feared", text: "A working is an omen. Folk cross themselves." },
      { id: "craft", label: "Common as a craft", text: "Street-wards, licensed cantrips, guild seals." },
      { id: "wild", label: "Wild and living", text: "Spells have moods. Places argue back." },
      { id: "forbidden", label: "Outlawed and hunted", text: "The last licensed mage burned a decade ago." }
    ]
  },
  {
    key: "value",
    prompt: "What does your hero refuse to surrender?",
    options: [
      { id: "honor", label: "Honor", text: "A promise kept is worth more than a life saved cheaply." },
      { id: "knowledge", label: "Knowledge", text: "Truth first. Comfort later, if at all." },
      { id: "freedom", label: "Freedom", text: "No collar. Not yours, not anyone's." },
      { id: "vengeance", label: "A debt of blood", text: "Someone must answer for what was taken." },
      { id: "mercy", label: "Mercy", text: "You will not become the thing you hunt." }
    ]
  }
];

const NAME_BITS = {
  tone: { heroic: "Radiant", grim: "Ashen", mythic: "Veiled", folk: "Hearth" },
  land: { coast: "Marches", mount: "Holds", wood: "Weald", desert: "Sunds", ruin: "Undercity" },
  threat: {
    undead: ["the Pale Host", "the Bell-King", "the Quiet Tithe"],
    dragon: ["Kaltherax the Sky-Claim", "the Ember Concord", "the Hoard-God"],
    rift: ["the Unseamed Gate", "the Lawbreak", "the Other Noon"],
    crown: ["the Iron Succession", "Queen Unending", "the Claim"],
    green: ["the Green Hunger", "Old Root", "the Walking Copse"]
  }
};

const TOWNS = {
  coast: ["Saltmere", "Wreckhaven", "Brinegate"],
  mount: ["Anvilrest", "Highcairn", "Durin's Stair"],
  wood: ["Mothwick", "Fernhollow", "Gloamcross"],
  desert: ["Glasswell", "Nine-Lamps", "Sable Oasis"],
  ruin: ["Lowmarket", "Sumpward", "Oldstep"]
};

const PATRONS = {
  heroic: ["Marshal Irelda Voss", "Knight-Archivist Belen"],
  grim: ["Fence-Queen Marrow", "Father Coil of the Last Chapel"],
  mythic: ["The thrice-dreaming seer Ysol"],
  folk: ["Aunt Briar who keeps the ward-stones"]
};

const LOCATIONS = [
  {
    id: "town",
    nameKey: "town",
    act: 1,
    blurb: "A frontier settlement leaning into the dark like a lantern cupped against wind.",
    hooks: ["ask around the tavern", "visit the temple", "inspect the notice board", "follow a rumor into the alleys"]
  },
  {
    id: "road",
    name: "The Marching Road",
    act: 1,
    blurb: "Wagon ruts, crow-poles, and a sky that keeps its weather to itself.",
    hooks: ["scan the tree line", "hail a caravan", "search a wrecked cart", "make camp"]
  },
  {
    id: "dungeon",
    name: "The Broken Reliquary",
    act: 2,
    blurb: "Stone that remembers hymns. Dust that does not.",
    hooks: ["read the wall-carvings", "descend the stair", "force a sealed door", "listen for movement"]
  },
  {
    id: "city",
    name: "The High Market",
    act: 3,
    blurb: "Banners, bribes, and a clocktower that has started skipping hours.",
    hooks: ["seek an audience", "bribe a clerk", "shadow a courier", "consult a forbidden archive"]
  },
  {
    id: "wild",
    name: "The Unmapped Verge",
    act: 3,
    blurb: "Maps lie here out of courtesy.",
    hooks: ["track the blight", "climb for a vantage", "speak to the old stones", "hunt for forage"]
  },
  {
    id: "stronghold",
    name: "The Enemy's Threshold",
    act: 4,
    blurb: "A door built to humble armies.",
    hooks: ["scout the walls", "find a servant's gate", "challenge the watch", "sabotage a ward"]
  },
  {
    id: "heart",
    name: "The Heart of the Doom",
    act: 5,
    blurb: "This is the room the world has been leaning toward.",
    hooks: ["name the threat aloud", "shatter the focus", "bargain", "strike"]
  }
];

const MONSTERS = {
  bandit: { name: "Road Reaver", ac: 12, hp: 11, atk: 3, dmg: [1, 6, 1], xp: 2 },
  wolf: { name: "Lean Wolf", ac: 13, hp: 9, atk: 4, dmg: [1, 6, 0], xp: 2 },
  skeleton: { name: "Rattling Guard", ac: 13, hp: 13, atk: 3, dmg: [1, 6, 2], xp: 3 },
  cultist: { name: "Rift Acolyte", ac: 12, hp: 10, atk: 3, dmg: [1, 6, 1], xp: 2 },
  knight: { name: "Oathbreaker", ac: 16, hp: 22, atk: 5, dmg: [1, 8, 3], xp: 5 },
  horror: { name: "Unshaped Thing", ac: 14, hp: 28, atk: 6, dmg: [2, 6, 2], xp: 8 },
  boss: { name: "The Doom's Champion", ac: 16, hp: 48, atk: 7, dmg: [2, 8, 3], xp: 15 }
};

const TREASURE = [
  "a tarnished signet that still commands a locked drawer somewhere",
  "a vial of pale fire that heals 1d8",
  "a knife that drinks light along its edge",
  "twelve silver coins stamped with a vanished mint",
  "a scrap of map that only shows true north at midnight",
  "a charm against drowning, or drowning-adjacent fates",
  "a letter addressed to you, dated last year, in a hand you do not know"
];
