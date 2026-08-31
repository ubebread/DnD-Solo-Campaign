function maybeLevel(state, lines) {
  const c = state.character;
  const need = c.level * 8;
  if (c.xp >= need) {
    c.level += 1;
    const con = modOf(c.stats.con);
    const gained = Math.floor(c.class.hitDie / 2) + 1 + con;
    c.maxHp += Math.max(1, gained);
    c.hp = c.maxHp;
    const grow = pick(ABILS);
    c.stats[grow] += 1;
    lines.push(`You take a new measure of yourself. Level ${c.level}. ${grow.toUpperCase()} rises. Health increases by ${Math.max(1, gained)} (CON).`);
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
    const con = Math.max(0, modOf(c.stats.con));
    const heal = c.class.hitDie + con + Dice.roll(c.class.hitDie);
    c.hp = Math.min(c.maxHp, c.hp + heal);
    c.breathUsed = false;
    c.restReady = false;
    lines.push(`You take what rest the ${locationOf(state).name} allows. Hit dice and Constitution recover ${heal} (${c.hp}/${c.maxHp}).`);
    return lines;
  }
  if (dest && dest !== w.locationId) {
    const travelSkill = skillFor("travel", c, text);
    const chk = Dice.check(modOf(c.stats[travelSkill]), dcFor("travel", state));
    lines.push(`${chk.detail} (${travelSkill.toUpperCase()})`);
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
  const skill = skillFor(intent, c, text);
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

function snapshot(state) {
  const c = state.character;
  const loc = locationOf(state);
  const mods = {};
  ABILS.forEach((k) => { mods[k] = `${c.stats[k]} (${modOf(c.stats[k]) >= 0 ? "+" : ""}${modOf(c.stats[k])})`; });
  return {
    world: state.world.name,
    tone: state.world.answers?.tone,
    threat: state.world.threatName,
    town: state.world.town,
    patron: state.world.patron,
    relic: state.world.relic,
    magic: state.world.magic,
    value: state.world.value,
    act: state.world.act,
    place: loc.name,
    placeBlurb: loc.blurb,
    quest: state.world.quest,
    hero: {
      name: c.name,
      race: c.race.name,
      class: c.class.name,
      level: c.level,
      hp: `${c.hp}/${c.maxHp}`,
      stats: mods,
      inventory: c.inventory,
      gold: c.gold,
      backstory: c.backstory,
      motivation: c.motivation
    },
    combat: state.combat ? state.combat.foes.map((f) => `${f.name} (${f.hp} hp)`) : null
  };
}

const Engine = {
  Storage,
  Settings,
  modOf,
  buildCharacter,
  generateWorld,
  openingNarration,
  resolveAction,
  suggestions,
  locationOf,
  snapshot,
  applyRacial,
  raceOf,
  pointBuySpent,
  emptyScores,
  hitPoints,
  normalizeCharacter,
  newGame(answers, draft) {
    const character = buildCharacter(draft);
    const world = generateWorld(answers);
    const state = { character, world, combat: null, createdAt: Date.now() };
    world.log.push({ who: "dm", text: openingNarration(state) });
    Storage.create(state, `${character.name} — ${world.name}`);
    return state;
  }
};
