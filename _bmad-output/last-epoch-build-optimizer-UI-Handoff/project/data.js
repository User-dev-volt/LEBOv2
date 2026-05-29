/* ============================================================
   LEBO mock data
   Original content — generic ARPG vocabulary, not derived
   from copyrighted game text.
   ============================================================ */

window.LEBO_DATA = (function () {

  const CLASSES = [
    { id: "acolyte", name: "Acolyte", masteries: ["Lich", "Necromancer", "Warlock"] },
    { id: "mage", name: "Mage", masteries: ["Sorcerer", "Spellblade", "Runemaster"] },
    { id: "primalist", name: "Primalist", masteries: ["Beastmaster", "Shaman", "Druid"] },
    { id: "rogue", name: "Rogue", masteries: ["Bladedancer", "Marksman", "Falconer"] },
    { id: "sentinel", name: "Sentinel", masteries: ["Paladin", "Forge Guard", "Void Knight"] },
  ];

  const GEAR_SLOTS = [
    { id: "helm",     label: "Helm",     col: "left",  glyph: "helm" },
    { id: "amulet",   label: "Amulet",   col: "left",  glyph: "amulet" },
    { id: "chest",    label: "Body",     col: "left",  glyph: "chest" },
    { id: "belt",     label: "Belt",     col: "left",  glyph: "belt" },
    { id: "boots",    label: "Boots",    col: "left",  glyph: "boots" },
    { id: "weapon",   label: "Main",     col: "right", glyph: "weapon" },
    { id: "offhand",  label: "Off",      col: "right", glyph: "shield" },
    { id: "gloves",   label: "Gloves",   col: "right", glyph: "gloves" },
    { id: "ring1",    label: "Ring I",   col: "right", glyph: "ring" },
    { id: "ring2",    label: "Ring II",  col: "right", glyph: "ring" },
    { id: "relic",    label: "Relic",    col: "right", glyph: "relic" },
  ];

  // Sample items per slot — generic invented names
  const ITEMS_BY_SLOT = {
    helm: [
      { id: "h1", name: "Iron Cowl", base: "Iron Cowl", rarity: "normal", affixes: 0 },
      { id: "h2", name: "Veiled Hood", base: "Linen Hood", rarity: "magic", affixes: 2 },
      { id: "h3", name: "Crown of Ashen Light", base: "Plate Helm", rarity: "rare", affixes: 4 },
      { id: "h4", name: "Mourning Visage", base: "Bone Helm", rarity: "unique", affixes: 0, uniqueText: "+15 to all minion levels" },
      { id: "h5", name: "Frostward Crest", base: "Steel Helm", rarity: "set", affixes: 3 },
    ],
    amulet: [
      { id: "a1", name: "Carved Pendant", base: "Wooden Amulet", rarity: "normal", affixes: 0 },
      { id: "a2", name: "Watcher's Eye", base: "Silver Amulet", rarity: "magic", affixes: 2 },
      { id: "a3", name: "Choker of the Tide", base: "Gold Amulet", rarity: "rare", affixes: 4 },
      { id: "a4", name: "Heart of the Lich King", base: "Onyx Amulet", rarity: "unique", affixes: 0, uniqueText: "Spend health instead of mana" },
    ],
    chest: [
      { id: "c1", name: "Tattered Robe", base: "Wool Robe", rarity: "normal", affixes: 0 },
      { id: "c2", name: "Bloodweave Cuirass", base: "Plate Cuirass", rarity: "rare", affixes: 4 },
      { id: "c3", name: "Mantle of the Dead Sun", base: "Death's Embrace", rarity: "unique", affixes: 0, uniqueText: "Convert physical damage to necrotic" },
      { id: "c4", name: "Cinderclad Vestment", base: "Cloth Robe", rarity: "legendary", affixes: 4, uniqueText: "Ignite damage doubled" },
    ],
    belt: [
      { id: "b1", name: "Cinch", base: "Cloth Belt", rarity: "normal", affixes: 0 },
      { id: "b2", name: "Sash of Embers", base: "Wide Belt", rarity: "magic", affixes: 2 },
      { id: "b3", name: "Girdle of Stillness", base: "Leather Belt", rarity: "rare", affixes: 4 },
    ],
    boots: [
      { id: "bo1", name: "Worn Sandals", base: "Sandals", rarity: "normal", affixes: 0 },
      { id: "bo2", name: "Stalker's Tread", base: "Leather Boots", rarity: "rare", affixes: 4 },
      { id: "bo3", name: "Striders of the Wandering Star", base: "Greaves", rarity: "unique", affixes: 0, uniqueText: "+45% movement speed" },
    ],
    weapon: [
      { id: "w1", name: "Abacus Rod", base: "Wand", rarity: "magic", affixes: 1 },
      { id: "w2", name: "Necrotic Scepter", base: "Bone Scepter", rarity: "rare", affixes: 4 },
      { id: "w3", name: "Famine's Edge", base: "Reaver Staff", rarity: "unique", affixes: 0, uniqueText: "Enemies damaged take 30% increased damage" },
      { id: "w4", name: "Worldbreaker", base: "Two-Handed Maul", rarity: "legendary", affixes: 4 },
    ],
    offhand: [
      { id: "o1", name: "Tower Shield", base: "Iron Shield", rarity: "normal", affixes: 0 },
      { id: "o2", name: "Sigil of Hours", base: "Catalyst", rarity: "rare", affixes: 4 },
      { id: "o3", name: "Bulwark of Echoes", base: "Kite Shield", rarity: "set", affixes: 3 },
    ],
    gloves: [
      { id: "g1", name: "Cloth Wraps", base: "Cloth Gloves", rarity: "normal", affixes: 0 },
      { id: "g2", name: "Ascetic Gloves", base: "Silken Gloves", rarity: "rare", affixes: 4 },
      { id: "g3", name: "Touch of the Reaper", base: "Bone Gloves", rarity: "unique", affixes: 0, uniqueText: "Critical strikes inflict bleed" },
    ],
    ring1: [
      { id: "r1", name: "Plain Band", base: "Iron Ring", rarity: "normal", affixes: 0 },
      { id: "r2", name: "Coil of Smoke", base: "Silver Ring", rarity: "rare", affixes: 4 },
      { id: "r3", name: "Pact of the Sundered", base: "Ruby Ring", rarity: "unique", affixes: 0, uniqueText: "Sacrifice 30% max HP for damage" },
    ],
    ring2: [
      { id: "r4", name: "Garnet Loop", base: "Gold Ring", rarity: "magic", affixes: 2 },
      { id: "r5", name: "Auric Circle", base: "Platinum Ring", rarity: "rare", affixes: 4 },
    ],
    relic: [
      { id: "rl1", name: "Bone Idol", base: "Necromantic Focus", rarity: "magic", affixes: 1 },
      { id: "rl2", name: "Reliquary of Sorrows", base: "Necromantic Focus", rarity: "rare", affixes: 4 },
      { id: "rl3", name: "Soulcage", base: "Cursed Relic", rarity: "unique", affixes: 0, uniqueText: "Minions gain 100% damage but die after 8s" },
    ],
  };

  // Generic affix pool by slot category
  const AFFIX_POOL = {
    offense: [
      { id: "fl_dmg",   name: "Increased Fire Damage",       range: [10, 80], tier: 7, unit: "%" },
      { id: "co_dmg",   name: "Increased Cold Damage",       range: [10, 80], tier: 7, unit: "%" },
      { id: "ne_dmg",   name: "Increased Necrotic Damage",   range: [10, 80], tier: 7, unit: "%" },
      { id: "vo_dmg",   name: "Increased Void Damage",       range: [10, 80], tier: 7, unit: "%" },
      { id: "ph_dmg",   name: "Increased Physical Damage",   range: [10, 80], tier: 7, unit: "%" },
      { id: "crit_ch",  name: "Critical Strike Chance",      range: [80, 240], tier: 7, unit: "%" },
      { id: "crit_mul", name: "Critical Strike Multiplier",  range: [12, 70], tier: 7, unit: "%" },
      { id: "atk_spd",  name: "Attack Speed",                range: [5, 18], tier: 5, unit: "%" },
      { id: "cast_spd", name: "Cast Speed",                  range: [5, 22], tier: 5, unit: "%" },
    ],
    defense: [
      { id: "hp_flat",  name: "Maximum Health",              range: [12, 110], tier: 7, unit: "" },
      { id: "hp_pct",   name: "Increased Health",            range: [4, 32], tier: 7, unit: "%" },
      { id: "armor",    name: "Armor",                       range: [40, 380], tier: 7, unit: "" },
      { id: "dodge",    name: "Dodge Rating",                range: [40, 320], tier: 7, unit: "" },
      { id: "ward",     name: "Ward Retention",              range: [10, 60], tier: 7, unit: "%" },
      { id: "endur",    name: "Endurance",                   range: [3, 15], tier: 7, unit: "%" },
      { id: "fire_res", name: "Fire Resistance",             range: [16, 80], tier: 7, unit: "%" },
      { id: "cold_res", name: "Cold Resistance",             range: [16, 80], tier: 7, unit: "%" },
      { id: "ltn_res",  name: "Lightning Resistance",        range: [16, 80], tier: 7, unit: "%" },
      { id: "void_res", name: "Void Resistance",             range: [16, 80], tier: 7, unit: "%" },
    ],
    utility: [
      { id: "mv_spd",   name: "Movement Speed",              range: [4, 12], tier: 5, unit: "%" },
      { id: "cd_rec",   name: "Cooldown Recovery",           range: [6, 24], tier: 5, unit: "%" },
      { id: "mana_reg", name: "Mana Regen",                  range: [2, 14], tier: 7, unit: "/s" },
      { id: "potion",   name: "Potion Heal Effectiveness",   range: [10, 40], tier: 5, unit: "%" },
    ],
  };

  // Generic skill list per class
  const SKILLS_BY_CLASS = {
    acolyte: [
      { id: "harvest",     name: "Harvest",            tag: "Melee · Necrotic" },
      { id: "rip_blood",   name: "Rip Blood",          tag: "Spell · Necrotic" },
      { id: "marrow",      name: "Marrow Shards",      tag: "Spell · Physical" },
      { id: "wraith",      name: "Summon Wraith",      tag: "Minion · Necrotic" },
      { id: "transplant",  name: "Transplant",         tag: "Movement · Necrotic" },
      { id: "soul_feast",  name: "Soul Feast",         tag: "Spell · Necrotic" },
      { id: "skel_mage",   name: "Skeletal Mage",      tag: "Minion · Elemental" },
      { id: "bone_curse",  name: "Bone Curse",         tag: "Curse · Physical" },
      { id: "rev_volley",  name: "Reaper's Volley",    tag: "Spell · Physical" },
    ],
    mage:        [{ id: "fb", name: "Fireball", tag: "Spell · Fire" }, { id: "ts", name: "Teleport", tag: "Movement" }],
    primalist:   [{ id: "swp", name: "Swipe", tag: "Melee · Physical" }],
    rogue:       [{ id: "ds",  name: "Dancing Strikes", tag: "Melee · Physical" }],
    sentinel:    [{ id: "vc",  name: "Void Cleave", tag: "Melee · Void" }],
  };

  // Generic passive tree nodes (positions in svg space)
  const PASSIVE_NODES = (function () {
    const nodes = [];
    // central radial cluster (Acolyte base)
    const baseCenter = [0, 0];
    nodes.push({ id: "n_origin", x: 0, y: 0, type: "keystone", name: "Acolyte's Pact", desc: "+8% damage · +20 HP" });

    // 6 spokes around origin
    const ringStats = [
      { name: "Death's Embrace",  desc: "+15% Necrotic Damage" },
      { name: "Festering Spite",  desc: "+12 Health Regen" },
      { name: "Cold Heart",       desc: "+18% Cold Damage" },
      { name: "Bone Hunger",      desc: "+22 Mana Regen" },
      { name: "Withering Light",  desc: "+10% Void Damage" },
      { name: "Sanguine Bond",    desc: "Heal 1% HP on hit" },
    ];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const r = 90;
      nodes.push({
        id: `n_inner_${i}`,
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        type: "minor",
        parent: "n_origin",
        ...ringStats[i],
      });
    }

    // outer ring
    const outerNames = [
      ["Plague Lord", "+25% Damage over Time"],
      ["Death Magic", "+22% Necrotic & Cold"],
      ["Frost Wreath", "+30% Cold Pen"],
      ["Mind of the Reaper", "+40 Mana, +10% cast speed"],
      ["Aspect of Decay", "+18% Damage taken converted"],
      ["Wraithwalk", "+15% Move speed, +30% dodge"],
    ];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2 + Math.PI / 6;
      const r = 200;
      nodes.push({
        id: `n_outer_${i}`,
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        type: i === 0 || i === 3 ? "notable" : "minor",
        parent: `n_inner_${i}`,
        name: outerNames[i][0],
        desc: outerNames[i][1],
      });
    }

    // far ring
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
      const r = 330;
      const parentIdx = Math.floor(i / 2);
      nodes.push({
        id: `n_far_${i}`,
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        type: i % 4 === 0 ? "notable" : "minor",
        parent: `n_outer_${parentIdx}`,
        name: i % 4 === 0 ? "Keystone Path" : "Lesser Node",
        desc: i % 4 === 0 ? "Unique build-defining effect" : "+8% to chosen stat",
      });
    }

    return nodes;
  })();

  // Pre-allocated demo state
  const SAVED_BUILDS = [
    { id: "sb1", name: "Bone Curse Lich",     class: "Acolyte", mastery: "Lich",        active: true },
    { id: "sb2", name: "Frost Wraith Pack",   class: "Acolyte", mastery: "Necromancer", active: false },
    { id: "sb3", name: "Void Knight Pull",    class: "Sentinel", mastery: "Void Knight", active: false },
  ];

  // Sample idol shapes (Last Epoch–style grid) — generic affixes
  const IDOL_DEFS = [
    { id: "i_1x1_a", shape: "1x1", name: "Lesser Idol of Swiftness",    stat: "+4% Movement Speed", cells: 1 },
    { id: "i_1x1_b", shape: "1x1", name: "Lesser Idol of Vigor",         stat: "+20 Health",          cells: 1 },
    { id: "i_2x1_a", shape: "2x1", name: "Stout Idol of Conflagration",  stat: "+18% Fire Damage",    cells: 2 },
    { id: "i_2x1_b", shape: "2x1", name: "Stout Idol of Frost",          stat: "+22 Cold Resistance", cells: 2 },
    { id: "i_1x2_a", shape: "1x2", name: "Slender Idol of Marrow",       stat: "+14% Bone Spell Dmg", cells: 2 },
    { id: "i_2x2_a", shape: "2x2", name: "Grand Idol of the Wanderer",   stat: "+32 Dodge, +6% Crit", cells: 4 },
    { id: "i_1x3_a", shape: "1x3", name: "Humble Idol of the Storm",     stat: "+18% Lightning Dmg",  cells: 3 },
    { id: "i_3x1_a", shape: "3x1", name: "Wide Idol of Endurance",       stat: "+5% Endurance Thresh", cells: 3 },
  ];

  // Blessings (generic factions)
  const BLESSING_SLOTS = [
    { id: "bs1", title: "Blood, Frost, and Death",  options: ["Twisted Memory (+30% cold)", "Cursed Bones (+18% necrotic)", "Sanguine Pact (+12% leech)"] },
    { id: "bs2", title: "The Age of Winter",        options: ["Gift of Winter (+18 cold res)", "Frozen Hearts (+12% chill effect)", "Pale Crown (+15 ward retention)"] },
    { id: "bs3", title: "Reign of Dragons",         options: ["Wing's Shadow (+80 dodge)", "Scaled Plate (+220 armor)", "Wyrm's Fury (+22% fire dmg)"] },
    { id: "bs4", title: "The Black Sun",            options: ["Twisted Hearts (+30% void)", "Eclipse Shroud (+40 ward)", "Devourer's Gaze (+15% void pen)"] },
    { id: "bs5", title: "The Last Ruin",            options: ["Stone Memory (+8% phys res)", "Ruin's Echo (+12 mana)", "Lost Lineage (+18% rare drop)"] },
  ];

  return {
    CLASSES, GEAR_SLOTS, ITEMS_BY_SLOT, AFFIX_POOL,
    SKILLS_BY_CLASS, PASSIVE_NODES, SAVED_BUILDS,
    IDOL_DEFS, BLESSING_SLOTS,
  };
})();
