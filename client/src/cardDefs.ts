// ── Card types ────────────────────────────────────────────────────
export type CardId =
  | "slash" | "weak_jab" | "fumble"
  | "heavy_blow" | "heal" | "shield" | "poison_dart" | "taunt"
  | "mana_burn" | "ice_spike" | "regen" | "war_cry"
  | "gamble" | "steal" | "divine_shield" | "double_strike"
  | "vampire_bite" | "earthquake" | "berserker" | "ghost_step"
  | "reflect" | "lucky_shot" | "counter_stance" | "mana_surge"
  | "pickpocket" | "explosion" | "shockwave" | "chain_stun" | "sacred_spring"
  | "cursed_blade" | "blood_pact" | "soul_drain"
  | "cursed_heal" | "betrayal" | "plague" | "sacrifice"
  | "hand_swap" | "cursed_mirror" | "curse_tax" | "blood_transfusion"
  | "freeze" | "divine_retribution" | "titans_wrath" | "last_stand"
  | "lightning_storm" | "meteor" | "overflow" | "echo_strike" | "celestial_mend"
  | "soul_swap" | "armageddon" | "void_rift" | "judgement" | "time_warp" | "phoenix_ember"
  | "singularity" | "dark_matter" | "event_horizon" | "neutron_star" | "void_pulse";

export type Rarity = "common" | "uncommon" | "rare" | "cursed" | "corrupted" | "legendary" | "mythic" | "void";

export interface CardDef {
  id: CardId;
  name: string;
  icon: string;
  description: string;
  rarity: Rarity;
  color: string;
  bgColor: string;
  glowColor: string;
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common:    "#888888",
  uncommon:  "#45aaf2",
  rare:      "#a55eea",
  cursed:    "#fc5c65",
  corrupted: "#c44dff",
  legendary: "#f9ca24",
  mythic:    "#ff6fd8",
  void:      "#00ffcc",
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common:    "COMMON",
  uncommon:  "UNCOMMON",
  rare:      "◆ RARE",
  cursed:    "☠ CURSED",
  corrupted: "☣ CORRUPTED",
  legendary: "★ LEGENDARY",
  mythic:    "✦ MYTHIC ✦",
  void:      "◈ VOID ◈",
};

export const CARD_DEFS: Record<CardId, CardDef> = {
  // ── COMMON ──────────────────────────────────────────────────────
  slash:              { id: "slash",              name: "SLASH",              icon: "⚔",  rarity: "common",    color: "#ff6b6b", bgColor: "#1a0505", glowColor: "#ff6b6b",
                        description: "Deal 14 damage." },
  weak_jab:           { id: "weak_jab",           name: "WEAK JAB",           icon: "👊", rarity: "common",    color: "#888",    bgColor: "#0d0d0d", glowColor: "#666",
                        description: "8 DMG + immediately draw 1 extra card (replaces normal end-of-turn draw)." },
  fumble:             { id: "fumble",             name: "FUMBLE",             icon: "🤦", rarity: "common",    color: "#777",    bgColor: "#0f0f0f", glowColor: "#666",
                        description: "12 DMG — 20% chance to drop a random card from your own hand." },

  // ── UNCOMMON ────────────────────────────────────────────────────
  heavy_blow:         { id: "heavy_blow",         name: "HEAVY BLOW",         icon: "💥", rarity: "uncommon",  color: "#ff9f43", bgColor: "#1a0d00", glowColor: "#ff9f43",
                        description: "20 DMG + stun foe 1 turn (subject to 2-turn stun cooldown)." },
  heal:               { id: "heal",               name: "MEND WOUNDS",        icon: "♥",  rarity: "uncommon",  color: "#26de81", bgColor: "#001a0a", glowColor: "#26de81",
                        description: "Restore 25 HP." },
  shield:             { id: "shield",             name: "IRON SHIELD",        icon: "🛡", rarity: "uncommon",  color: "#45aaf2", bgColor: "#001020", glowColor: "#45aaf2",
                        description: "Block the next hit. If already shielded, heal 10 HP instead." },
  poison_dart:        { id: "poison_dart",        name: "POISON DART",        icon: "☠",  rarity: "uncommon",  color: "#78e08f", bgColor: "#001500", glowColor: "#78e08f",
                        description: "10 DMG + poisons foe for 8 damage at the start of their next turn." },
  taunt:              { id: "taunt",              name: "TAUNT",              icon: "😤", rarity: "uncommon",  color: "#fd9644", bgColor: "#1a0800", glowColor: "#fd9644",
                        description: "8 DMG + attempt to stun foe 1 turn (uses stun cooldown)." },
  mana_burn:          { id: "mana_burn",          name: "MANA BURN",          icon: "🔥", rarity: "uncommon",  color: "#ff5e57", bgColor: "#1a0200", glowColor: "#ff5e57",
                        description: "Destroy a random card from foe's hand + deal 12 DMG." },
  ice_spike:          { id: "ice_spike",          name: "ICE SPIKE",          icon: "🧊", rarity: "uncommon",  color: "#74b9ff", bgColor: "#001015", glowColor: "#74b9ff",
                        description: "15 DMG + stun foe 1 turn (subject to stun cooldown)." },
  regen:              { id: "regen",              name: "REGEN",              icon: "💚", rarity: "uncommon",  color: "#26de81", bgColor: "#001508", glowColor: "#26de81",
                        description: "Gain 3 regen stacks (max 6). Each stack heals 9 HP at your turn start, then decreases by 1." },
  war_cry:            { id: "war_cry",            name: "WAR CRY",            icon: "📯", rarity: "uncommon",  color: "#fd9644", bgColor: "#1a0c00", glowColor: "#fd9644",
                        description: "Your next attack deals +15 bonus DMG (consumed on use, capped at 30 total bonus)." },

  // ── RARE ────────────────────────────────────────────────────────
  gamble:             { id: "gamble",             name: "GAMBLE",             icon: "🎲", rarity: "rare",      color: "#f7b731", bgColor: "#1a1200", glowColor: "#f7b731",
                        description: "50/50: deal 28 DMG to foe, or take 15 self-damage." },
  steal:              { id: "steal",              name: "MIRROR STRIKE",      icon: "🪞", rarity: "rare",      color: "#a55eea", bgColor: "#100018", glowColor: "#a55eea",
                        description: "Copy and instantly replay foe's last used card (cannot mirror Time Warp)." },
  divine_shield:      { id: "divine_shield",      name: "DIVINE SHIELD",      icon: "✦",  rarity: "rare",      color: "#fed330", bgColor: "#1a1500", glowColor: "#fed330",
                        description: "Raise a shield + heal 12 HP." },
  double_strike:      { id: "double_strike",      name: "DOUBLE STRIKE",      icon: "⚡", rarity: "rare",      color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24",
                        description: "Strike twice for 14 DMG each (28 base total). Second hit is blocked if first was." },
  vampire_bite:       { id: "vampire_bite",       name: "VAMPIRE BITE",       icon: "🧛", rarity: "rare",      color: "#e056fd", bgColor: "#150010", glowColor: "#e056fd",
                        description: "16 DMG + heal for half the damage dealt." },
  earthquake:         { id: "earthquake",         name: "EARTHQUAKE",         icon: "🌍", rarity: "rare",      color: "#f0932b", bgColor: "#1a0a00", glowColor: "#f0932b",
                        description: "24 DMG to foe + 8 self-damage. Self-damage always applies regardless of shields." },
  berserker:          { id: "berserker",          name: "BERSERKER",          icon: "😡", rarity: "rare",      color: "#fc5c65", bgColor: "#1a0005", glowColor: "#fc5c65",
                        description: "10–45 DMG scaled on missing HP. The lower your HP, the harder you hit." },
  ghost_step:         { id: "ghost_step",         name: "GHOST STEP",         icon: "👻", rarity: "rare",      color: "#dfe6e9", bgColor: "#0a0a10", glowColor: "#b2bec3",
                        description: "Raise a shield + deal 12 counter damage to foe." },
  reflect:            { id: "reflect",            name: "REFLECT",            icon: "🔮", rarity: "rare",      color: "#a55eea", bgColor: "#0d0018", glowColor: "#a55eea",
                        description: "The next attack against you is reflected back at full damage." },
  lucky_shot:         { id: "lucky_shot",         name: "LUCKY SHOT",         icon: "🍀", rarity: "rare",      color: "#26de81", bgColor: "#001500", glowColor: "#26de81",
                        description: "Random 10–35 DMG. Pure chaos." },
  counter_stance:     { id: "counter_stance",     name: "COUNTER STANCE",     icon: "🔄", rarity: "rare",      color: "#45aaf2", bgColor: "#001020", glowColor: "#45aaf2",
                        description: "The next hit aimed at you reflects back to the attacker + deals 12 bonus DMG to them." },
  mana_surge:         { id: "mana_surge",         name: "MANA SURGE",         icon: "✨", rarity: "rare",      color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24",
                        description: "Your next card deals DOUBLE damage + 10 flat bonus (also consumes War Cry bonus)." },
  pickpocket:         { id: "pickpocket",         name: "PICKPOCKET",         icon: "🤏", rarity: "rare",      color: "#fd9644", bgColor: "#1a0800", glowColor: "#fd9644",
                        description: "Steal a random card from foe's hand into yours (no end-of-turn draw)." },
  explosion:          { id: "explosion",          name: "EXPLOSION",          icon: "💣", rarity: "rare",      color: "#ff6b6b", bgColor: "#1a0505", glowColor: "#ff6b6b",
                        description: "28 DMG — also destroys 1 random card from your own hand as collateral." },
  shockwave:          { id: "shockwave",          name: "SHOCKWAVE",          icon: "🌊", rarity: "rare",      color: "#a55eea", bgColor: "#0d0018", glowColor: "#a55eea",
                        description: "22 DMG. If foe is currently stunned: deals 42 DMG instead." },
  chain_stun:         { id: "chain_stun",         name: "CHAIN STUN",         icon: "⛓", rarity: "rare",      color: "#45aaf2", bgColor: "#000d18", glowColor: "#45aaf2",
                        description: "10 DMG. If foe is already stunned: deal 22 DMG instead (does not extend the stun)." },
  sacred_spring:      { id: "sacred_spring",      name: "SACRED SPRING",      icon: "🌿", rarity: "rare",      color: "#26de81", bgColor: "#001a0a", glowColor: "#26de81",
                        description: "Heal 25 HP + gain 2 regen stacks." },

  // ── CURSED ──────────────────────────────────────────────────────
  cursed_blade:       { id: "cursed_blade",       name: "CURSED BLADE",       icon: "🩸", rarity: "cursed",    color: "#fc5c65", bgColor: "#1a0008", glowColor: "#fc5c65",
                        description: "30 DMG — raw corrupted power with no drawbacks." },
  blood_pact:         { id: "blood_pact",         name: "BLOOD PACT",         icon: "💀", rarity: "cursed",    color: "#fc5c65", bgColor: "#1a0000", glowColor: "#fc5c65",
                        description: "Sacrifice 8 HP to deal 28 DMG." },
  soul_drain:         { id: "soul_drain",         name: "SOUL DRAIN",         icon: "🌙", rarity: "cursed",    color: "#fc5c65", bgColor: "#120008", glowColor: "#fc5c65",
                        description: "10 base DMG + 8 DMG per foe regen stack (all stacks removed). Heal 50% of damage dealt." },

  // ── CORRUPTED ───────────────────────────────────────────────────
  cursed_heal:        { id: "cursed_heal",        name: "CURSED HEAL",        icon: "💜", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Heal 35 HP... but foe also heals 15 HP." },
  betrayal:           { id: "betrayal",           name: "BETRAYAL",           icon: "🗡", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "28 DMG, 10 self-damage, and gift foe a random rare card." },
  plague:             { id: "plague",             name: "PLAGUE",             icon: "🦠", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Both players infected for 3 turns: you take 5 DMG/turn, foe takes 8 DMG/turn." },
  sacrifice:          { id: "sacrifice",          name: "SACRIFICE",          icon: "⚰", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Lose 25 HP, immediately draw 4 cards." },
  hand_swap:          { id: "hand_swap",          name: "HAND SWAP",          icon: "🔀", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Swap your entire hand with foe's hand." },
  cursed_mirror:      { id: "cursed_mirror",      name: "CURSED MIRROR",      icon: "🪟", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Copy all of foe's active buffs AND debuffs onto yourself (shield, reflect, regen, poison, etc.)." },
  curse_tax:          { id: "curse_tax",          name: "CURSE TAX",          icon: "💸", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Destroy a random card from foe's hand. Heal based on its rarity: Common 5, Uncommon 10, Rare 15, up to Void 35 HP." },
  blood_transfusion:  { id: "blood_transfusion",  name: "BLOOD TRANSFUSION",  icon: "🩺", rarity: "corrupted", color: "#c44dff", bgColor: "#150010", glowColor: "#c44dff",
                        description: "Steal up to 22 HP directly from foe (they lose it, you gain it). Cannot reduce foe below 1 HP." },

  // ── LEGENDARY ───────────────────────────────────────────────────
  freeze:             { id: "freeze",             name: "FREEZE",             icon: "❄",  rarity: "legendary", color: "#f9ca24", bgColor: "#001520", glowColor: "#74b9ff",
                        description: "28 DMG + block foe's healing for 3 turns." },
  divine_retribution: { id: "divine_retribution", name: "DIVINE RETRIBUTION", icon: "⚖", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24",
                        description: "Strike twice for 20 DMG each (40 base total). Second hit attempts to stun foe 1 turn." },
  titans_wrath:       { id: "titans_wrath",       name: "TITAN'S WRATH",      icon: "🔱", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1000", glowColor: "#f9ca24",
                        description: "DMG equals the absolute HP difference between players (min 15, max 50). Best when you're losing." },
  last_stand:         { id: "last_stand",         name: "LAST STAND",         icon: "🛡", rarity: "legendary", color: "#f9ca24", bgColor: "#1a0005", glowColor: "#fc5c65",
                        description: "DMG = (100 − your HP) × 0.8 (max 60). If HP ≤ 40: also raises a shield. Save it for desperation." },
  lightning_storm:    { id: "lightning_storm",    name: "LIGHTNING STORM",    icon: "⛈",  rarity: "legendary", color: "#f9ca24", bgColor: "#1a1400", glowColor: "#f9ca24",
                        description: "3 bolts: each has 70% chance to hit foe for 14 DMG, or 30% chance to backfire for 5 self-damage." },
  meteor:             { id: "meteor",             name: "METEOR",             icon: "☄",  rarity: "legendary", color: "#f9ca24", bgColor: "#1a1000", glowColor: "#f9ca24",
                        description: "40 DMG — bypasses all shields and reflects. 18 recoil damage to yourself." },
  overflow:           { id: "overflow",           name: "OVERFLOW",           icon: "🃏", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24",
                        description: "Draw 5 cards now. At the start of your next turn, choose 2 cards to discard before acting." },
  echo_strike:        { id: "echo_strike",        name: "ECHO STRIKE",        icon: "🔁", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1200", glowColor: "#f9ca24",
                        description: "Repeat the exact damage of your last played card (raw DMG only, no side effects)." },
  celestial_mend:     { id: "celestial_mend",     name: "CELESTIAL MEND",     icon: "✨", rarity: "legendary", color: "#f9ca24", bgColor: "#001a0f", glowColor: "#26de81",
                        description: "Heal 55 HP + cleanse ALL debuffs (poison, plague, stun, heal block, neutron star ticks)." },

  // ── MYTHIC ──────────────────────────────────────────────────────
  soul_swap:          { id: "soul_swap",          name: "SOUL SWAP",          icon: "👁", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Swap HP totals with opponent (capped at each player's max HP). Devastating when behind." },
  armageddon:         { id: "armageddon",         name: "ARMAGEDDON",         icon: "💥", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Both players take 32 DMG. Destroys all shields first — bypasses all defenses." },
  void_rift:          { id: "void_rift",          name: "VOID RIFT",          icon: "🌀", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Destroy both players' entire hands. Both redraw 3 fresh cards." },
  judgement:          { id: "judgement",          name: "JUDGEMENT",          icon: "⚖", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Instant win if foe has ≤ 25 HP. Otherwise deals only 5 DMG." },
  time_warp:          { id: "time_warp",          name: "TIME WARP",          icon: "⏳", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Take 2 extra turns now. Pay a debt of 1 skipped turn later. Cannot be mirrored." },
  phoenix_ember:      { id: "phoenix_ember",      name: "PHOENIX EMBER",      icon: "🔥", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0500", glowColor: "#ff6fd8",
                        description: "If HP ≤ 20: restore to 65 HP + raise a shield + cleanse all debuffs. Otherwise heal 22 HP." },

  // ── VOID ────────────────────────────────────────────────────────
  singularity:        { id: "singularity",        name: "SINGULARITY",        icon: "🕳", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "Equalize both players' HP to the average. Brutal when you're ahead." },
  dark_matter:        { id: "dark_matter",        name: "DARK MATTER",        icon: "🫧", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "Your next 3 incoming attacks deal 0 damage. Each absorbed hit removes 1 stack." },
  event_horizon:      { id: "event_horizon",      name: "EVENT HORIZON",      icon: "🌑", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "The next attack aimed at you collapses inward — the attacker takes the full damage instead." },
  neutron_star:       { id: "neutron_star",       name: "NEUTRON STAR",       icon: "⭐", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "18 DMG now + 10 radiation damage at the start of foe's next 3 turns." },
  void_pulse:         { id: "void_pulse",         name: "VOID PULSE",         icon: "🔵", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "10 DMG base + 8 DMG per active debuff on foe (poison, plague, stun, neutron star, event horizon, dark matter, heal block). Max 60 DMG." },
};