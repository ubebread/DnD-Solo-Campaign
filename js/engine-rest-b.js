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

function namedFocus(text) {
  const clean = String(text || "").trim().replace(/[.!?]+$/, "");
  const match = clean.match(/^(?:find|meet|ask|question|speak to|talk to|consult|seek)\s+(.+?)(?:\s+who\b|\s+about\b|\s+at\b|\s+in\b|$)/i);
  return match ? match[1].trim() : "";
}

function questScene(state, text = "") {
  const w = state.world;
  const loc = locationOf(state).name;
  const focus = namedFocus(text);
  const contact = focus || w.patron;
  const t = String(text || "").toLowerCase();
  const allyScene = /stone|stones/.test(t)
    ? `The old stones answer slowly, grinding memory into words. They have felt ${w.threatName} moving under the land, and one standing circle still remembers how to bar the way — if you can wake it before the enemy does.`
    : /archive|book|record|library/.test(t)
      ? `The archive gives up its secret reluctantly: a sealed marginal note, a list of vanished wardens, and the name of someone still powerful enough to oppose ${w.threatName}. Help is possible, but it will demand proof.`
      : `The search for help becomes a person, a seal, and a guarded door. Someone with power has been resisting ${w.threatName} in secret, but fear has made them cautious; proof, leverage, or a promise will decide whether they stand with you.`;
  const scenes = [
    `In ${loc}, ${contact} draws you out of the open street and into lamplight. Their hands shake as they lay out what the settlement has been too afraid to name: signs of ${w.threatName}, witnesses who vanished after speaking, and one object named again and again in frightened whispers — ${w.relic}.`,
    `You follow the first real lead through old wax, road dust, and half-truths. By the time the pieces line up, ${w.relic} is no longer just a name; it has a direction, a warning, and someone else already moving to claim it.`,
    allyScene,
    `By dusk, the enemy threshold stains the horizon like a bruise. Torches crawl along the walls. You can feel three paths taking shape: slip through unseen, break a ward before it wakes, or step into the open and dare the gate to answer.`,
    `At the heart of the doom, the air bends around ${w.threatName}. The weakness is visible now — not a gap in armor, but a cost the enemy cannot avoid. The focus can be shattered, the true name can be spoken, or the power behind it can be bargained with.`
  ];
  return scenes[Math.min(w.quest.stage, scenes.length - 1)];
}

function stageProgressIntent(state, intent, text) {
  const stage = state.world.quest.stage;
  const t = text.toLowerCase();
  if (stage === 0) return intent === "talk" || intent === "search" || /patron|notice|rumor|tavern|temple|gate|learn|ask|clue|find/.test(t);
  if (stage === 1) return intent === "search" || intent === "travel" || /relic|lead|map|ruin|reliquary|crypt|shrine|track|follow/.test(t);
  if (stage === 2) return intent === "talk" || intent === "help" || /ally|audience|archive|stones|power|faction|bargain|seek|consult/.test(t);
  if (stage === 3) return intent === "sneak" || intent === "attack" || intent === "search" || /threshold|stronghold|gate|sabotage|scout|infiltrate|hidden way/.test(t);
  if (stage === 4) return intent === "attack" || intent === "use" || /heart|doom|focus|final|shatter|strike|bargain|weakness|confront/.test(t);
  return false;
}

function shouldRollForAction(state, intent, text, dest) {
  const t = text.toLowerCase();
  if (intent === "attack" || state.combat) return true;
  if (/force|break|pick|lock|sneak|hide|steal|flee|run|climb|jump|disarm|trap|ambush/.test(t)) return true;
  if (dest && /dangerous|storm|chase|under fire|pursued|enemy patrol/.test(t)) return true;
  if (stageProgressIntent(state, intent, text)) return false;
  if (/find|ask|follow|seek|consult|read|travel to|go to|speak to|look for|meet|listen|wait|watch|approach|enter|continue|move on/.test(t)) return false;
  if (["talk", "search", "travel", "help", "use", "act"].includes(intent) && !/danger|risky|under pressure|before they notice|without being seen/.test(t)) return false;
  return true;
}

function storyBeat(state, intent, text, succeeded) {
  const w = state.world;
  if (!succeeded) {
    return `The attempt costs time. Somewhere nearby, a bell tolls once, a door is barred in panic, and ${w.threatName} gains a little more ground while the path ahead narrows into a harder choice.`;
  }
  if (stageProgressIntent(state, intent, text)) {
    const scene = questScene(state, text);
    const charge = advanceQuest(state, "the story moved forward");
    return `${scene}\n\n${charge}`;
  }
  return questScene(state, text);
}

function resolveStoryAction(state, text, intent, dest) {
  const w = state.world;
  const lines = [];
  if (dest && dest !== w.locationId) {
    w.locationId = dest;
    if (!w.visited.includes(dest)) w.visited.push(dest);
    const loc = locationOf(state);
    lines.push(`You take the road because the story has given you a direction. By the time the light changes, ${loc.name} rises ahead. ${loc.blurb}`);
  }
  lines.push(storyBeat(state, intent, text, true));
  return lines;
}

function resolveAction(state, text) {
  const c = state.character;
  const w = state.world;
  if (state.combat) return resolveCombatAction(state, text);
  const intent = intentFrom(text);
  const dest = travelTarget(text, state);
  const lines = [];
  if (!shouldRollForAction(state, intent, text, dest)) return resolveStoryAction(state, text, intent, dest);
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
      maybeCombat(state, "travel");
      if (state.combat) lines.push(`Something was waiting. ${state.combat.foes.map((f) => f.name).join(" and ")} step into reach.`);
      if (!state.combat) lines.push(storyBeat(state, "travel", text, true));
    } else {
      lines.push("Weather, watchmen, or the land itself turns you aside. You remain where you are, a little more tired.");
      c.hp = Math.max(1, c.hp - 1);
      lines.push(storyBeat(state, "travel", text, false));
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
    if (!state.combat) lines.push(storyBeat(state, intent, text, false));
    return lines;
  }
  lines.push(successLine(intent, state, text, chk.nat20));
  if (intent === "search" && Math.random() < 0.4) {
    const loot = pick(TREASURE);
    c.inventory.push(loot);
    c.gold += Dice.roll(4);
    lines.push(`Tucked where only patience looks: ${loot}.`);
  }
  if (intent === "talk") {
    lines.push(`${w.patron} — or someone who claims their seal — points you toward the next necessary trouble.`);
  }
  if (intent !== "attack") lines.push(storyBeat(state, intent, text, true));
  if (intent === "attack") {
    maybeCombat(state, "attack");
    if (state.combat) {
      lines.push(`Steel it is. ${state.combat.foes.map((f) => f.name).join(" and ")} close.`);
      lines.push(...resolveCombatAction(state, text));
    } else {
      lines.push(storyBeat(state, intent, text, true));
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
  const critBit = crit ? " Fortune opens the door wider than expected." : "";
  const map = {
    talk: `A guarded voice in ${loc} finally gives way. The truth comes in fragments, but each fragment carries the smell of ${w.threatName}.`,
    search: `${loc} rewards patience: a scuffed mark, a repeated name, and a trail someone tried badly to hide.`,
    sneak: `You move through the place like a held breath. By the time anyone thinks to look, you are already where you needed to be.`,
    travel: `The way opens. The old distance between here and there becomes road beneath your feet.`,
    use: `The item answers your need, its small magic or clever craft changing the shape of the moment.`,
    help: `Your aid lands where it matters. Someone who expected to stand alone now looks at you as part of the story.`,
    act: `${loc} changes around your choice. A face turns, a door opens, and the next piece of the tale comes within reach.`
  };
  return (map[intent] || map.act) + critBit;
}

function failLine(intent, state, text) {
  const loc = locationOf(state).name;
  const map = {
    talk: `The answer you get in ${loc} is careful, frightened, and incomplete. Someone knows more than they are willing to say aloud.`,
    search: `You find dust, old scratches, and a silence that feels arranged. Whatever matters here was hidden by someone with time to plan.`,
    sneak: `A board complains underfoot. Somewhere nearby, a conversation stops too suddenly.`,
    travel: `The path refuses to stay simple. Weather, rumor, or wary eyes force you to pause and choose another way through.`,
    use: `For a heartbeat, the item gives you nothing. Then the situation around it gets worse.`,
    help: `Your help is misunderstood at first, and pride turns a simple mercy into a tense moment.`,
    act: `The moment resists you. Not forever — but long enough for the danger to notice.`
  };
  return map[intent] || map.act;
}

function questSuggestions(state) {
  const w = state.world;
  const loc = locationOf(state);
  const stage = w.quest.stage;
  const byStage = [
    [`Find ${w.patron}`, "Ask who last saw the omen", `Search ${loc.name} for a clue toward ${w.relic}`],
    [`Follow the lead toward ${w.relic}`, "Travel to the Broken Reliquary", "Search for the map mark or key"],
    ["Seek an ally with power", "Consult the High Market archive", "Bargain with the old stones"],
    ["Scout the enemy threshold", "Find a hidden way inside", "Sabotage the outer ward"],
    [`Confront ${w.threatName}`, "Shatter the doom's focus", "Exploit the revealed weakness"]
  ];
  return byStage[Math.min(stage, byStage.length - 1)];
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
  return [...questSuggestions(state), ...(extras[loc.id] || loc.hooks)].slice(0, 5);
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
