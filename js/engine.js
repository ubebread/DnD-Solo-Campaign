const SAVE_KEY = "ashen-way-save-v1";

function modOf(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(SAVE_KEY);
  }
};

function buildCharacter(draft) {
  const race = draft.raceId === "custom"
    ? {
        id: "custom",
        name: draft.customRaceName || "Custom Lineage",
        traits: [draft.customTrait || "Unique Heritage"],
        features: draft.customTrait || "A lineage the world has no tidy name for.",
        bonuses: {
          str: Number(draft.customBonuses?.str || 0),
          dex: Number(draft.customBonuses?.dex || 0),
          cha: Number(draft.customBonuses?.cha || 0),
          int: Number(draft.customBonuses?.int || 0),
          hp: Number(draft.customBonuses?.hp || 0)
        }
      }
    : RACES[draft.raceId];
  const cls = CLASSES[draft.classId];
  const base = { str: 13, dex: 13, cha: 12, int: 12 };
  if (cls.primary) base[cls.primary] = 15;
  const stats = {
    str: base.str + race.bonuses.str,
    dex: base.dex + race.bonuses.dex,
    cha: base.cha + race.bonuses.cha,
    int: base.int + race.bonuses.int
  };
  const maxHp = 8 + cls.hp + race.bonuses.hp + Math.max(0, modOf(stats.str));
  return {
    name: (draft.name || "Nameless").trim(),
    race,
    class: cls,
    backstory: (draft.backstory || "").trim(),
    motivation: (draft.motivation || "").trim(),
    stats,
    hp: maxHp,
    maxHp,
    level: 1,
    xp: 0,
    gold: 12,
    inventory: ["traveler's pack", "a worn weapon of your calling", "a token from home"],
    conditions: [],
    breathUsed: false,
    restReady: true
  };
}

function generateWorld(answers) {
  const land = answers.land || "wood";
  const threat = answers.threat || "undead";
  const tone = answers.tone || "heroic";
  const worldName = `${NAME_BITS.tone[tone]} ${NAME_BITS.land[land]}`;
  const threatName = pick(NAME_BITS.threat[threat]);
  const town = pick(TOWNS[land]);
  const patron = pick(PATRONS[tone] || PATRONS.heroic);
  const relic = pick(["Shard of First Dawn", "Oathbound Lantern", "Key of Unmaking", "Heartwood Seal"]);
  return {
    answers,
    name: worldName,
    threat,
    threatName,
    town,
    patron,
    relic,
    magic: answers.magic,
    value: answers.value,
    act: 1,
    flags: {},
    log: [],
    locationId: "town",
    visited: ["town"],
    quest: {
      title: `Stay the ${threatName}`,
      stages: [
        "Learn what the settlement knows",
        `Recover a lead toward the ${relic}`,
        "Turn a city or wild power to your side",
        "Breach the enemy threshold",
        `End the ${threatName}`
      ],
      stage: 0
    }
  };
}

function locationOf(state) {
  const loc = LOCATIONS.find((l) => l.id === state.world.locationId) || LOCATIONS[0];
  const name = loc.nameKey === "town" ? state.world.town : loc.name;
  return { ...loc, name };
}

function flavorThreat(world) {
  const map = {
    undead: "the dead have stopped keeping their appointments with the grave",
    dragon: "a winged claim has been laid across the sky",
    rift: "the air has seams, and things are picking at them",
    crown: "a throne is eating its neighbors",
    green: "roots have begun to vote"
  };
  return map[world.threat] || "something old has sat up";
}

function openingNarration(state) {
  const w = state.world;
  const c = state.character;
  return [
    `The ${w.name} do not put this in the travel pamphlets: ${flavorThreat(w)}. Folk in ${w.town} keep their doors marked and their voices low.`,
    `${c.name} the ${c.race.name} ${c.class.name} arrives with ${c.motivation ? "a private reason that will not stay private" : "little more than a name and a willingness to be useful"}. ${w.patron} has left word at the gate: if anyone still means to stand in the way of ${w.threatName}, they should come inside before the weather changes.`,
    `The main road out of ${w.town} already smells like a story that has decided you are in it. What do you do?`
  ].join("\n\n");
}

function intentFrom(text) {
  const t = text.toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));
  if (has("attack", "strike", "kill", "fight", "shoot", "stab", "cast at", "breath")) return "attack";
  if (has("talk", "ask", "speak", "persuade", "intimidate", "negotiate", "bargain", "tell")) return "talk";
  if (has("search", "look", "inspect", "examine", "read", "listen", "study")) return "search";
  if (has("sneak", "hide", "steal", "pick", "lock", "creep")) return "sneak";
  if (has("travel", "go to", "leave", "walk", "ride", "head", "follow the road", "enter", "descend")) return "travel";
  if (has("rest", "sleep", "camp", "heal", "second wind", "pray")) return "rest";
  if (has("use", "drink", "equip", "give")) return "use";
  if (has("help", "aid", "protect")) return "help";
  return "act";
}

function skillFor(intent, character) {
  if (intent === "attack") return character.class.attack;
  if (intent === "sneak") return "dex";
  if (intent === "talk") return "cha";
  if (intent === "search") return "int";
  if (intent === "travel") return "dex";
  return "str";
}

function dcFor(intent, state) {
  const act = state.world.act;
  const base = { attack: 12, sneak: 13, talk: 12, search: 11, travel: 10, rest: 8, use: 10, help: 11, act: 12 };
  return (base[intent] || 12) + Math.max(0, act - 1);
}

function advanceQuest(state, reason) {
  const q = state.world.quest;
  if (q.stage < q.stages.length - 1) {
    q.stage += 1;
    state.world.act = Math.min(5, q.stage + 1);
    return `The tale leans forward. New charge: ${q.stages[q.stage]}. (${reason})`;
  }
  state.world.flags.won = true;
  return `The ${state.world.threatName} breaks. The ${state.world.name} will argue for a generation about who did it, but the sky is ordinary again.`;
}

function maybeCombat(state, intent) {
  if (state.combat) return true;
  const loc = state.world.locationId;
  const chance = intent === "attack" ? 0.85 : loc === "town" ? 0.12 : loc === "road" ? 0.28 : loc === "dungeon" ? 0.4 : loc === "stronghold" ? 0.55 : loc === "heart" ? 0.7 : 0.22;
  if (Math.random() > chance) return false;
  const table = {
    town: ["bandit"],
    road: ["bandit", "wolf"],
    dungeon: ["skeleton", "cultist"],
    city: ["bandit", "cultist"],
    wild: ["wolf", "horror"],
    stronghold: ["knight", "cultist"],
    heart: ["boss"]
  };
  const id = pick(table[loc] || ["bandit"]);
  const proto = MONSTERS[id];
  const n = id === "boss" ? 1 : 1 + (Math.random() < 0.35 ? 1 : 0);
  state.combat = {
    foes: Array.from({ length: n }, (_, i) => ({
      ...clone(proto),
      id: id + i,
      hp: proto.hp + (state.world.act - 1) * 3
    }))
  };
  return true;
}

function playerDamage(character) {
  const mods = {
    str: modOf(character.stats.str),
    dex: modOf(character.stats.dex),
    cha: modOf(character.stats.cha),
    int: modOf(character.stats.int)
  };
  return Dice.parse(character.class.damage, mods);
}

function resolveCombatAction(state, text) {
  const c = state.character;
  const intent = intentFrom(text);
  const lines = [];
  if (intent === "rest" || text.toLowerCase().includes("flee") || text.toLowerCase().includes("run")) {
    const chk = Dice.check(modOf(c.stats.dex), 13);
    lines.push(chk.detail);
    if (chk.ok) {
      state.combat = null;
      lines.push("You tear free of the melee and put stone or trees between you and teeth.");
      return lines;
    }
    lines.push("The way out closes. The fight keeps you.");
  } else {
    const atkMod = modOf(c.stats[c.class.attack]);
    const foe = state.combat.foes.find((f) => f.hp > 0);
    const hit = Dice.check(atkMod, foe.ac);
    lines.push(`You go at ${foe.name}. ${hit.detail}`);
    if (hit.ok || hit.nat20) {
      const dmg = playerDamage(c);
      const extra = c.class.id === "rogue" && (hit.nat20 || Math.random() < 0.5) ? Dice.roll(6) : 0;
      const breath = /breath|exhale|cone/.test(text.toLowerCase()) && c.race.id === "dragonborn" && !c.breathUsed;
      let total = dmg.total + extra + (breath ? 8 : 0) + (hit.nat20 ? dmg.total : 0);
      if (breath) c.breathUsed = true;
      foe.hp -= total;
      lines.push(`${dmg.detail}${extra ? ` + sneak ${extra}` : ""}${breath ? " + breath 8" : ""}. ${foe.name} takes ${total}.`);
      if (foe.hp <= 0) lines.push(`${foe.name} drops.`);
    } else {
      lines.push("The blow slides off armor, luck, or contempt.");
    }
  }
  for (const foe of state.combat.foes.filter((f) => f.hp > 0)) {
    const def = 10 + modOf(c.stats.dex);
    const hit = Dice.check(foe.atk, def);
    if (hit.ok) {
      const dmg = Dice.roll(foe.dmg[1]) * foe.dmg[0] + foe.dmg[2];
      c.hp = Math.max(0, c.hp - dmg);
      lines.push(`${foe.name} answers (${hit.detail}) and deals ${dmg}.`);
    } else {
      lines.push(`${foe.name} misses you (${hit.detail}).`);
    }
  }
  if (state.combat.foes.every((f) => f.hp <= 0)) {
    const xp = state.combat.foes.reduce((s, f) => s + (MONSTERS[f.id.replace(/\d+$/, "")]?.xp || 3), 0);
    c.xp += xp;
    c.gold += 1 + Dice.roll(6);
    const loot = pick(TREASURE);
    c.inventory.push(loot);
    lines.push(`The ground goes quiet. You gain ${xp} XP and find ${loot}.`);
    state.combat = null;
    if (state.world.locationId === "heart") {
      lines.push(advanceQuest(state, "the last champion falls"));
    } else if (Math.random() < 0.45) {
      lines.push(advanceQuest(state, "the fight revealed a next step"));
    }
    maybeLevel(state, lines);
  }
  if (c.hp <= 0) {
    lines.push("Darkness, then a stubborn thread of breath. You fall. The campaign is not kind, but it is not finished if you crawl to a rest.");
    c.hp = 1;
    state.combat = null;
    state.world.locationId = "town";
  }
  return lines;
}

function maybeLevel(state, lines) {
  const c = state.character;
  const need = c.level * 8;
  if (c.xp >= need) {
    c.level += 1;
    c.maxHp += 4 + Math.max(0, modOf(c.stats.str));
    c.hp = c.maxHp;
    const grow = pick(["str", "dex", "cha", "int"]);
    c.stats[grow] += 1;
    lines.push(`You take a new measure of yourself. Level ${c.level}. ${grow.toUpperCase()} rises. Health fills.`);
  }
}

function travelTarget(text, state) {
  const t = text.toLowerCase();
  const unlocked = (id, act) => state.world.act >= act || state.world.visited.includes(id);
  if (/town|tavern|gate|market stall/.test(t)) return "town";
  if (/road|caravan|wilds edge/.test(t)) return "road";
  if (/reliquary|ruin|dungeon|crypt|shrine/.test(t) && unlocked("dungeon", 2)) return "dungeon";
  if (/city|high market|archive|audience/.test(t) && unlocked("city", 3)) return "city";
  if (/verge|forest|waste|wild/.test(t) && unlocked("wild", 3)) return "wild";
  if (/threshold|stronghold|fort|gate of/.test(t) && unlocked("stronghold", 4)) return "stronghold";
  if (/heart|doom|final|boss|sanctum/.test(t) && unlocked("heart", 5)) return "heart";
  const order = ["town", "road", "dungeon", "city", "wild", "stronghold", "heart"];
  const idx = order.indexOf(state.world.locationId);
  if (/onward|forward|deeper|continue/.test(t) && idx < order.length - 1) {
    const next = LOCATIONS.find((l) => l.id === order[idx + 1]);
    if (state.world.act >= next.act) return next.id;
  }
  return null;
}

function resolveAction(state, text) {
  const c = state.character;
  const w = state.world;
  if (state.combat) return resolveCombatAction(state, text);

  const intent = intentFrom(text);
  const dest = travelTarget(text, state);
  const lines = [];

  if (intent === "rest") {
    if (!c.restReady && !/force/.test(text.toLowerCase())) {
      lines.push("You have already spent the day's quiet. A forced rest is a gamble.");
    }
    const heal = 2 + Dice.roll(6) + Math.max(0, modOf(c.stats.str));
    c.hp = Math.min(c.maxHp, c.hp + heal);
    c.breathUsed = false;
    c.restReady = false;
    lines.push(`You take what rest the ${locationOf(state).name} allows. Health recovers by ${heal} (${c.hp}/${c.maxHp}).`);
    return lines;
  }

  if (dest && dest !== w.locationId) {
    const chk = Dice.check(modOf(c.stats.dex), dcFor("travel", state));
    lines.push(chk.detail);
    if (chk.ok || chk.nat20) {
      w.locationId = dest;
      if (!w.visited.includes(dest)) w.visited.push(dest);
      const loc = locationOf(state);
      lines.push(`The path accepts you. You reach ${loc.name}. ${loc.blurb}`);
      if (["dungeon", "city", "stronghold", "heart"].includes(dest) && w.quest.stage < 4) {
        if (Math.random() < 0.6) lines.push(advanceQuest(state, "the new ground changes the problem"));
      }
      maybeCombat(state, "travel");
      if (state.combat) lines.push(`Something was waiting. ${state.combat.foes.map((f) => f.name).join(" and ")} step into reach.`);
    } else {
      lines.push("Weather, watchmen, or the land itself turns you aside. You remain where you are, a little more tired.");
      c.hp = Math.max(1, c.hp - 1);
    }
    return lines;
  }

  const skill = skillFor(intent, c);
  let adv = 0;
  if (c.race.id === "elf" && intent === "search") adv = 1;
  if (c.race.id === "dwarf" && /stone|door|mason|ruin/.test(text.toLowerCase())) adv = 1;
  if (c.race.id === "tiefling" && intent === "talk" && /threat|fear|infernal|fire/.test(text.toLowerCase())) adv = 1;
  if (c.race.id === "human") adv = Math.random() < 0.2 ? 1 : adv;
  const chk = Dice.check(modOf(c.stats[skill]), dcFor(intent, state), adv);
  lines.push(`${chk.detail} (${skill.toUpperCase()})`);

  if (chk.nat1) {
    lines.push("The world takes the cheap laugh. A tool snaps, a witness bristles, or the floor remembers it is a trap.");
    c.hp = Math.max(1, c.hp - 2);
    maybeCombat(state, "attack");
    if (state.combat) lines.push(`Trouble answers: ${state.combat.foes.map((f) => f.name).join(", ")}.`);
    return lines;
  }

  if (!chk.ok) {
    lines.push(failLine(intent, state, text));
    if (Math.random() < 0.35) {
      maybeCombat(state, intent);
      if (state.combat) lines.push(`The failure has company. ${state.combat.foes.map((f) => f.name).join(" and ")} have noticed you.`);
    }
    return lines;
  }

  lines.push(successLine(intent, state, text, chk.nat20));
  if (intent === "search" && Math.random() < 0.4) {
    const loot = pick(TREASURE);
    c.inventory.push(loot);
    c.gold += Dice.roll(4);
    lines.push(`Tucked where only patience looks: ${loot}.`);
  }
  if (intent === "talk" && Math.random() < 0.5) {
    lines.push(`${w.patron} — or someone who claims their seal — points you toward the next necessary trouble.`);
    if (Math.random() < 0.4) lines.push(advanceQuest(state, "a conversation opened a door"));
  }
  if (intent === "attack") {
    maybeCombat(state, "attack");
    if (state.combat) {
      lines.push(`Steel it is. ${state.combat.foes.map((f) => f.name).join(" and ")} close.`);
      lines.push(...resolveCombatAction(state, text));
    }
  }
  if (w.locationId === "heart" && intent !== "attack" && chk.nat20) {
    lines.push(advanceQuest(state, "you found a cleaner ending than a duel"));
  }
  maybeLevel(state, lines);
  return lines;
}

function successLine(intent, state, text, crit) {
  const loc = locationOf(state).name;
  const w = state.world;
  const critBit = crit ? " Luck leans in like a conspirator." : "";
  const map = {
    talk: `Someone in ${loc} decides you are worth the truth, or a useful fraction of it. Word of ${w.threatName} thickens.`,
    search: `The ${loc} gives up a detail it had been sitting on. Marks, footprints, a name scratched twice.`,
    sneak: `You pass through the place like a rumor. Locks and listeners both miss their cue.`,
    travel: `The way opens. Distance becomes a story you can tell later.`,
    use: `The thing in your pack remembers its job.`,
    help: `Whoever you stood for will remember it. In these lands that is currency.`,
    act: `You do the thing. The ${w.name} adjusts itself around the fact.`
  };
  return (map[intent] || map.act) + critBit + ` ("${text}")`;
}

function failLine(intent, state, text) {
  const map = {
    talk: "The listener smiles with none of their eyes. You get weather and platitudes.",
    search: "Dust, ordinary stone, and the sense you looked one shelf too early.",
    sneak: "A board complains. Someone in another room stops pretending not to hear.",
    travel: "The path doubles back out of spite.",
    use: "The item sulks. Not now.",
    help: "Your help is taken as interference. The moment cools.",
    act: "The world declines, politely but firmly."
  };
  return `${map[intent] || map.act} ("${text}")`;
}

function suggestions(state) {
  if (state.combat) {
    return ["Strike the nearest foe", "Try to flee", "Defend and watch", state.character.race.id === "dragonborn" && !state.character.breathUsed ? "Unleash your breath" : "Call a class feature"];
  }
  const loc = locationOf(state);
  const extras = {
    town: [`Find ${state.world.patron}`, "Ask the tavern about the doom", "Read the notice board"],
    road: ["Follow the marching road", "Search a wrecked cart", "Make a cautious camp"],
    dungeon: ["Descend toward the relic", "Read the wall-carvings", "Listen before the next door"],
    city: ["Seek an audience", "Consult a forbidden archive", "Shadow a courier"],
    wild: ["Track the blight", "Speak to the old stones"],
    stronghold: ["Scout the walls", "Find a servant's gate"],
    heart: [`Name ${state.world.threatName} and strike`, "Shatter the focus", "Attempt a last bargain"]
  };
  return extras[loc.id] || loc.hooks;
}

const Engine = {
  Storage,
  modOf,
  buildCharacter,
  generateWorld,
  openingNarration,
  resolveAction,
  suggestions,
  locationOf,
  newGame(answers, draft) {
    const character = buildCharacter(draft);
    const world = generateWorld(answers);
    const state = { character, world, combat: null, createdAt: Date.now() };
    world.log.push({ who: "dm", text: openingNarration(state) });
    Storage.save(state);
    return state;
  }
};
