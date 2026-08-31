const SETTINGS_KEY = "ashen-way-settings-v1";
const SLOTS_KEY = "ashen-way-slots-v2";
const LEGACY_KEY = "ashen-way-save-v1";

function modOf(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function uid() {
  return "s" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function emptyScores() {
  return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
}

function pointBuySpent(scores) {
  return ABILS.reduce((sum, k) => sum + (POINT_BUY_COST[scores[k]] ?? 99), 0);
}

function raceOf(draft) {
  if (draft.raceId !== "custom") return RACES[draft.raceId];
  const bonuses = {};
  ABILS.forEach((k) => { bonuses[k] = Number(draft.customBonuses?.[k] || 0); });
  return {
    id: "custom",
    name: draft.customRaceName || "Custom Lineage",
    traits: [draft.customTrait || "Unique Heritage"],
    features: draft.customTrait || "A lineage the world has no tidy name for.",
    bonuses
  };
}

function applyRacial(base, bonuses) {
  const out = {};
  ABILS.forEach((k) => { out[k] = Number(base[k] || 8) + Number(bonuses?.[k] || 0); });
  return out;
}

function hitPoints(cls, conScore, level) {
  const con = modOf(conScore);
  const first = cls.hitDie + con;
  if (level <= 1) return Math.max(1, first);
  const per = Math.floor(cls.hitDie / 2) + 1 + con;
  return Math.max(1, first + per * (level - 1));
}

function normalizeCharacter(c) {
  if (!c) return c;
  c.stats = c.stats || emptyScores();
  ABILS.forEach((k) => {
    if (c.stats[k] == null) c.stats[k] = k === "con" || k === "wis" ? 10 : 12;
  });
  if (!c.maxHp) c.maxHp = hitPoints(c.class || CLASSES.fighter, c.stats.con, c.level || 1);
  if (c.hp == null) c.hp = c.maxHp;
  return c;
}

const Settings = {
  defaults() {
    return {
      llm: { enabled: false, provider: "off", endpoint: "", model: "", apiKey: "" }
    };
  },
  load() {
    const base = this.defaults();
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return { llm: Object.assign({}, base.llm, parsed.llm || {}) };
    } catch {
      return base;
    }
  },
  save(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }
};

const Storage = {
  _bundle() {
    try {
      const raw = localStorage.getItem(SLOTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* fall through */ }
    const bundle = { activeId: null, slots: {} };
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const state = JSON.parse(legacy);
        normalizeCharacter(state.character);
        const id = uid();
        bundle.slots[id] = {
          id,
          name: (state.character && state.character.name) || "Legacy campaign",
          updatedAt: Date.now(),
          state
        };
        bundle.activeId = id;
        state.slotId = id;
      }
    } catch { /* ignore */ }
    this._write(bundle);
    return bundle;
  },
  _write(bundle) {
    localStorage.setItem(SLOTS_KEY, JSON.stringify(bundle));
  },
  list() {
    const b = this._bundle();
    return Object.values(b.slots).sort((a, c) => c.updatedAt - a.updatedAt);
  },
  activeId() {
    return this._bundle().activeId;
  },
  load(id) {
    const b = this._bundle();
    const slot = b.slots[id || b.activeId];
    if (!slot) return null;
    normalizeCharacter(slot.state.character);
    return slot.state;
  },
  save(state) {
    const b = this._bundle();
    const id = state.slotId || b.activeId || uid();
    state.slotId = id;
    if (!b.slots[id]) {
      b.slots[id] = { id, name: state.slotName || state.character?.name || "Campaign", updatedAt: Date.now(), state };
    } else {
      b.slots[id].state = state;
      b.slots[id].updatedAt = Date.now();
      if (state.slotName) b.slots[id].name = state.slotName;
    }
    b.activeId = id;
    this._write(b);
  },
  create(state, name) {
    const b = this._bundle();
    const id = uid();
    state.slotId = id;
    state.slotName = name || state.character?.name || "New campaign";
    b.slots[id] = { id, name: state.slotName, updatedAt: Date.now(), state };
    b.activeId = id;
    this._write(b);
    return state;
  },
  remove(id) {
    const b = this._bundle();
    delete b.slots[id];
    if (b.activeId === id) b.activeId = Object.keys(b.slots)[0] || null;
    this._write(b);
  },
  rename(id, name) {
    const b = this._bundle();
    if (!b.slots[id]) return;
    b.slots[id].name = name;
    if (b.slots[id].state) b.slots[id].state.slotName = name;
    b.slots[id].updatedAt = Date.now();
    this._write(b);
  },
  clearActive() {
    const b = this._bundle();
    b.activeId = null;
    this._write(b);
  }
};
