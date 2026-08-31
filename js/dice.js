const Dice = {
  roll(sides) {
    return 1 + Math.floor(Math.random() * sides);
  },
  parse(expr, mods = {}) {
    const raw = String(expr).toUpperCase();
    const m = raw.match(/(\d+)d(\d+)([+-]\w+)?/i);
    if (!m) return { total: this.roll(20), detail: "d20" };
    const n = Number(m[1]);
    const s = Number(m[2]);
    let bonus = 0;
    let label = `${n}d${s}`;
    if (m[3]) {
      const key = m[3].slice(1).toLowerCase();
      if (["str", "dex", "cha", "int"].includes(key)) {
        bonus = mods[key] || 0;
        label += (bonus >= 0 ? "+" : "") + bonus;
      } else {
        bonus = Number(m[3]);
        label += m[3];
      }
    }
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(this.roll(s));
    const total = parts.reduce((a, b) => a + b, 0) + bonus;
    return { total, parts, bonus, detail: `${label} → [${parts.join(", ")}]${bonus ? (bonus >= 0 ? "+" : "") + bonus : ""} = ${total}` };
  },
  check(mod = 0, dc = 12, adv = 0) {
    const a = this.roll(20);
    const b = this.roll(20);
    let used = a;
    if (adv > 0) used = Math.max(a, b);
    if (adv < 0) used = Math.min(a, b);
    const total = used + mod;
    return {
      d20: used,
      other: adv !== 0 ? b : null,
      mod,
      total,
      dc,
      ok: total >= dc,
      nat20: used === 20,
      nat1: used === 1,
      detail: `d20${adv > 0 ? " adv" : adv < 0 ? " dis" : ""} ${used}${mod >= 0 ? "+" : ""}${mod} = ${total} vs DC ${dc}`
    };
  }
};
