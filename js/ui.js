const $app = document.getElementById("app");

const ui = {
  view: "splash",
  answers: {},
  qIndex: 0,
  draft: defaultDraft(),
  state: null,
  action: "",
  lastRoll: null,
  sheetOpen: false,
  diceOpen: false,
  settings: Engine.Settings.load(),
  settingsMsg: "",
  busy: false,
  from: "splash"
};

function defaultDraft() {
  return {
    name: "",
    raceId: "human",
    classId: "fighter",
    backstory: "",
    motivation: "",
    customRaceName: "",
    customTrait: "",
    customBonuses: { str: 1, dex: 0, con: 1, int: 0, wis: 0, cha: 1 },
    method: "standard",
    scores: Object.assign({}, CLASS_ARRAY.fighter)
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function previewStats() {
  try {
    return Engine.buildCharacter(ui.draft);
  } catch {
    return null;
  }
}

function render() {
  if (ui.view === "splash") return splash();
  if (ui.view === "world") return worldView();
  if (ui.view === "hero") return heroView();
  if (ui.view === "play") return playView();
  if (ui.view === "settings") return settingsView();
}

function splash() {
  const slots = Engine.Storage.list();
  $app.innerHTML = `
    <section class="screen splash">
      <div class="hero-mark">✦</div>
      <div class="kicker">Solo table · AI dungeon master</div>
      <h1>Ashen Way</h1>
      <p class="lede">One world at a time, as many saved campaigns as you keep. Optional LLM narrator behind the same rules engine. Six 5e abilities, including Constitution and Wisdom.</p>
      <div class="btn-row">
        <button class="btn" data-go="world">Begin a campaign</button>
        <button class="btn ghost" data-go="settings">Dungeon Master settings</button>
      </div>
      ${slots.length ? `
        <div class="wrap" style="margin-top:28px;text-align:left;max-width:640px">
          <div class="kicker" style="margin-bottom:10px">Saved tables</div>
          ${slots.map((s) => `
            <div class="slot-row">
              <div>
                <strong>${esc(s.name)}</strong>
                <div class="muted">${esc(s.state?.character?.name || "")} · ${esc(s.state?.world?.name || "")} · ${fmtWhen(s.updatedAt)}</div>
              </div>
              <div class="btn-row" style="justify-content:flex-end">
                <button class="btn small" data-play="${s.id}">Play</button>
                <button class="btn ghost small" data-ren="${s.id}">Rename</button>
                <button class="btn danger small" data-del="${s.id}">Delete</button>
              </div>
            </div>`).join("")}
        </div>` : `<p class="footer-note">No saved campaigns yet.</p>`}
      <p class="footer-note">LLM keys stay in this browser. Progress is stored in named slots.</p>
    </section>`;
  $app.querySelector("[data-go=world]").onclick = () => {
    ui.answers = {}; ui.qIndex = 0; ui.draft = defaultDraft(); ui.view = "world"; render();
  };
  $app.querySelector("[data-go=settings]").onclick = () => { ui.from = "splash"; ui.view = "settings"; render(); };
  $app.querySelectorAll("[data-play]").forEach((b) => {
    b.onclick = () => {
      ui.state = Engine.Storage.load(b.dataset.play);
      ui.view = "play";
      render();
    };
  });
  $app.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      if (confirm("Delete this campaign?")) { Engine.Storage.remove(b.dataset.del); render(); }
    };
  });
  $app.querySelectorAll("[data-ren]").forEach((b) => {
    b.onclick = () => {
      const next = prompt("Slot name");
      if (next && next.trim()) { Engine.Storage.rename(b.dataset.ren, next.trim()); render(); }
    };
  });
}

function settingsView() {
  const s = ui.settings.llm;
  const on = s.provider && s.provider !== "off";
  $app.innerHTML = `
    <section class="screen">
      <div class="topbar"><div class="wrap topbar-inner">
        <div class="brand">Ashen Way</div>
        <div class="muted">Dungeon Master</div>
      </div></div>
      <div class="wrap" style="padding:24px 0 64px;max-width:720px">
        <h2>Optional LLM narrator</h2>
        <p class="muted" style="margin:8px 0 16px">Dice, combat, health, and quest flags stay in the local engine. If a key is set, the model writes the scene prose from those results. If the call fails, the built-in DM speaks instead.</p>
        <div class="card">
          <label class="field"><span>Provider</span>
            <select id="prov">${Object.entries(LLM_PROVIDERS).map(([id, p]) => `<option value="${id}" ${s.provider === id ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select>
          </label>
          <label class="check"><input type="checkbox" id="en" ${s.enabled && on ? "checked" : ""} ${on ? "" : "disabled"} /> Use the LLM for narration</label>
          <label class="field"><span>Model</span><input id="model" value="${esc(s.model)}" placeholder="${esc(LLM_PROVIDERS[s.provider]?.model || "model id")}" /></label>
          <label class="field"><span>Endpoint</span><input id="ep" value="${esc(s.endpoint || LLM_PROVIDERS[s.provider]?.endpoint || "")}" placeholder="https://api.example.com/v1/chat/completions" /></label>
          <label class="field"><span>API key</span><input id="key" type="password" value="${esc(s.apiKey)}" autocomplete="off" /></label>
          <p class="muted">Stored only in localStorage on this device. Many hosts block browser calls (CORS). If a test fails that way, point the endpoint at a local OpenAI-compatible proxy you control.</p>
          <p class="muted" id="smsg">${esc(ui.settingsMsg)}</p>
        </div>
        <div class="btn-row" style="margin-top:18px;justify-content:flex-start">
          <button class="btn ghost" id="back">Back</button>
          <button class="btn" id="save">Save</button>
          <button class="btn ghost" id="test">Test connection</button>
        </div>
      </div>
    </section>`;
  const read = () => {
    const provider = $app.querySelector("#prov").value;
    ui.settings.llm = {
      provider,
      enabled: $app.querySelector("#en").checked && provider !== "off",
      model: $app.querySelector("#model").value.trim(),
      endpoint: $app.querySelector("#ep").value.trim(),
      apiKey: $app.querySelector("#key").value.trim()
    };
  };
  $app.querySelector("#prov").onchange = () => {
    read();
    const p = $app.querySelector("#prov").value;
    if (p !== "custom") {
      ui.settings.llm.endpoint = LLM_PROVIDERS[p].endpoint;
      if (!ui.settings.llm.model) ui.settings.llm.model = LLM_PROVIDERS[p].model;
    }
    if (p === "off") ui.settings.llm.enabled = false;
    render();
  };
  $app.querySelector("#back").onclick = () => { ui.view = ui.from || "splash"; render(); };
  $app.querySelector("#save").onclick = () => {
    read();
    Engine.Settings.save(ui.settings);
    ui.settingsMsg = "Saved on this device.";
    render();
  };
  $app.querySelector("#test").onclick = async () => {
    read();
    Engine.Settings.save(ui.settings);
    ui.settingsMsg = "Calling the model…";
    render();
    try {
      const text = await LLM.test();
      ui.settingsMsg = "Answered: " + text;
    } catch (err) {
      ui.settingsMsg = "Failed: " + err.message;
    }
    render();
  };
}

function worldView() {
  const q = WORLD_Q[ui.qIndex];
  const selected = ui.answers[q.key];
  $app.innerHTML = `
    <section class="screen">
      <div class="topbar"><div class="wrap topbar-inner">
        <div class="brand">Ashen Way</div>
        <div class="muted">Worldwright</div>
      </div></div>
      <div class="wrap" style="padding:24px 0 48px">
        <div class="steps">${WORLD_Q.map((item, i) => `<div class="step ${i === ui.qIndex ? "on" : ""}">${i + 1}. ${item.key}</div>`).join("")}</div>
        <h2 style="margin-bottom:8px">${esc(q.prompt)}</h2>
        <p class="muted" style="margin-bottom:16px">The dungeon master will keep these answers and build the map around them.</p>
        <div class="grid two">
          ${q.options.map((o) => `
            <button class="choice ${selected === o.id ? "selected" : ""}" data-id="${o.id}">
              <h3>${esc(o.label)}</h3><p>${esc(o.text)}</p>
            </button>`).join("")}
        </div>
        <div class="btn-row" style="margin-top:22px;justify-content:flex-start">
          ${ui.qIndex ? `<button class="btn ghost" id="back">Back</button>` : `<button class="btn ghost" id="home">Home</button>`}
          <button class="btn" id="next" ${selected ? "" : "disabled"}>${ui.qIndex === WORLD_Q.length - 1 ? "Forge the world" : "Next omen"}</button>
        </div>
      </div>
    </section>`;
  $app.querySelectorAll(".choice").forEach((btn) => {
    btn.onclick = () => { ui.answers[q.key] = btn.dataset.id; render(); };
  });
  const back = $app.querySelector("#back");
  if (back) back.onclick = () => { ui.qIndex -= 1; render(); };
  const home = $app.querySelector("#home");
  if (home) home.onclick = () => { ui.view = "splash"; render(); };
  $app.querySelector("#next").onclick = () => {
    if (!ui.answers[q.key]) return;
    if (ui.qIndex < WORLD_Q.length - 1) { ui.qIndex += 1; render(); }
    else { ui.view = "hero"; render(); }
  };
}

function abilityBlock() {
  const d = ui.draft;
  const race = Engine.raceOf(d);
  const spent = Engine.pointBuySpent(d.scores);
  const leftover = POINT_BUY_BUDGET - spent;
  return `
    <div class="card" style="margin-top:14px">
      <div class="kicker">Ability scores</div>
      <p class="muted" style="margin:6px 0 10px">5e array: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma. Racial bonuses apply after you set the base scores.</p>
      <div class="btn-row" style="justify-content:flex-start;margin-bottom:10px">
        <button class="chip ${d.method === "standard" ? "on" : ""}" data-method="standard">Standard array</button>
        <button class="chip ${d.method === "pointbuy" ? "on" : ""}" data-method="pointbuy">Point buy (27)</button>
        <button class="chip ${d.method === "roll" ? "on" : ""}" data-method="roll">4d6 drop lowest</button>
      </div>
      ${d.method === "pointbuy" ? `<p class="muted">Points remaining: <b class="gold">${leftover}</b> / ${POINT_BUY_BUDGET}</p>` : ""}
      <div class="abil-grid">
        ${ABILS.map((k) => {
          const base = Number(d.scores[k] || 8);
          const bonus = Number(race.bonuses?.[k] || 0);
          const total = base + bonus;
          const opts = d.method === "pointbuy"
            ? [8, 9, 10, 11, 12, 13, 14, 15]
            : [18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8];
          return `<label class="abil">
            <span>${ABIL_LABEL[k]}</span>
            <select data-score="${k}">
              ${opts.map((n) => `<option value="${n}" ${base === n ? "selected" : ""}>${n}</option>`).join("")}
            </select>
            <em>${bonus ? "+" + bonus : "—"} race → <b>${total}</b> (${Engine.modOf(total) >= 0 ? "+" : ""}${Engine.modOf(total)})</em>
          </label>`;
        }).join("")}
      </div>
    </div>`;
}

function heroView() {
  const d = ui.draft;
  const preview = previewStats();
  $app.innerHTML = `
    <section class="screen">
      <div class="topbar"><div class="wrap topbar-inner">
        <div class="brand">Ashen Way</div>
        <div class="muted">Character</div>
      </div></div>
      <div class="wrap" style="padding:24px 0 64px">
        <h2>Who walks into this?</h2>
        <p class="muted" style="margin:8px 0 18px">Five lineages, or a custom bloodline. Health is hit die + Constitution modifier.</p>
        <div class="grid two">
          <div class="card">
            <label class="field"><span>Name</span><input id="nm" value="${esc(d.name)}" placeholder="A name the songs can carry" /></label>
            <label class="field"><span>Class</span>
              <select id="cls">${Object.values(CLASSES).map((c) => `<option value="${c.id}" ${d.classId === c.id ? "selected" : ""}>${c.name} — ${c.blurb}</option>`).join("")}</select>
            </label>
            <label class="field"><span>Backstory</span><textarea id="bs" placeholder="Where you come from, briefly">${esc(d.backstory)}</textarea></label>
            <label class="field"><span>Motivation</span><textarea id="mo" placeholder="What you will not put down">${esc(d.motivation)}</textarea></label>
          </div>
          <div>
            <div class="grid races">
              ${Object.values(RACES).map((r) => `
                <button class="choice ${d.raceId === r.id ? "selected" : ""}" data-race="${r.id}">
                  <h3>${esc(r.name)}</h3><p>${esc(r.blurb)}</p>
                </button>`).join("")}
              <button class="choice ${d.raceId === "custom" ? "selected" : ""}" data-race="custom">
                <h3>Custom lineage</h3><p>Name it. Spend a handful of +1s. Write the trait the world has no word for.</p>
              </button>
            </div>
            ${d.raceId === "custom" ? `
              <div class="card" style="margin-top:14px">
                <label class="field"><span>Lineage name</span><input id="crn" value="${esc(d.customRaceName)}" /></label>
                <label class="field"><span>Signature trait</span><input id="crt" value="${esc(d.customTrait)}" /></label>
                <p class="muted">Racial bonuses (about +3 total is fair)</p>
                <div class="stat-pills" style="margin-top:8px">
                  ${ABILS.map((k) => `<label class="pill">${k.toUpperCase()} <input type="number" min="0" max="2" data-b="${k}" value="${d.customBonuses[k] || 0}" style="width:48px;background:transparent;border:0;color:var(--gold-2)"></label>`).join("")}
                </div>
              </div>` : ""}
          </div>
        </div>
        ${abilityBlock()}
        ${preview ? `
          <div class="card" style="margin-top:14px">
            <div class="kicker">Projected sheet</div>
            <div class="stat-pills">
              ${ABILS.map((k) => `<div class="pill">${k.toUpperCase()} <b>${preview.stats[k]}</b></div>`).join("")}
              <div class="pill">HP <b>${preview.maxHp}</b></div>
            </div>
            <p class="muted" style="margin-top:8px">${esc(preview.race.features)} Hit die d${preview.class.hitDie}.</p>
          </div>` : ""}
        <div class="btn-row" style="margin-top:22px;justify-content:flex-start">
          <button class="btn ghost" id="back">Back</button>
          <button class="btn" id="start">Step into the tale</button>
        </div>
      </div>
    </section>`;
  const bind = () => {
    ui.draft.name = $app.querySelector("#nm").value;
    ui.draft.classId = $app.querySelector("#cls").value;
    ui.draft.backstory = $app.querySelector("#bs").value;
    ui.draft.motivation = $app.querySelector("#mo").value;
    const crn = $app.querySelector("#crn"); if (crn) ui.draft.customRaceName = crn.value;
    const crt = $app.querySelector("#crt"); if (crt) ui.draft.customTrait = crt.value;
    $app.querySelectorAll("[data-b]").forEach((inp) => { ui.draft.customBonuses[inp.dataset.b] = Number(inp.value || 0); });
    $app.querySelectorAll("[data-score]").forEach((sel) => { ui.draft.scores[sel.dataset.score] = Number(sel.value); });
  };
  ["#nm", "#cls", "#bs", "#mo", "#crn", "#crt"].forEach((sel) => {
    const el = $app.querySelector(sel);
    if (el) el.addEventListener("change", () => {
      const prevClass = ui.draft.classId;
      bind();
      if (sel === "#cls" && ui.draft.method === "standard" && ui.draft.classId !== prevClass) {
        ui.draft.scores = Object.assign({}, CLASS_ARRAY[ui.draft.classId]);
      }
      render();
    });
  });
  $app.querySelectorAll("[data-b],[data-score]").forEach((el) => el.addEventListener("change", () => { bind(); render(); }));
  $app.querySelectorAll("[data-race]").forEach((btn) => {
    btn.onclick = () => { bind(); ui.draft.raceId = btn.dataset.race; render(); };
  });
  $app.querySelectorAll("[data-method]").forEach((btn) => {
    btn.onclick = () => {
      bind();
      ui.draft.method = btn.dataset.method;
      if (ui.draft.method === "standard") ui.draft.scores = Object.assign({}, CLASS_ARRAY[ui.draft.classId]);
      if (ui.draft.method === "pointbuy") ui.draft.scores = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
      if (ui.draft.method === "roll") {
        const rolled = {};
        ABILS.forEach((k) => { rolled[k] = Dice.fourD6DropLowest().total; });
        ui.draft.scores = rolled;
      }
      render();
    };
  });
  $app.querySelector("#back").onclick = () => { bind(); ui.view = "world"; render(); };
  $app.querySelector("#start").onclick = async () => {
    bind();
    if (ui.draft.method === "pointbuy" && Engine.pointBuySpent(ui.draft.scores) > POINT_BUY_BUDGET) {
      alert("Point buy is over 27.");
      return;
    }
    if (!ui.draft.name.trim()) ui.draft.name = pick(["Rowan Vale", "Kesh", "Iri Dust", "Thorn"]);
    ui.state = Engine.newGame(ui.answers, ui.draft);
    ui.view = "play";
    render();
    if (LLM.isOn()) {
      try {
        const prose = await LLM.opening(ui.state);
        ui.state.world.log[0] = { who: "dm", text: prose };
        Engine.Storage.save(ui.state);
        render();
      } catch (_) { /* keep built-in opening */ }
    }
  };
}

function sheetHTML(state) {
  const c = state.character;
  const w = state.world;
  const loc = Engine.locationOf(state);
  return `
    <div class="kicker">${esc(w.name)}</div>
    <h3 style="color:var(--gold-2);margin:6px 0">${esc(c.name)}</h3>
    <p class="muted">${esc(c.race.name)} ${esc(c.class.name)} · Lv ${c.level}</p>
    <div style="margin:10px 0 6px" class="muted">Health ${c.hp} / ${c.maxHp}</div>
    <div class="hpbar"><span style="width:${Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100))}%"></span></div>
    <div class="stat-pills">
      ${ABILS.map((k) => `<div class="pill">${k.toUpperCase()} <b>${c.stats[k]}</b> (${Engine.modOf(c.stats[k]) >= 0 ? "+" : ""}${Engine.modOf(c.stats[k])})</div>`).join("")}
    </div>
    <p style="margin-top:12px"><b class="gold">Place.</b> ${esc(loc.name)}</p>
    <p class="muted">${esc(loc.blurb)}</p>
    <p style="margin-top:12px"><b class="gold">Quest.</b> ${esc(w.quest.title)}</p>
    <ol class="quest">${w.quest.stages.map((s, i) => `<li class="${i === w.quest.stage ? "gold" : i < w.quest.stage ? "muted" : ""}">${esc(s)}</li>`).join("")}</ol>
    <p style="margin-top:12px"><b class="gold">Features.</b></p>
    <p class="muted">${esc(c.race.features)}</p>
    <p class="muted">${esc(c.class.features.join(" · "))} · d${c.class.hitDie}</p>
    <p style="margin-top:12px"><b class="gold">Pack.</b> ${c.gold} gp</p>
    <ul class="inv">${c.inventory.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    ${c.backstory ? `<p style="margin-top:12px"><b class="gold">Backstory.</b></p><p class="muted">${esc(c.backstory)}</p>` : ""}
    ${c.motivation ? `<p style="margin-top:8px"><b class="gold">Drive.</b></p><p class="muted">${esc(c.motivation)}</p>` : ""}
  `;
}

function diceHTML() {
  const last = ui.lastRoll;
  return `
    <div class="kicker">Dice</div>
    <div class="roll-result">${last ? esc(String(last.total ?? last)) : "—"}</div>
    <p class="muted" style="text-align:center">${last && last.detail ? esc(last.detail) : "Tap a die"}</p>
    <div class="die-grid">
      ${[4, 6, 8, 10, 12, 20, 100].map((n) => `<button class="die" data-sides="${n}">d${n}</button>`).join("")}
      <button class="die" data-adv="1">Adv</button>
    </div>
    <div class="btn-row">
      ${ABILS.map((k) => `<button class="btn small ghost" data-chk="${k}">${k.toUpperCase()}</button>`).join("")}
    </div>
    <p class="muted" style="margin-top:12px">${LLM.isOn() ? "LLM narrator is on." : "Built-in DM is speaking."}</p>
  `;
}

function playView() {
  const state = ui.state;
  const log = state.world.log;
  $app.innerHTML = `
    <section class="play">
      <aside class="col left desktop-col">${sheetHTML(state)}
        <div class="btn-row" style="margin-top:16px;justify-content:flex-start">
          <button class="btn ghost small" id="home">Tables</button>
          <button class="btn ghost small" id="cfg">DM</button>
        </div>
      </aside>
      <main class="col">
        <div class="topbar-inner">
          <div class="brand">Ashen Way</div>
          <div class="muted">${ui.busy ? "The DM considers…" : state.combat ? "Combat" : "Explore"}</div>
        </div>
        <div class="log" id="log">
          ${log.map((m) => `
            <article class="bubble ${m.who}">
              <div class="who">${m.who === "dm" ? "Dungeon Master" : m.who === "player" ? state.character.name : "Table"}</div>
              <div>${esc(m.text).replace(/\n/g, "<br>")}</div>
            </article>`).join("")}
        </div>
        <div class="composer">
          <div class="suggest">
            ${Engine.suggestions(state).filter(Boolean).map((s) => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join("")}
          </div>
          <div class="compose-row">
            <textarea id="act" placeholder="What do you do?" ${ui.busy ? "disabled" : ""}>${esc(ui.action)}</textarea>
            <button class="btn" id="send" ${ui.busy ? "disabled" : ""}>Do it</button>
          </div>
        </div>
      </main>
      <aside class="col right desktop-col">${diceHTML()}</aside>
      <button class="btn drawer-toggle left mobile-only" id="open-sheet">Sheet</button>
      <button class="btn drawer-toggle right mobile-only" id="open-dice">Dice</button>
      <div class="sheet-drawer ${ui.sheetOpen ? "open" : "hidden"} mobile-only">
        <div class="sheet-panel">${sheetHTML(state)}
          <div class="btn-row" style="margin-top:16px">
            <button class="btn ghost" id="close-sheet">Close</button>
            <button class="btn ghost small" id="home-m">Tables</button>
          </div>
        </div>
      </div>
      <div class="dice-drawer ${ui.diceOpen ? "open" : "hidden"} mobile-only">
        <div class="dice-panel">${diceHTML()}
          <div class="btn-row"><button class="btn ghost" id="close-dice">Close</button></div>
        </div>
      </div>
    </section>`;
  bindPlay();
  scrollLog();
}

async function submitAction(text) {
  if (!text || ui.busy) return;
  ui.action = "";
  ui.state.world.log.push({ who: "player", text });
  const lines = Engine.resolveAction(ui.state, text);
  const rolls = lines.filter((l) => /^d20|^1d|^2d/.test(l));
  const story = lines.filter((l) => !/^d20|^1d|^2d/.test(l));
  if (rolls.length) ui.state.world.log.push({ who: "sys", text: rolls.join(" · ") });
  if (LLM.isOn()) {
    ui.busy = true;
    render();
    try {
      const prose = await LLM.narrate(ui.state, text, lines);
      ui.state.world.log.push({ who: "dm", text: prose });
    } catch (err) {
      ui.state.world.log.push({ who: "dm", text: story.join("\n\n") });
      ui.state.world.log.push({ who: "sys", text: "LLM fallback: " + err.message });
    }
    ui.busy = false;
  } else {
    ui.state.world.log.push({ who: "dm", text: story.join("\n\n") });
  }
  if (ui.state.world.flags.won) {
    ui.state.world.log.push({ who: "dm", text: "The save-the-world work is done. You may still wander the Ashen Way, or open Tables and begin again." });
  }
  Engine.Storage.save(ui.state);
  render();
}

function bindPlay() {
  $app.querySelector("#send").onclick = () => submitAction(($app.querySelector("#act").value || "").trim());
  $app.querySelector("#act").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAction(($app.querySelector("#act").value || "").trim()); }
  });
  $app.querySelectorAll("[data-sug]").forEach((b) => {
    b.onclick = () => submitAction(b.dataset.sug);
  });
  $app.querySelectorAll("[data-sides]").forEach((b) => {
    b.onclick = () => {
      const n = Number(b.dataset.sides);
      const total = Dice.roll(n);
      ui.lastRoll = { total, detail: `d${n} → ${total}` };
      render();
    };
  });
  const adv = $app.querySelector("[data-adv]");
  if (adv) adv.onclick = () => {
    const r = Dice.check(0, 10, 1);
    ui.lastRoll = { total: r.d20, detail: r.detail };
    render();
  };
  $app.querySelectorAll("[data-chk]").forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.chk;
      const r = Dice.check(Engine.modOf(ui.state.character.stats[k]), 12);
      ui.lastRoll = { total: r.total, detail: `${k.toUpperCase()} ${r.detail}` };
      ui.state.world.log.push({ who: "sys", text: `${k.toUpperCase()} check: ${r.detail}` });
      Engine.Storage.save(ui.state);
      render();
    };
  });
  const goHome = () => { Engine.Storage.save(ui.state); ui.view = "splash"; render(); };
  const r1 = $app.querySelector("#home"); if (r1) r1.onclick = goHome;
  const r2 = $app.querySelector("#home-m"); if (r2) r2.onclick = goHome;
  const cfg = $app.querySelector("#cfg"); if (cfg) cfg.onclick = () => { ui.from = "play"; ui.view = "settings"; render(); };
  const os = $app.querySelector("#open-sheet"); if (os) os.onclick = () => { ui.sheetOpen = true; render(); };
  const od = $app.querySelector("#open-dice"); if (od) od.onclick = () => { ui.diceOpen = true; render(); };
  const cs = $app.querySelector("#close-sheet"); if (cs) cs.onclick = () => { ui.sheetOpen = false; render(); };
  const cd = $app.querySelector("#close-dice"); if (cd) cd.onclick = () => { ui.diceOpen = false; render(); };
}

function scrollLog() {
  const log = document.getElementById("log");
  if (log) log.scrollTop = log.scrollHeight;
}

render();
