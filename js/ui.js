const $app = document.getElementById("app");

const ui = {
  view: "splash",
  answers: {},
  qIndex: 0,
  draft: {
    name: "",
    raceId: "human",
    classId: "fighter",
    backstory: "",
    motivation: "",
    customRaceName: "",
    customTrait: "",
    customBonuses: { str: 1, dex: 1, cha: 1, int: 0, hp: 0 }
  },
  state: null,
  action: "",
  lastRoll: null,
  sheetOpen: false,
  diceOpen: false
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;"
  }[c]));
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
}

function splash() {
  const saved = Engine.Storage.load();
  $app.innerHTML = `
    <section class="screen splash">
      <div class="hero-mark">✦</div>
      <div class="kicker">Solo table · AI dungeon master</div>
      <h1>Ashen Way</h1>
      <p class="lede">One campaign. A homebrew world shaped by your answers. The dungeon master sits on this side of the screen and keeps the dice honest.</p>
      <div class="btn-row">
        <button class="btn" data-go="world">Begin a campaign</button>
        ${saved ? `<button class="btn ghost" data-go="continue">Continue</button>` : ""}
      </div>
      <p class="footer-note">Works on a desk or in a pocket. Progress lives in this browser.</p>
    </section>`;
  $app.querySelector("[data-go=world]").onclick = () => {
    ui.answers = {}; ui.qIndex = 0; ui.view = "world"; render();
  };
  const cont = $app.querySelector("[data-go=continue]");
  if (cont) cont.onclick = () => { ui.state = saved; ui.view = "play"; render(); };
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
          ${ui.qIndex ? `<button class="btn ghost" id="back">Back</button>` : ""}
          <button class="btn" id="next" ${selected ? "" : "disabled"}>${ui.qIndex === WORLD_Q.length - 1 ? "Forge the world" : "Next omen"}</button>
        </div>
      </div>
    </section>`;
  $app.querySelectorAll(".choice").forEach((btn) => {
    btn.onclick = () => { ui.answers[q.key] = btn.dataset.id; render(); };
  });
  const back = $app.querySelector("#back");
  if (back) back.onclick = () => { ui.qIndex -= 1; render(); };
  $app.querySelector("#next").onclick = () => {
    if (!ui.answers[q.key]) return;
    if (ui.qIndex < WORLD_Q.length - 1) { ui.qIndex += 1; render(); }
    else { ui.view = "hero"; render(); }
  };
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
        <p class="muted" style="margin:8px 0 18px">Five lineages, or a custom bloodline. Stats are calculated from race and class and will move as the campaign does.</p>
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
                <h3>Custom lineage</h3><p>Name it. Spend a handful of bonuses. Write the trait the world has no word for.</p>
              </button>
            </div>
            ${d.raceId === "custom" ? `
              <div class="card" style="margin-top:14px">
                <label class="field"><span>Lineage name</span><input id="crn" value="${esc(d.customRaceName)}" /></label>
                <label class="field"><span>Signature trait</span><input id="crt" value="${esc(d.customTrait)}" /></label>
                <p class="muted">Bonuses (keep the sum modest — about +3 across the board)</p>
                <div class="stat-pills" style="margin-top:8px">
                  ${["str","dex","cha","int","hp"].map((k) => `<label class="pill">${k.toUpperCase()} <input type="number" min="0" max="3" data-b="${k}" value="${d.customBonuses[k]}" style="width:48px;background:transparent;border:0;color:var(--gold-2)"></label>`).join("")}
                </div>
              </div>` : ""}
            ${preview ? `
              <div class="card" style="margin-top:14px">
                <div class="kicker">Projected sheet</div>
                <div class="stat-pills">
                  <div class="pill">STR <b>${preview.stats.str}</b></div>
                  <div class="pill">DEX <b>${preview.stats.dex}</b></div>
                  <div class="pill">CHA <b>${preview.stats.cha}</b></div>
                  <div class="pill">INT <b>${preview.stats.int}</b></div>
                  <div class="pill">HP <b>${preview.maxHp}</b></div>
                </div>
                <p class="muted" style="margin-top:8px">${esc(preview.race.features)}</p>
              </div>` : ""}
          </div>
        </div>
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
  };
  ["#nm","#cls","#bs","#mo","#crn","#crt"].forEach((sel) => {
    const el = $app.querySelector(sel); if (el) el.addEventListener("change", () => { bind(); render(); });
  });
  $app.querySelectorAll("[data-b]").forEach((inp) => inp.addEventListener("change", () => { bind(); render(); }));
  $app.querySelectorAll("[data-race]").forEach((btn) => {
    btn.onclick = () => { bind(); ui.draft.raceId = btn.dataset.race; render(); };
  });
  $app.querySelector("#back").onclick = () => { bind(); ui.view = "world"; render(); };
  $app.querySelector("#start").onclick = () => {
    bind();
    if (!ui.draft.name.trim()) ui.draft.name = pick(["Rowan Vale","Kesh","Iri Dust","Thorn"]);
    ui.state = Engine.newGame(ui.answers, ui.draft);
    ui.view = "play";
    render();
    scrollLog();
  };
}

function sheetHTML(state, compact) {
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
      ${["str","dex","cha","int"].map((k) => `<div class="pill">${k.toUpperCase()} <b>${c.stats[k]}</b> (${Engine.modOf(c.stats[k]) >= 0 ? "+" : ""}${Engine.modOf(c.stats[k])})</div>`).join("")}
    </div>
    <p style="margin-top:12px"><b class="gold">Place.</b> ${esc(loc.name)}</p>
    <p class="muted">${esc(loc.blurb)}</p>
    <p style="margin-top:12px"><b class="gold">Quest.</b> ${esc(w.quest.title)}</p>
    <ol class="quest">${w.quest.stages.map((s, i) => `<li class="${i === w.quest.stage ? "gold" : i < w.quest.stage ? "muted" : ""}">${esc(s)}</li>`).join("")}</ol>
    ${compact ? "" : `
      <p style="margin-top:12px"><b class="gold">Features.</b></p>
      <p class="muted">${esc(c.race.features)}</p>
      <p class="muted">${esc(c.class.features.join(" · "))}</p>
      <p style="margin-top:12px"><b class="gold">Pack.</b> ${c.gold} gp</p>
      <ul class="inv">${c.inventory.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      ${c.backstory ? `<p style="margin-top:12px"><b class="gold">Backstory.</b></p><p class="muted">${esc(c.backstory)}</p>` : ""}
      ${c.motivation ? `<p style="margin-top:8px"><b class="gold">Drive.</b></p><p class="muted">${esc(c.motivation)}</p>` : ""}
    `}
  `;
}

function diceHTML() {
  const last = ui.lastRoll;
  return `
    <div class="kicker">Dice</div>
    <div class="roll-result">${last ? esc(String(last.total ?? last)) : "—"}</div>
    <p class="muted" style="text-align:center">${last && last.detail ? esc(last.detail) : "Tap a die"}</p>
    <div class="die-grid">
      ${[4,6,8,10,12,20,100].map((n) => `<button class="die" data-sides="${n}">d${n}</button>`).join("")}
      <button class="die" data-adv="1">Adv</button>
    </div>
    <div class="btn-row">
      <button class="btn small ghost" data-chk="str">STR check</button>
      <button class="btn small ghost" data-chk="dex">DEX check</button>
      <button class="btn small ghost" data-chk="cha">CHA check</button>
      <button class="btn small ghost" data-chk="int">INT check</button>
    </div>
  `;
}

function playView() {
  const state = ui.state;
  const log = state.world.log;
  $app.innerHTML = `
    <section class="play">
      <aside class="col left desktop-col">${sheetHTML(state, false)}
        <div class="btn-row" style="margin-top:16px;justify-content:flex-start">
          <button class="btn ghost small" id="reset">New campaign</button>
        </div>
      </aside>
      <main class="col">
        <div class="topbar-inner">
          <div class="brand">Ashen Way</div>
          <div class="muted">${state.combat ? "Combat" : "Explore"}</div>
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
            <textarea id="act" placeholder="What do you do?">${esc(ui.action)}</textarea>
            <button class="btn" id="send">Do it</button>
          </div>
        </div>
      </main>
      <aside class="col right desktop-col">${diceHTML()}</aside>
      <button class="btn drawer-toggle left mobile-only" id="open-sheet">Sheet</button>
      <button class="btn drawer-toggle right mobile-only" id="open-dice">Dice</button>
      <div class="sheet-drawer ${ui.sheetOpen ? "open" : "hidden"} mobile-only" id="sheet-draw">
        <div class="sheet-panel">${sheetHTML(state, false)}
          <div class="btn-row" style="margin-top:16px">
            <button class="btn ghost" id="close-sheet">Close</button>
            <button class="btn danger small" id="reset-m">New campaign</button>
          </div>
        </div>
      </div>
      <div class="dice-drawer ${ui.diceOpen ? "open" : "hidden"} mobile-only" id="dice-draw">
        <div class="dice-panel">${diceHTML()}
          <div class="btn-row"><button class="btn ghost" id="close-dice">Close</button></div>
        </div>
      </div>
    </section>`;
  bindPlay();
  scrollLog();
}

function bindPlay() {
  const send = () => {
    const box = $app.querySelector("#act");
    const text = (box.value || "").trim();
    if (!text) return;
    ui.action = "";
    ui.state.world.log.push({ who: "player", text });
    const lines = Engine.resolveAction(ui.state, text);
    ui.state.world.log.push({ who: "dm", text: lines.filter((l) => !/^d20|^1d|^2d/.test(l)).join("\n\n") });
    const rolls = lines.filter((l) => /^d20|^1d|^2d/.test(l));
    if (rolls.length) ui.state.world.log.push({ who: "sys", text: rolls.join(" · ") });
    if (ui.state.world.flags.won) {
      ui.state.world.log.push({ who: "dm", text: "The save-the-world work is done. You may still wander the Ashen Way, or begin again." });
    }
    Engine.Storage.save(ui.state);
    render();
  };
  $app.querySelector("#send").onclick = send;
  $app.querySelector("#act").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $app.querySelectorAll("[data-sug]").forEach((b) => {
    b.onclick = () => { $app.querySelector("#act").value = b.dataset.sug; send(); };
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
  const reset = () => { Engine.Storage.clear(); ui.state = null; ui.view = "splash"; render(); };
  const r1 = $app.querySelector("#reset"); if (r1) r1.onclick = reset;
  const r2 = $app.querySelector("#reset-m"); if (r2) r2.onclick = reset;
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
