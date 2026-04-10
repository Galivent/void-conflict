// ═══════════════════════════════════════════════════════════════
//  VOID CONFLICT — Rogue Trader Naval Combat for Foundry VTT
// ═══════════════════════════════════════════════════════════════

Hooks.once("init", () => {
  console.log("Void Conflict | Initialising...");

  CONFIG.Actor.dataModels["voidship"] = VoidShipDataModel;
  CONFIG.Actor.typeLabels = CONFIG.Actor.typeLabels ?? {};
  CONFIG.Actor.typeLabels["voidship"] = "Void Ship";

  Actors.registerSheet("void-conflict", VoidShipSheet, {
    types: ["voidship"],
    makeDefault: true,
    label: "Void Ship Sheet"
  });

  Handlebars.registerHelper("SelectOptions", function(value, options) {
    return value === options.hash.selected ? "selected" : "";
  });
});

Hooks.once("ready", () => {
  window.VoidConflict = { openBattle: () => new VoidBattleApp().render(true) };
  console.log("Void Conflict | Ready.");
});

// ── DATA MODEL ──────────────────────────────────────────────────

class VoidShipDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      hull:    new f.SchemaField({ value: new f.NumberField({ initial: 40, min: 0 }), max: new f.NumberField({ initial: 40, min: 1 }) }),
      shields: new f.SchemaField({ value: new f.NumberField({ initial: 1,  min: 0 }), max: new f.NumberField({ initial: 1,  min: 0 }) }),
      morale:  new f.SchemaField({ value: new f.NumberField({ initial: 100,min: 0 }), max: new f.NumberField({ initial: 100,min: 1 }) }),
      crew:    new f.SchemaField({
        value:      new f.NumberField({ initial: 100, min: 0 }),
        max:        new f.NumberField({ initial: 100, min: 1 }),
        complement: new f.StringField({ initial: "25,000" }),
        quality:    new f.StringField({ initial: "competent" }),
        notes:      new f.StringField({ initial: "" }),
        captain:      new f.SchemaField({ name: new f.StringField({ initial: "" }), command:  new f.NumberField({ initial: 40 }) }),
        firstOfficer: new f.SchemaField({ name: new f.StringField({ initial: "" }), command:  new f.NumberField({ initial: 35 }) }),
        navigator:    new f.SchemaField({ name: new f.StringField({ initial: "" }), navigate: new f.NumberField({ initial: 40 }) }),
        helmsman:     new f.SchemaField({ name: new f.StringField({ initial: "" }), pilot:    new f.NumberField({ initial: 40 }) }),
        enginseer:    new f.SchemaField({ name: new f.StringField({ initial: "" }), techUse:  new f.NumberField({ initial: 40 }) }),
        chaplain:     new f.SchemaField({ name: new f.StringField({ initial: "" }), wp:       new f.NumberField({ initial: 35 }) })
      }),
      shipClass:       new f.StringField({ initial: "Sword-class" }),
      shipType:        new f.StringField({ initial: "frigate" }),
      faction:         new f.StringField({ initial: "imperium" }),
      speed:           new f.NumberField({ initial: 6,   min: 0 }),
      manoeuvrability: new f.NumberField({ initial: 10,  min: -30, max: 60 }),
      detection:       new f.NumberField({ initial: 10,  min: -30, max: 60 }),
      turrets:         new f.NumberField({ initial: 1,   min: 0 }),
      armour:          new f.NumberField({ initial: 18,  min: 0 }),
      spaceUsed:       new f.NumberField({ initial: 0,   min: 0 }),
      spaceMax:        new f.NumberField({ initial: 40,  min: 1 }),
      powerUsed:       new f.NumberField({ initial: 0,   min: 0 }),
      powerMax:        new f.NumberField({ initial: 40,  min: 1 }),
      crewRating:      new f.NumberField({ initial: 40,  min: 0, max: 100 }),
      skills: new f.SchemaField({
        command:        new f.NumberField({ initial: 40 }),
        pilot:          new f.NumberField({ initial: 40 }),
        navigate:       new f.NumberField({ initial: 40 }),
        techUse:        new f.NumberField({ initial: 40 }),
        ballisticSkill: new f.NumberField({ initial: 40 }),
        scrutiny:       new f.NumberField({ initial: 35 })
      }),
      weapons:                new f.ObjectField({ initial: {} }),
      torpedoes: new f.SchemaField({
        value: new f.NumberField({ initial: 0,  min: 0 }),
        max:   new f.NumberField({ initial: 12, min: 0 }),
        type:  new f.StringField({ initial: "Standard" })
      }),
      essentialComponents:    new f.ObjectField({ initial: {} }),
      supplementalComponents: new f.ObjectField({ initial: {} }),
      history:       new f.StringField({ initial: "" }),
      specialRules:  new f.StringField({ initial: "" }),
      machineSpirit: new f.StringField({ initial: "none" }),
      profitFactor:  new f.NumberField({ initial: 0, min: 0 }),
      renown:        new f.StringField({ initial: "unknown" }),
      achievements:  new f.StringField({ initial: "" })
    };
  }
}

// ── SHEET ────────────────────────────────────────────────────────

class VoidShipSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["void-conflict", "sheet", "actor"],
      template: "modules/void-conflict/templates/ship-sheet.html",
      width: 820, height: 680,
      tabs: [{ navSelector: ".vcs-tabs", contentSelector: ".vcs-tab-content", initial: "stats" }],
      resizable: true
    });
  }

  getData() {
    const data = super.getData();
    const s = this.actor.system;
    const pct = (v, m) => m > 0 ? Math.max(0, Math.min(100, Math.round((v / m) * 100))) : 0;
    data.hullPct   = pct(s.hull.value,   s.hull.max);
    data.shieldPct = pct(s.shields.value, s.shields.max);
    data.crewPct   = pct(s.crew.value,   s.crew.max);
    data.moralePct = pct(s.morale.value, s.morale.max);
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find('[data-action="lock-on"]').click(()  => this._lockOn());
    html.find('[data-action="evasive"]').click(()  => this._evasive());
    html.find('[data-action="new-course"]').click(()=> this._newCourse());
    html.find('[data-action="brace"]').click(()    => this._brace());
    html.find('[data-action="fire-all"]').click(() => this._fireAll());
    html.find('[data-action="ram"]').click(()      => this._ram());
    html.find('[data-action="repair"]').click(()   => this._repair());
    html.find('[data-action="open-battle"]').click(()=> new VoidBattleApp().render(true));

    html.find('[data-action="fire-weapon"]').click(ev =>
      this._fireWeapon(ev.currentTarget.dataset.key));
    html.find('[data-action="add-weapon"]').click(()    => this._addWeapon());
    html.find('[data-action="delete-weapon"]').click(ev => this._deleteWeapon(ev.currentTarget.dataset.key));
    html.find('[data-action="add-essential"]').click(()       => this._addComponent("essentialComponents"));
    html.find('[data-action="add-supplemental"]').click(()    => this._addComponent("supplementalComponents"));
    html.find('[data-action="delete-component"]').click(ev =>
      this._deleteComponent(ev.currentTarget.dataset.ctype, ev.currentTarget.dataset.key));
  }

  // ── Combat Actions ──────────────────────────────────────────

  async _chat(label, html) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div style="font-family:'Crimson Text',serif;padding:6px 8px;border-left:3px solid #c9a84c;background:rgba(201,168,76,0.06);">
        <b style="font-family:'Cinzel',serif;color:#c9a84c;">${this.actor.name} — ${label}</b><br>${html}</div>`
    });
  }

  async _lockOn() {
    const sk = this.actor.system.skills.ballisticSkill;
    const r  = await new Roll("1d100").evaluate();
    const ok = r.total <= sk;
    if (ok) await this.actor.setFlag("void-conflict", "lockedOn", true);
    await this._chat("🎯 Lock On", `Roll <b>${r.total}</b> vs BS ${sk}: ${ok
      ? '<span style="color:#44aa44">Success! +20 BS next attack.</span>'
      : '<span style="color:#cc2222">Failed.</span>'}`);
  }

  async _evasive() {
    const sk = this.actor.system.skills.pilot + this.actor.system.manoeuvrability;
    const r  = await new Roll("1d100").evaluate();
    await this._chat("💨 Evasive Manoeuvres", `Roll <b>${r.total}</b> vs Pilot ${sk}: ${r.total <= sk
      ? '<span style="color:#44aa44">Success! Attackers −20 BS until next turn.</span>'
      : '<span style="color:#cc2222">Failed.</span>'}`);
  }

  async _newCourse() {
    const sk = this.actor.system.skills.pilot + this.actor.system.manoeuvrability;
    const r  = await new Roll("1d100").evaluate();
    await this._chat("🧭 Come to New Course", `Roll <b>${r.total}</b> vs Pilot ${sk}: ${r.total <= sk
      ? '<span style="color:#44aa44">Success! Turn up to 90°.</span>'
      : 'Partial — turn up to 45°.'}`);
  }

  async _brace() {
    const sk = this.actor.system.skills.command;
    const r  = await new Roll("1d100").evaluate();
    await this._chat("🛡 Brace for Impact", `Roll <b>${r.total}</b> vs Command ${sk}: ${r.total <= sk
      ? '<span style="color:#44aa44">Success! Halve damage from next hit.</span>'
      : '<span style="color:#cc2222">Failed.</span>'}`);
  }

  async _repair() {
    const sk = this.actor.system.skills.techUse;
    const r  = await new Roll("1d100").evaluate();
    if (r.total <= sk) {
      const rep = Math.floor(Math.random() * 3) + 1;
      await this.actor.update({ "system.hull.value": Math.min(this.actor.system.hull.value + rep, this.actor.system.hull.max) });
      await this._chat("🔧 Damage Control", `Roll <b>${r.total}</b> vs Tech-Use ${sk}: <span style="color:#44aa44">Repaired ${rep} Hull Integrity!</span>`);
    } else {
      await this._chat("🔧 Damage Control", `Roll <b>${r.total}</b> vs Tech-Use ${sk}: <span style="color:#cc2222">Failed.</span>`);
    }
  }

  async _ram() {
    const sk = this.actor.system.skills.pilot;
    const r  = await new Roll("1d100").evaluate();
    if (r.total <= sk) {
      const d = await new Roll("1d10+" + Math.floor(this.actor.system.hull.max / 10)).evaluate();
      await this._chat("⚡ RAM", `Roll <b>${r.total}</b> vs Pilot ${sk}: <span style="color:#44aa44">RAMMING SPEED!</span> Target takes <span style="color:#cc2222">${d.total}</span> Hull damage. This ship takes <span style="color:#cc2222">${Math.floor(d.total/2)}</span>.`);
    } else {
      await this._chat("⚡ RAM", `Roll <b>${r.total}</b> vs Pilot ${sk}: <span style="color:#cc2222">Failed to make contact.</span>`);
    }
  }

  async _fireWeapon(key) {
    const w = this.actor.system.weapons[key];
    if (!w) return;
    if (w.status === "destroyed") { ui.notifications.warn(`${w.name} is destroyed!`); return; }
    const locked = this.actor.getFlag("void-conflict", "lockedOn");
    const bs = this.actor.system.skills.ballisticSkill + (locked ? 20 : 0);
    const r  = await new Roll("1d100").evaluate();
    if (locked) await this.actor.unsetFlag("void-conflict", "lockedOn");
    if (r.total <= bs) {
      const d = await new Roll((w.strength || 1) + "*(" + (w.damage || "1d10") + ")").evaluate();
      await this._chat(`⚔ ${w.name}`, `Roll <b>${r.total}</b> vs BS ${bs}${locked?" (+20)":""}: <span style="color:#44aa44">HIT!</span> <span style="color:#cc2222">${d.total} damage</span>${r.total <= Math.floor(bs/10) ? " — <b style='color:#ffaa00'>CRITICAL!</b>" : ""}`);
    } else {
      await this._chat(`⚔ ${w.name}`, `Roll <b>${r.total}</b> vs BS ${bs}: <span style="color:#cc2222">Missed.</span>`);
    }
  }

  async _fireAll() {
    const weapons = Object.keys(this.actor.system.weapons || {});
    if (!weapons.length) { ui.notifications.warn("No weapons configured!"); return; }
    for (const k of weapons) await this._fireWeapon(k);
  }

  // ── Data Helpers ────────────────────────────────────────────

  async _addWeapon() {
    const weapons = foundry.utils.deepClone(this.actor.system.weapons || {});
    weapons["w" + Date.now()] = { name: "New Weapon", location: "prow", strength: 1, damage: "1d10+2", crit: 5, range: 6, qualities: "", status: "ok" };
    await this.actor.update({ "system.weapons": weapons });
  }

  async _deleteWeapon(key) {
    const weapons = foundry.utils.deepClone(this.actor.system.weapons || {});
    delete weapons[key];
    await this.actor.update({ "system.weapons": weapons });
  }

  async _addComponent(field) {
    const comps = foundry.utils.deepClone(this.actor.system[field] || {});
    comps["c" + Date.now()] = { name: "New Component", bonus: "", status: "ok" };
    await this.actor.update({ [`system.${field}`]: comps });
  }

  async _deleteComponent(ctype, key) {
    const comps = foundry.utils.deepClone(this.actor.system[ctype] || {});
    delete comps[key];
    await this.actor.update({ [`system.${ctype}`]: comps });
  }
}

// ── VOID BATTLE APP ──────────────────────────────────────────────

class VoidBattleApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "void-battle-app",
      title: "⚔ Void Conflict — Battle Map",
      template: "modules/void-conflict/templates/void-battle.html",
      width: 1100, height: 640,
      resizable: true,
      classes: ["void-conflict", "void-battle"]
    });
  }

  constructor() {
    super();
    this.round = 1;
    this.ships = game.actors.filter(a => a.type === "voidship").map(a => ({
      id: a.id, name: a.name,
      faction: a.system.faction,
      hull: a.system.hull,
      shields: a.system.shields,
      speed: a.system.speed,
      x: a.getFlag("void-conflict","mapX") ?? (0.1 + Math.random()*0.8),
      y: a.getFlag("void-conflict","mapY") ?? (0.1 + Math.random()*0.8)
    }));
    this.activeShip = this.ships[0] ?? null;
  }

  getData() {
    return { round: this.round, ships: this.ships };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("#vba-next-round").click(() => {
      this.round++;
      html.find("#vba-round").text(this.round);
      this._log(html, `Round <b>${this.round}</b> begins.`);
    });
    html.find("#vba-close").click(() => this.close());
    html.find(".vba-die").click(ev => {
      const s = parseInt(ev.currentTarget.dataset.sides);
      const r = Math.floor(Math.random() * s) + 1;
      html.find("#vba-dice-result").text(r);
      this._log(html, `Rolled d${s}: <b style="color:#c9a84c">${r}</b>`);
    });
    html.find("#vba-active-ship").change(ev => {
      this.activeShip = this.ships.find(s => s.id === ev.currentTarget.value) ?? null;
      this._updateStats(html);
    });
    html.find(".vba-action").click(ev => this._action(html, ev.currentTarget.dataset.action));
    this._drawMap(html);
    this._updateStats(html);
  }

  _action(html, action) {
    if (!this.activeShip) return;
    const actor = game.actors.get(this.activeShip.id);
    if (!actor) return;
    const sheet = new VoidShipSheet(actor);
    const actions = {
      "lock-on":   () => sheet._lockOn(),
      "evasive":   () => sheet._evasive(),
      "broadside": () => sheet._fireAll(),
      "ram":       () => sheet._ram(),
      "repair":    () => sheet._repair(),
      "brace":     () => sheet._brace()
    };
    if (actions[action]) actions[action]();
    else this._log(html, `Action: <b>${action}</b>`);
  }

  _updateStats(html) {
    const ship = this.activeShip;
    if (!ship) { html.find("#vba-active-stats").html("<em>No ship selected</em>"); return; }
    const a = game.actors.get(ship.id);
    if (!a) return;
    const s = a.system;
    const pct = (v,m) => m>0 ? Math.round((v/m)*100) : 0;
    html.find("#vba-active-stats").html(`
      <div style="font-family:'Cinzel',serif;font-size:0.65rem;color:#c9a84c;margin-bottom:6px;">${a.name}</div>
      <div style="font-size:0.7rem;margin-bottom:4px;">Hull: <b style="color:#44aa44">${s.hull.value}/${s.hull.max}</b> &nbsp;|&nbsp; Shields: <b style="color:#4488cc">${s.shields.value}/${s.shields.max}</b></div>
      <div style="height:4px;background:rgba(255,255,255,0.05);margin-bottom:3px;"><div style="height:100%;width:${pct(s.hull.value,s.hull.max)}%;background:#44aa44"></div></div>
      <div style="height:4px;background:rgba(255,255,255,0.05);margin-bottom:8px;"><div style="height:100%;width:${pct(s.shields.value,s.shields.max)}%;background:#4488cc"></div></div>
      <div style="font-size:0.65rem;color:#7a6a4a;">Speed: <b style="color:#d4c49a">${s.speed} VU</b> &nbsp;|&nbsp; Armour: <b style="color:#d4c49a">${s.armour}</b></div>
    `);
  }

  _log(html, msg) {
    html.find("#vba-log").prepend(`<div class="vba-log-entry">${msg}</div>`);
  }

  _drawMap(html) {
    const canvas = html.find("#vba-battle-canvas")[0];
    if (!canvas) return;
    canvas.width  = canvas.parentElement.clientWidth  || 600;
    canvas.height = canvas.parentElement.clientHeight || 500;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#050408"; ctx.fillRect(0,0,W,H);
    // Stars
    for (let i=0;i<200;i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.7+0.1})`;
      ctx.beginPath(); ctx.arc(Math.random()*W, Math.random()*H, Math.random()<0.05?1.2:0.5, 0, Math.PI*2); ctx.fill();
    }
    // Grid
    ctx.strokeStyle = "rgba(201,168,76,0.07)"; ctx.lineWidth = 0.5;
    for (let x=0;x<W;x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y=0;y<H;y+=50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    // Ships
    const colors = { imperium:"#4488cc", chaos:"#cc3333", eldar:"#44cc88", ork:"#88cc44", tau:"#44aacc", neutral:"#c9a84c" };
    this.ships.forEach(ship => {
      const sx=ship.x*W, sy=ship.y*H;
      const col = colors[ship.faction] ?? "#c9a84c";
      ctx.save(); ctx.translate(sx,sy);
      ctx.shadowColor=col; ctx.shadowBlur=12;
      ctx.strokeStyle=col; ctx.fillStyle=col.replace(")",",0.15)").replace("rgb","rgba"); ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(10,8); ctx.lineTo(0,4); ctx.lineTo(-10,8); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.font="10px 'Cinzel',serif"; ctx.fillStyle=col; ctx.textAlign="center";
      ctx.shadowColor="rgba(0,0,0,0.9)"; ctx.shadowBlur=4;
      ctx.fillText(ship.name.length>18?ship.name.slice(0,16)+"…":ship.name, sx, sy+28);
      ctx.shadowBlur=0;
    });
    if (this.activeShip) {
      const sx=this.activeShip.x*W, sy=this.activeShip.y*H;
      ctx.strokeStyle="rgba(240,192,96,0.7)"; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.arc(sx,sy,22,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
                     }
