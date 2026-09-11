const LLM = {
  config() {
    return Engine.Settings.load().llm || {};
  },
  isOn() {
    const c = this.config();
    return !!(c.enabled && c.provider && c.provider !== "off" && c.apiKey);
  },
  endpoint(c) {
    if (c.provider === "custom") return (c.endpoint || "").replace(/\/$/, "");
    return LLM_PROVIDERS[c.provider]?.endpoint || c.endpoint || "";
  },
  model(c) {
    return c.model || LLM_PROVIDERS[c.provider]?.model || "";
  },
  systemPrompt() {
    return [
      "You are the Dungeon Master for a solo Dungeons & Dragons campaign called Ashen Way.",
      "A rules engine has already resolved dice, damage, travel, inventory, and quest flags.",
      "Your job is to actively progress the adventure, not merely describe the player's action.",
      "Every response must add forward motion: reveal a clue, introduce pressure, change the scene, present a consequence, or point toward the current quest stage.",
      "Only treat dice text as important when it is present. If no roll appears, narrate the action as ordinary story momentum instead of implying chance or failure.",
      "Narrate 1-3 short paragraphs in second person. Match the world's tone.",
      "Do not invent mechanical results that contradict the engine notes.",
      "Do not list stats unless the scene needs them. Do not output JSON or markdown headings.",
      "Do not echo the player's action in quotation marks. Do not mention quest stages, engine directives, or story charges as out-of-world text.",
      "End with 2-3 concrete next options embedded naturally in prose, not a generic 'what do you do?'"
    ].join(" ");
  },
  async chat(messages) {
    const c = this.config();
    if (c.provider === "anthropic") return this._anthropic(c, messages);
    return this._openai(c, messages);
  },
  async _openai(c, messages) {
    const url = this.endpoint(c);
    if (!url) throw new Error("No endpoint set.");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + c.apiKey
      },
      body: JSON.stringify({
        model: this.model(c),
        temperature: 0.85,
        messages
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || data.message || res.status + " " + res.statusText;
      throw new Error(msg);
    }
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("The model returned no text.");
    return String(text).trim();
  },
  async _anthropic(c, messages) {
    const url = this.endpoint(c);
    const system = messages.find((m) => m.role === "system")?.content || "";
    const rest = messages.filter((m) => m.role !== "system");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": c.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: this.model(c),
        max_tokens: 700,
        system,
        messages: rest
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || data.message || res.status + " " + res.statusText;
      throw new Error(msg);
    }
    const text = (data.content || []).map((p) => p.text || "").join("\n").trim();
    if (!text) throw new Error("The model returned no text.");
    return text;
  },
  async narrate(state, playerText, mechLines) {
    const snap = Engine.snapshot(state);
    const recent = (state.world.log || []).slice(-6).map((m) => `${m.who}: ${m.text}`).join("\n\n");
    const user = [
      "WORLD STATE:\n" + JSON.stringify(snap, null, 2),
      "RECENT TABLE:\n" + recent,
      "PLAYER ACTION:\n" + playerText,
      "ENGINE RESOLUTION (binding):\n" + mechLines.join("\n"),
      "DM DIRECTIVE:\nWrite this as a coherent scene, not a rules recap. If the engine resolution contains no dice roll, the action simply happens and the story moves forward. Do not quote the player action. Do not mention hooks, charges, stages, directives, or engine logic. End with specific next paths."
    ].join("\n\n");
    return this.chat([
      { role: "system", content: this.systemPrompt() },
      { role: "user", content: user }
    ]);
  },
  async opening(state) {
    const snap = Engine.snapshot(state);
    return this.chat([
      { role: "system", content: this.systemPrompt() },
      {
        role: "user",
        content: "Write the opening scene for this new campaign. Do not skip the patron or the looming threat.\n\n" + JSON.stringify(snap, null, 2)
      }
    ]);
  },
  async test() {
    return this.chat([
      { role: "system", content: "Reply with one short sentence confirming you can act as a Dungeon Master." },
      { role: "user", content: "Ready the table." }
    ]);
  }
};
