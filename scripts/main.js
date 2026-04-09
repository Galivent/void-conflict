// ═══════════════════════════════════════════════════════════════
//  VOID CONFLICT — Rogue Trader Naval Combat for Foundry VTT
//  main.js — Module core, Actor, Sheet, Battle App
// ═══════════════════════════════════════════════════════════════

// ── 1. MODULE REGISTRATION ──────────────────────────────────────

Hooks.once("init", () => {
  console.log("Void Conflict | Initialising void battle systems...");

  // Register the VoidShip actor type and its sheet
  Actors.registerSheet("void-conflict", VoidShipSheet, {
    types: ["voidship"],
    makeDefault: true,
    label: "Void Ship Sheet"
  });

  // Register Handlebars helpers used in templates
  Handlebars.registerHelper("selectOptions", function(value, options) {
    return value === options.hash.selected ? "selected" : "";
  });

  Handlebars.registerHelper("math", function(a, op, b) {
    a = parseFloat(a); b = parseFloat(b);
    if (op === "/") return b > 0 ? Math.round((a / b) * 100) : 0;
    if (op === "*") return a * b;
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    return 0;
  });
});

Hooks.once("ready", () => {
  console.log("Void Conflict | All systems operational. For the Emperor.");
  // Register a macro to open the battle app
  game.voidConflict = { openBattle: () => new VoidBattleApp().render(true) };
});

// ── 2. DATA MODEL — default data for a new Void Ship ────────────

class VoidShipDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // ── Combat stats
      hull:     new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 40, min: 0 }),
        max:   new fields.NumberField({ required: true, initial: 40, min: 1 })
      }),
      shields:  new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 1, min: 0 }),
        max:   new fields.NumberField({ required: true, initial: 1, min: 0 })
      }),
      crew:     new fields.SchemaField({
        value:      new fields.NumberField({ required: true, initial: 100, min: 0 }),
        max:        new fields.NumberField({ required: true, initial: 100, min: 1 }),
        complement: new fields.StringField({ initial: "25,000" }),
        quality:    new fields.StringField({ initial: "competent" }),
        notes:      new fields.StringField({ initial: "" }),
        captain:    new fields.SchemaField({
          name:    new fields.StringField({ initial: "" }),
          command: new fields.NumberField({ initial: 40, min: 0, max: 100 })
        }),
        firstOfficer: new fields.SchemaField({
          name:    new fields.StringField({ initial: "" }),
          command: new fields.NumberField({ initial: 35, min: 0, max: 100 })
        }),
        navigator: new fields.SchemaField({
          name:     new fields.StringField({ initial: "" }),
          navigate: new fields.NumberField({ initial: 40, min: 0, max: 100 })
        }),
        helmsman: new fields.SchemaField({
          name:  new fields.StringField({ initial: "" }),
          pilot: new fields.NumberField({ initial: 40, min: 0, max: 100 })
        }),
        enginseer: new fields.SchemaField({
          name:    new fields.StringField({ initial: "" }),
          techUse: new fields.NumberField({ initial: 40, min: 0, max: 100 })
        }),
        chaplain: new fields.SchemaField({
          name: new fields.StringField({ initial: "" }),
          wp:   new fields.NumberField({ initial: 35, min: 0, max: 100 })
        })
      }),
      morale: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 100, min: 0 }),
        max:   new fields.NumberField({ required: true, initial: 100, min: 1 })
      }),

      // ── Ship profile
      class:           new fields.StringField({ initial: "Sword-class" }),
      shipType:        new fields.StringField({ initial: "frigate" }),
      faction:         new fields.StringField({ initial: "imperium" }),
      speed:           new fields.NumberField({ initial: 6, min: 0 }),
      manoeuvrability: new fields.NumberField({ initial: 10, min: -30, max: 60 }),
      detection:       new fields.NumberField({ initial: 10, min: -30, max: 60 }),
      turrets:         new fields.NumberField({ initial: 1, min: 0 }),
      armour:          new fields.NumberField({ initial: 18, min: 0 }),
      spaceUsed:       new fields.NumberField({ initial: 0, min: 0 }),
      spaceMax:        new fields.NumberField({ initial: 40, min: 1 }),
      powerUsed:       new fields.NumberField({ initial: 0, min: 0 }),
      powerMax:        new fields.NumberField({ initial: 40, min: 1 }),
      crewRating:      new fields.NumberField({ initial: 40, min: 0, max: 100 }),

      // ── Skills
      skills: new fields.SchemaField({
        command:        new fields.NumberField({ initial: 40 }),
        pilot:          new fields.NumberField({ initial: 40 }),
        navigate:       new fields.NumberField({ initial: 40 }),
        techUse:        new fields.NumberField({ initial: 40 }),
        ballisticSkill: new fields.NumberField({ initial: 40 }),
        scrutiny:       new fields.NumberField({ initial: 35 })
      }),

      // ── Weapons (object/map keyed by id)
      weapons: new fields.ObjectField({ initial: {} }),

      // ── Torpedoes
      torpedoes: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, min: 0 }),
        max:   new fields.NumberField({ initial: 12, min: 0 }),
        type:  new fields.StringField({ initial: "Standard" })
      }),

      // ── Components
      essentialComponents:    new fields.ObjectField({ initial: {} }),
      supplementalComponents: new fields.ObjectField({ initial: {} }),

      // ── History
      history:       new fields.StringField({ initial: "" }),
      specialRules:  new fields.StringField({ initial: "" }),
      machineSpirit: new fields.StringField({ initial: "none" }),
      profitFactor:  new fields.NumberField({ initial: 0, min: 0 }),
      renown:        new fields.StringField({ initial: "unknown" }),
      achievements:  new fields.StringField({ initial: "" })
    };
  }
}

// Register the data model
Hooks.once("init", () => {
  CONFIG.Actor.dataModels["voidship"] = VoidShipDataModel;
});

// ── 3. ACTOR CLASS ───────────────────────────────────────────────

class VCShipActions extends Actor {

  /** Percentage helpers for template bars */
  get hullPercent()   { return this._pct(this.system.hull); }
  get shieldPercent() { return this._pct(this.system.shields); }
  get crewPercent()   { return this._pct(this.system.crew); }
  get moralePercent() { return this._pct(this.system.morale); }

  _pct(stat) {
    if (!stat || stat.max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((stat.value / stat.max) * 100)));
  }

  // ── VOID COMBAT ACTIONS ────────────────────────────────────────

  /** Lock On action — posts result to chat */
  async lockOn() {
    const skill = this.system.skills.ballisticSkill;
    const roll = await new Roll("1d100").evaluate();
    const success = roll.total <= skill;
    const msg = success
      ? `<span class="log-success">Success!</span> Locked on target — +20 BS to next attack this round.`
      : `<span class="log-hit">Failed!</span> Unable to achieve target lock.`;
    this._chatAction("🎯 Lock On", `Roll <span class="log-roll">${roll.total}</span> vs BS ${skill}: ${msg}`);
    if (success) await this.setFlag("void-conflict", "lockedOn", true);
  }

  /** Evasive Manoeuvres */
  async evasiveManoeuvres() {
    const skill = this.system.skills.pilot + this.system.manoeuvrability;
    const roll = await new Roll("1d100").evaluate();
    const success = roll.total <= skill;
    const msg = success
      ? `<span class="log-success">Success!</span> Evasive pattern enacted — attackers suffer -20 BS until next turn.`
      : `<span class="log-hit">Failed!</span> Could not manoeuvre effectively.`;
    this._chatAction("💨 Evasive Manoeuvres", `Roll <span class="log-roll">${roll.total}</span> vs Pilot ${skill}: ${msg}`);
  }

  /** Come to New Course */
  async comeToNewCourse() {
    const skill = this.system.skills.pilot + this.system.manoeuvrability;
    const roll = await new Roll("1d100").evaluate();
    const success = roll.total <= skill;
    const degrees = success ? "90°" : "45°";
    const msg = success
      ? `<span class="log-success">Success!</span> New heading set — ship may turn up to ${degrees}.`
      : `Partial success — ship may turn ${degrees}.`;
    this._chatAction("🧭 Come to New Course", `Roll <span class="log-roll">${roll.total}</span> vs Pilot ${skill}: ${msg}`);
  }

  /** Brace for Impact */
  async braceForImpact() {
    const skill = this.system.skills.command;
    const roll = await new Roll("1d100").evaluate();
    const success = roll.total <= skill;
    const msg = success
      ? `<span class="log-success">Success!</span> Brace enacted — halve damage from next hit.`
      : `<span class="log-hit">Failed!</span> Crew unprepared.`;
    this._chatAction("🛡 Brace for Impact", `Roll <span class="log-roll">${roll.total}</span> vs Command ${skill}: ${msg}`);
  }

  /** Damage Control */
  async damageControl() {
    const skill = this.system.skills.techUse;
    const roll = await new Roll("1d100").evaluate();
    const success = roll.total <= skill;
    if (success) {
      const repaired = Math.floor(Math.random() * 3) + 1;
      await this.update({ "system.hull.value": Math.min(this.system.hull.value + repaired, this.system.hull.max) });
      this._chatAction("🔧 Damage Control", `Roll <span class="log-roll">${roll.total}</span> vs Tech-Use ${skill}: <span class="log-success">Repaired ${repaired} Hull Integrity!</span>`);
    } else {
      this._chatAction("🔧 Damage Control", `Roll <span class="log-roll">${roll.total}</span> vs Tech-Use ${skill}: <span class="log-hit">Failed — no repairs made.</span>`);
    }
  }

  /** Fire a specific weapon */
  async fireWeapon(weaponKey) {
    const weapon = this.system.weapons[weaponKey];
    if (!weapon) return;
    if (weapon.status === "destroyed") {
      ui.notifications.warn(`${weapon.name} is destroyed and cannot fire!`);
      return;
    }

    const lockedOn = this.getFlag("void-conflict", "lockedOn");
    const bsBonus  = lockedOn ? 20 : 0;
    const bs       = this.system.skills.ballisticSkill + bsBonus;
    const roll     = await new Roll("1d100").evaluate();
    const success  = roll.total <= bs;

    if (lockedOn) await this.unsetFlag("void-conflict", "lockedOn");

    if (success) {
      // Roll damage for each point of Strength
      const str     = weapon.strength || 1;
      const dmgRoll = await new Roll(`${str}*(${weapon.damage || "1d10"})`).evaluate();
      const crit    = roll.total <= Math.floor(bs / 10); // crit on 1/10 of skill

      let dmgText = `<span class="log-hit">${dmgRoll.total} damage</span>`;
      if (crit) dmgText += ` — <b style="color:#ffaa00;">CRITICAL HIT!</b> Roll on Critical Damage table.`;

      this._chatAction(
        `⚔ ${weapon.name} (${weapon.location})`,
        `Roll <span class="log-roll">${roll.total}</span> vs BS ${bs}${lockedOn ? " (+20 Lock On)" : ""}: <span class="log-success">HIT!</span> ${dmgText}`
      );
    } else {
      this._chatAction(
        `⚔ ${weapon.name} (${weapon.location})`,
        `Roll <span class="log-roll">${roll.total}</span> vs BS ${bs}: <span class="log-hit">MISSED!</span>`
      );
    }
  }

  /** Fire ALL weapons at once */
  async fireAll() {
    const weapons = Object.entries(this.system.weapons || {});
    if (weapons.length === 0) {
      ui.notifications.warn("This vessel has no weapons configured!");
      return;
    }
    for (const [key] of weapons) {
      await this.fireWeapon(key);
    }
  }

  /** Ram action */
  async ram() {
    const skill = this.system.skills.pilot;
    const roll  = await new Roll("1d100").evaluate();
    const success = roll.total <= skill;
    if (success) {
      const dmg = await new Roll("1d10 + " + Math.floor(this.system.hull.max / 10)).evaluate();
      this._chatAction("⚡ RAM", `Roll <span class="log-roll">${roll.total}</span> vs Pilot ${skill}: <span class="log-success">RAMMING SPEED!</span> Target takes <span class="log-hit">${dmg.total} Hull damage</span>. This vessel takes <span class="log-hit">${Math.floor(dmg.total / 2)}</span>.`);
    } else {
      this._chatAction("⚡ RAM", `Roll <span class="log-roll">${roll.total}</span> vs Pilot ${skill}: <span class="log-hit">Failed to make contact!</span>`);
    }
  }

  /** Helper: post a formatted message to Foundry chat */
  async _chatAction(actionName, resultHtml) {
    const content = `
      <div style="font-family:'Crimson Text',serif;padding:6px 8px;border-left:3px solid #c9a84c;background:rgba(201,168,76,0.06);">
        <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:#c9a84c;margin-bottom:4px;">
          ${this.name} — ${actionName}
        </div>
        <div style="font-size:0.9rem;line-height:1.5;color:#d4c49a;">${resultHtml}</div>
      </div>`;
    await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor: this }) });
  }
}

// Register Actor class
Hooks.once("init", () => {
  CONFIG.Actor.typeLabels = CONFIG.Actor.typeLabels || {};
  CONFIG.Actor.typeLabels["voidship"] = "Void Ship";
});

// ── 4. ACTOR SHEET ───────────────────────────────────────────────

class VoidShipSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["void-conflict", "sheet", "actor"],
      template: "modules/void-conflict/templates/ship-sheet.html",
      width: 820,
      height: 680,
      tabs: [{ navSelector: ".vcs-tabs", contentSelector: ".vcs-tab-content", initial: "stats" }],
      resizable: true
    });
  }

  /** Build the data object that gets sent to the Handlebars template */
  getData() {
    const data = super.getData();
    const sys  = this.actor.system;

    // Percentage bars
    data.hullPercent   = this.actor.hullPercent ?? 100;
    data.shieldPercent = this.actor.shieldPercent ?? 100;
    data.crewPercent   = this.actor.crewPercent ?? 100;
    data.moralePercent = this.actor.moralePercent ?? 100;

    return data;
  }

  /** Wire up all button click listeners */
  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // Quick action buttons on Stats tab
    html.find('[data-action="lock-on"]').click(() => this.actor.lockOn());
    html.find('[data-action="evasive"]').click(() => this.actor.evasiveManoeuvres());
    html.find('[data-action="come-to-new-course"]').click(() => this.actor.comeToNewCourse());
    html.find('[data-action="brace"]').click(() => this.actor.braceForImpact());
    html.find('[data-action="fire-all"]').click(() => this.actor.fireAll());
    html.find('[data-action="ram"]').click(() => this.actor.ram());
    html.find('[data-action="repair"]').click(() => this.actor.damageControl());
    html.find('[data-action="open-battle"]').click(() => new VoidBattleApp().render(true));

    // Fire individual weapon buttons
    html.find('[data-action="fire-weapon"]').click(ev => {
      const key = ev.currentTarget.dataset.weaponKey;
      this.actor.fireWeapon(key);
    });

    // Add weapon
    html.find('[data-action="add-weapon"]').click(() => this._addWeapon());

    // Delete weapon
    html.find('[data-action="delete-weapon"]').click(ev => {
      const key = ev.currentTarget.dataset.weaponKey;
      this._deleteWeapon(key);
    });

    // Add components
    html.find('[data-action="add-essential"]').click(() => this._addComponent("essentialComponents"));
    html.find('[data-action="add-supplemental"]').click(() => this._addComponent("supplementalComponents"));

    // Delete component
    html.find('[data-action="delete-component"]').click(ev => {
      const { key, type } = ev.currentTarget.dataset;
      this._deleteComponent(type, key);
    });

    // Auto-update status dot color when select changes
    html.find('.vcs-comp-status-select').change(ev => {
      const dot = ev.currentTarget.closest('.vcs-component-row').querySelector('.vcs-comp-status-dot');
      if (dot) {
        dot.className = `vcs-comp-status-dot status-${ev.currentTarget.value}`;
      }
    });
  }

  async _addWeapon() {
    const weapons = foundry.utils.deepClone(this.actor.system.weapons || {});
    const key = "w" + Date.now();
    weapons[key] = {
      name: "New Weapon",
      location: "prow",
      strength: 1,
      damage: "1d10+2",
      crit: 5,
      range: 6,
      qualities: "",
      status: "ok"
    };
    await this.actor.update({ "system.weapons": weapons });
  }

  async _deleteWeapon(key) {
    const weapons = foundry.utils.deepClone(this.actor.system.weapons || {});
    delete weapons[key];
    await this.actor.update({ "system.weapons": weapons });
  }

  async _addComponent(type) {
    const components = foundry.utils.deepClone(this.actor.system[type] || {});
    const key = "c" + Date.now();
    components[key] = { name: "New Component", bonus: "", status: "ok" };
    await this.actor.update({ [`system.${type}`]: components });
  }

  async _deleteComponent(type, key) {
    const components = foundry.utils.deepClone(this.actor.system[type] || {});
    delete components[key];
    await this.actor.update({ [`system.${type}`]: components });
  }
}

// ── 5. VOID BATTLE APPLICATION ────────────────────────────────────

class VoidBattleApp extends Application {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "void-battle-app",
      title: "⚔ Void Conflict — Battle Map",
      template: "modules/void-conflict/templates/void-battle.html",
      width: 1100,
      height: 640,
      resizable: true,
      classes: ["void-conflict", "void-battle"]
    });
  }

  constructor() {
    super();
    this.round      = 1;
    this.initiative = "Imperium";
    this.ships      = this._loadShips();
    this.activeShip = this.ships[0] ?? null;
  }

  /** Gather all voidship actors from the world */
  _loadShips() {
    return game.actors.filter(a => a.type === "voidship").map(a => ({
      id:      a.id,
      name:    a.name,
      faction: a.system.faction,
      hull:    a.system.hull,
      shields: a.system.shields,
      speed:   a.system.speed,
      // Map position (random initial placement if not set)
      x: a.getFlag("void-conflict", "mapX") ?? (Math.random() * 0.6 + 0.1),
      y: a.getFlag("void-conflict", "mapY") ?? (Math.random() * 0.6 + 0.1)
    }));
  }

  getData() {
    return {
      round:      this.round,
      initiative: this.initiative,
      ships:      this.ships
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Next round
    html.find("#vba-next-round").click(() => {
      this.round++;
      html.find("#vba-round").text(this.round);
      this._log(html, `Round <b>${this.round}</b> begins. All vessels may act.`);
    });

    // Close
    html.find("#vba-close").click(() => this.close());

    // Battle actions
    html.find(".vba-action").click(ev => {
      const action = ev.currentTarget.dataset.action;
      this._handleBattleAction(html, action);
    });

    // Dice
    html.find(".vba-die").click(ev => {
      const sides = parseInt(ev.currentTarget.dataset.sides);
      const roll  = Math.floor(Math.random() * sides) + 1;
      html.find("#vba-dice-result").text(roll);
      this._log(html, `Rolled d${sides}: <span class="log-roll">${roll}</span>`);
    });

    // Ship selector
    html.find("#vba-active-ship").change(ev => {
      const id = ev.currentTarget.value;
      this.activeShip = this.ships.find(s => s.id === id) ?? null;
      this._updateStatBlock(html);
    });

    // Draw the battle map
    this._drawMap(html);
    this._updateStatBlock(html);
  }

  _handleBattleAction(html, action) {
    const ship = this.activeShip;
    if (!ship) return;

    const actor = game.actors.get(ship.id);
    if (!actor) return;

    const actionMap = {
      "lock-on":   () => actor.lockOn(),
      "evasive":   () => actor.evasiveManoeuvres(),
      "broadside": () => actor.fireAll(),
      "torpedo":   () => {
        const t = actor.system.torpedoes;
        if (t.value <= 0) { ui.notifications.warn("No torpedoes remaining!"); return; }
        actor.update({ "system.torpedoes.value": t.value - 1 });
        actor._chatAction("🚀 Torpedo Launch", `Torpedo fired! ${t.value - 1} remaining.`);
      },
      "ram":    () => actor.ram(),
      "repair": () => actor.damageControl(),
      "brace":  () => actor.braceForImpact(),
      "come-to-new-course": () => actor.comeToNewCourse(),
      "withdraw": () => {
        this._log(html, `<span class="log-actor">${ship.name}</span> attempts to withdraw from battle.`);
        actor._chatAction("🏳 Withdraw", "Attempting to disengage...");
      }
    };

    if (actionMap[action]) actionMap[action]();
    else this._log(html, `Action: <b>${action}</b> — roll as required by GM.`);
  }

  _updateStatBlock(html) {
    const ship  = this.activeShip;
    const block = html.find("#vba-active-stats");
    if (!ship) { block.html("<em>No ship selected</em>"); return; }

    const actor = game.actors.get(ship.id);
    if (!actor) { block.html("<em>Actor not found</em>"); return; }

    const sys = actor.system;
    const pct = (s) => s.max > 0 ? Math.round((s.value / s.max) * 100) : 0;

    block.html(`
      <div style="font-family:'Cinzel',serif;font-size:0.65rem;color:#c9a84c;margin-bottom:6px;">${actor.name}</div>
      <div style="font-size:0.7rem;margin-bottom:4px;">
        Hull: <b style="color:#44aa44;">${sys.hull.value}/${sys.hull.max}</b>
        &nbsp;|&nbsp; Shields: <b style="color:#4488cc;">${sys.shields.value}/${sys.shields.max}</b>
      </div>
      <div style="height:4px;background:rgba(255,255,255,0.05);margin-bottom:3px;">
        <div style="height:100%;width:${pct(sys.hull)}%;background:linear-gradient(90deg,#1a5a1a,#44aa44);"></div>
      </div>
      <div style="height:4px;background:rgba(255,255,255,0.05);margin-bottom:8px;">
        <div style="height:100%;width:${pct(sys.shields)}%;background:linear-gradient(90deg,#1a3a6a,#4488cc);"></div>
      </div>
      <div style="font-size:0.65rem;color:#7a6a4a;">
        Speed: <b style="color:#d4c49a;">${sys.speed} VU</b>
        &nbsp;|&nbsp; Armour: <b style="color:#d4c49a;">${sys.armour}</b>
        &nbsp;|&nbsp; Turrets: <b style="color:#d4c49a;">${sys.turrets}</b>
      </div>
    `);
  }

  _drawMap(html) {
    const canvas = html.find("#vba-battle-canvas")[0];
    if (!canvas) return;

    const container = canvas.parentElement;
    canvas.width  = container.clientWidth  || 600;
    canvas.height = container.clientHeight || 500;

    const ctx = canvas.getContext("2d");
    const W   = canvas.width;
    const H   = canvas.height;

    // Clear
    ctx.fillStyle = "#050408";
    ctx.fillRect(0, 0, W, H);

    // Starfield
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() < 0.05 ? 1.2 : 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grid lines
    ctx.strokeStyle = "rgba(201,168,76,0.08)";
    ctx.lineWidth = 0.5;
    const gridSize = 50;
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Nebula patch
    const nebula = ctx.createRadialGradient(W * 0.35, H * 0.25, 0, W * 0.35, H * 0.25, 120);
    nebula.addColorStop(0, "rgba(80,30,120,0.18)");
    nebula.addColorStop(1, "transparent");
    ctx.fillStyle = nebula;
    ctx.beginPath();
    ctx.ellipse(W * 0.35, H * 0.25, 140, 90, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Draw each ship
    this.ships.forEach(ship => {
      const sx = ship.x * W;
      const sy = ship.y * H;

      const factionColor = {
        imperium: "#4488cc",
        chaos:    "#cc3333",
        eldar:    "#44cc88",
        ork:      "#88cc44",
        tau:      "#44aacc",
        neutral:  "#c9a84c"
      }[ship.faction] ?? "#c9a84c";

      // Range ring
      ctx.strokeStyle = factionColor.replace(")", ",0.25)").replace("rgb", "rgba");
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(sx, sy, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ship glyph
      ctx.save();
      ctx.translate(sx, sy);

      // Glow
      ctx.shadowColor  = factionColor;
      ctx.shadowBlur   = 12;
      ctx.strokeStyle  = factionColor;
      ctx.fillStyle    = factionColor.replace(")", ",0.15)").replace("rgb", "rgba");
      ctx.lineWidth    = 1.5;

      // Ship body (triangle pointing up)
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(10, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Engine glow
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = factionColor;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 10, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;

      ctx.restore();

      // Ship name label
      ctx.font      = "10px 'Cinzel', serif";
      ctx.fillStyle = factionColor;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur  = 4;
      ctx.fillText(ship.name.length > 18 ? ship.name.slice(0, 16) + "…" : ship.name, sx, sy + 28);
      ctx.shadowBlur  = 0;
    });

    // Active ship highlight
    if (this.activeShip) {
      const sx = this.activeShip.x * W;
      const sy = this.activeShip.y * H;
      ctx.strokeStyle = "rgba(240,192,96,0.7)";
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _log(html, message) {
    const log   = html.find("#vba-log");
    const entry = $(`<div class="vba-log-entry">${message}</div>`);
    log.prepend(entry);
  }
}

// ── 6. MACRO HELPER ─────────────────────────────────────────────
// Users can call this from a chat macro: VoidConflict.openBattle()

Hooks.once("ready", () => {
  window.VoidConflict = { openBattle: () => new VoidBattleApp().render(true) };
  console.log("Void Conflict | Ready. Use VoidConflict.openBattle() to open battle map.");
});
