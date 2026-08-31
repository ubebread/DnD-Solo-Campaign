function buildCharacter(draft) {
  const race = raceOf(draft);
  const cls = CLASSES[draft.classId];
  const base = {};
  ABILS.forEach((k) => { base[k] = Number(draft.scores?.[k] ?? CLASS_ARRAY[cls.id][k] ?? 10); });
  const stats = applyRacial(base, race.bonuses);
  const maxHp = hitPoints(cls, stats.con, 1);
  return {
    name: (draft.name || "Nameless").trim(),
    race,
    class: cls,
    backstory: (draft.backstory || "").trim(),
    motivation: (draft.motivation || "").trim(),
    method: draft.method || "standard",
    baseScores: base,
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
    answers, name: worldName, threat, threatName, town, patron, relic,
    magic: answers.magic, value: answers.value, act: 1, flags: {}, log: [],
    locationId: "town", visited: ["town"],
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
  if (has("search", "look", "inspect", "examine", "read", "listen", "study", "perceive")) return "search";
  if (has("sneak", "hide", "steal", "pick", "lock", "creep")) return "sneak";
  if (has("travel", "go to", "leave", "walk", "ride", "head", "follow the road", "enter", "descend")) return "travel";
  if (has("rest", "sleep", "camp", "heal", "second wind", "pray")) return "rest";
  if (has("use", "drink", "equip", "give")) return "use";
  if (has("help", "aid", "protect")) return "help";
  return "act";
}

function skillFor(intent, character, text = "") {
  const t = text.toLowerCase();
  if (intent === "attack") return character.class.attack;
  if (intent === "sneak") return "dex";
  if (intent === "talk") return /insight|motive|sense/.test(t) ? "wis" : "cha";
  if (intent === "search") return /read|study|recall|arcane|history/.test(t) ? "int" : "wis";
  if (intent === "travel") return /endure|force|climb|lift/.test(t) ? "str" : /track|forage|weather/.test(t) ? "wis" : "dex";
  if (intent === "rest") return "con";
  return "wis";
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
    town: ["bandit"], road: ["bandit", "wolf"], dungeon: ["skeleton", "cultist"],
    city: ["bandit", "cultist"], wild: ["wolf", "horror"], stronghold: ["knight", "cultist"], heart: ["boss"]
  };
  const id = pick(table[loc] || ["bandit"]);
  const proto = MONSTERS[id];
  const n = id === "boss" ? 1 : 1 + (Math.random() < 0.35 ? 1 : 0);
  state.combat = {
    foes: Array.from({ length: n }, (_, i) => ({
      ...clone(proto), id: id + i, hp: proto.hp + (state.world.act - 1) * 3
    }))
  };
  return true;
}

function playerDamage(character) {
  const mods = {};
  ABILS.forEach((k) => { mods[k] = modOf(character.stats[k]); });
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
    if (state.world.locationId === "heart") lines.push(advanceQuest(state, "the last champion falls"));
    else if (Math.random() < 0.45) lines.push(advanceQuest(state, "the fight revealed a next step"));
    maybeLevel(state, lines);
  }
  if (c.hp <= 0) {
    const death = Dice.check(modOf(c.stats.con), 10);
    lines.push(`Death save. ${death.detail}`);
    c.hp = 1;
    lines.push(death.ok ? "Constitution keeps a thread of breath. You fall, but you are not finished." : "You drop. An ally of circumstance drags you clear — this campaign does not end on the first fall.");
    state.combat = null;
    state.world.locationId = "town";
  }
  return lines;
}
