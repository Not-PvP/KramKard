// ── Card types ────────────────────────────────────────────────────
export type CardId =
  | "slash" | "weak_jab" | "fumble"
  | "heavy_blow" | "heal" | "shield" | "poison_dart" | "taunt"
  | "mana_burn" | "ice_spike" | "regen"
  | "gamble" | "steal" | "divine_shield" | "double_strike"
  | "vampire_bite" | "earthquake" | "berserker" | "ghost_step"
  | "reflect" | "lucky_shot" | "counter_stance" | "mana_surge"
  | "pickpocket" | "explosion"
  | "cursed_blade" | "blood_pact"
  | "cursed_heal" | "betrayal" | "plague" | "sacrifice"
  | "freeze" | "divine_retribution" | "titans_wrath" | "last_stand"
  | "lightning_storm" | "meteor"
  | "soul_swap" | "armageddon" | "void_rift" | "judgement"
  // VOID rarity
  | "singularity" | "dark_matter" | "event_horizon" | "neutron_star"
  // Existing special cards
  | "hand_swap" | "overflow" | "time_warp"
  | "shockwave" | "curse_tax"
  | "cursed_mirror" | "void_pulse"
  // ✦ NEW CARDS
  | "war_cry" | "chain_stun" | "soul_drain" | "echo_strike";

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
                        description: "Deal 18 damage." },
  weak_jab:           { id: "weak_jab",           name: "WEAK JAB",           icon: "👊", rarity: "common",    color: "#888",    bgColor: "#0d0d0d", glowColor: "#666",
                        description: "8 DMG + immediately draw 1 card." },
  fumble:             { id: "fumble",             name: "FUMBLE",             icon: "🤦", rarity: "common",    color: "#777",    bgColor: "#0f0f0f", glowColor: "#666",
                        description: "12 DMG — 30% chance to stun YOURSELF 1 turn." },

  // ── UNCOMMON ────────────────────────────────────────────────────
  heavy_blow:         { id: "heavy_blow",         name: "HEAVY BLOW",         icon: "💥", rarity: "uncommon",  color: "#ff9f43", bgColor: "#1a0d00", glowColor: "#ff9f43",
                        description: "20 DMG + always stuns foe 1 turn (subject to 2-turn stun cooldown)." },
  heal:               { id: "heal",               name: "MEND WOUNDS",        icon: "♥",  rarity: "uncommon",  color: "#26de81", bgColor: "#001a0a", glowColor: "#26de81",
                        description: "Restore 25 HP." },
  shield:             { id: "shield",             name: "IRON SHIELD",        icon: "🛡", rarity: "uncommon",  color: "#45aaf2", bgColor: "#001020", glowColor: "#45aaf2",
                        description: "Block next hit. If already shielded, heal 10 HP instead." },
  poison_dart:        { id: "poison_dart",        name: "POISON DART",        icon: "☠",  rarity: "uncommon",  color: "#78e08f", bgColor: "#001500", glowColor: "#78e08f",
                        description: "10 DMG + 8 poison damage next turn." },
  taunt:              { id: "taunt",              name: "TAUNT",              icon: "😤", rarity: "uncommon",  color: "#fd9644", bgColor: "#1a0800", glowColor: "#fd9644",
                        description: "8 DMG + attempts to stun foe 1 turn (uses stun cooldown)." },
  mana_burn:          { id: "mana_burn",          name: "MANA BURN",          icon: "🔥", rarity: "uncommon",  color: "#ff5e57", bgColor: "#1a0200", glowColor: "#ff5e57",
                        description: "Destroy foe's random card + 12 DMG." },
  ice_spike:          { id: "ice_spike",          name: "ICE SPIKE",          icon: "🧊", rarity: "uncommon",  color: "#74b9ff", bgColor: "#001015", glowColor: "#74b9ff",
                        description: "15 DMG + stuns foe 1 turn (subject to stun cooldown)." },
  regen:              { id: "regen",              name: "REGEN",              icon: "💚", rarity: "uncommon",  color: "#26de81", bgColor: "#001508", glowColor: "#26de81",
                        description: "Heal 10 HP/turn for 3 turns." },
  war_cry:            { id: "war_cry",            name: "WAR CRY",            icon: "📯", rarity: "uncommon",  color: "#fd9644", bgColor: "#1a0c00", glowColor: "#fd9644",
                        description: "Your next attack deals +15 bonus DMG. Stacks with Mana Surge." },

  // ── RARE ────────────────────────────────────────────────────────
  gamble:             { id: "gamble",             name: "GAMBLE",             icon: "🎲", rarity: "rare",      color: "#f7b731", bgColor: "#1a1200", glowColor: "#f7b731",
                        description: "50/50: deal 35 DMG or take 15 DMG yourself." },
  steal:              { id: "steal",              name: "MIRROR STRIKE",      icon: "🪞", rarity: "rare",      color: "#a55eea", bgColor: "#100018", glowColor: "#a55eea",
                        description: "Copy and instantly play opponent's last used card." },
  divine_shield:      { id: "divine_shield",      name: "DIVINE SHIELD",      icon: "✦",  rarity: "rare",      color: "#fed330", bgColor: "#1a1500", glowColor: "#fed330",
                        description: "Raise a shield + heal 15 HP." },
  double_strike:      { id: "double_strike",      name: "DOUBLE STRIKE",      icon: "⚡", rarity: "rare",      color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24",
                        description: "Strike twice for 15 each (30 total)." },
  vampire_bite:       { id: "vampire_bite",       name: "VAMPIRE BITE",       icon: "🧛", rarity: "rare",      color: "#e056fd", bgColor: "#150010", glowColor: "#e056fd",
                        description: "16 DMG + steal half as HP." },
  earthquake:         { id: "earthquake",         name: "EARTHQUAKE",         icon: "🌍", rarity: "rare",      color: "#f0932b", bgColor: "#1a0a00", glowColor: "#f0932b",
                        description: "28 DMG to foe + 8 self-damage." },
  berserker:          { id: "berserker",          name: "BERSERKER",          icon: "😡", rarity: "rare",      color: "#fc5c65", bgColor: "#1a0005", glowColor: "#fc5c65",
                        description: "8–40 DMG based on missing HP. More dangerous near death." },
  ghost_step:         { id: "ghost_step",         name: "GHOST STEP",         icon: "👻", rarity: "rare",      color: "#dfe6e9", bgColor: "#0a0a10", glowColor: "#b2bec3",
                        description: "Raise a shield + 12 counter damage to foe." },
  reflect:            { id: "reflect",            name: "REFLECT",            icon: "🔮", rarity: "rare",      color: "#a55eea", bgColor: "#0d0018", glowColor: "#a55eea",
                        description: "Next attack against you is reflected back at full damage." },
  lucky_shot:         { id: "lucky_shot",         name: "LUCKY SHOT",         icon: "🍀", rarity: "rare",      color: "#26de81", bgColor: "#001500", glowColor: "#26de81",
                        description: "Random 5–50 DMG. Pure chaos." },
  counter_stance:     { id: "counter_stance",     name: "COUNTER STANCE",     icon: "🔄", rarity: "rare",      color: "#45aaf2", bgColor: "#001020", glowColor: "#45aaf2",
                        description: "Reflect next hit back + deal 12 bonus DMG on top." },
  mana_surge:         { id: "mana_surge",         name: "MANA SURGE",         icon: "✨", rarity: "rare",      color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24",
                        description: "Next card deals DOUBLE damage + 10 flat bonus DMG." },
  pickpocket:         { id: "pickpocket",         name: "PICKPOCKET",         icon: "🤏", rarity: "rare",      color: "#fd9644", bgColor: "#1a0800", glowColor: "#fd9644",
                        description: "Steal a random card from foe's hand into yours." },
  explosion:          { id: "explosion",          name: "EXPLOSION",          icon: "💣", rarity: "rare",      color: "#ff6b6b", bgColor: "#1a0505", glowColor: "#ff6b6b",
                        description: "30 DMG — destroys 1 random card from your own hand too." },
  shockwave:          { id: "shockwave",          name: "SHOCKWAVE",          icon: "🌊", rarity: "rare",      color: "#a55eea", bgColor: "#0d0018", glowColor: "#a55eea",
                        description: "20 DMG. Deals +25 bonus if foe is currently stunned." },
  chain_stun:         { id: "chain_stun",         name: "CHAIN STUN",         icon: "⛓", rarity: "rare",      color: "#45aaf2", bgColor: "#000d18", glowColor: "#45aaf2",
                        description: "10 DMG. If foe is stunned, deal 25 DMG instead + extend stun 1 turn." },

  // ── CURSED ──────────────────────────────────────────────────────
  cursed_blade:       { id: "cursed_blade",       name: "CURSED BLADE",       icon: "🩸", rarity: "cursed",    color: "#fc5c65", bgColor: "#1a0008", glowColor: "#fc5c65",
                        description: "45 DMG — pure corrupted power. No drawbacks." },
  blood_pact:         { id: "blood_pact",         name: "BLOOD PACT",         icon: "💀", rarity: "cursed",    color: "#fc5c65", bgColor: "#1a0000", glowColor: "#fc5c65",
                        description: "Pay 15 HP, deal 40 DMG." },
  soul_drain:         { id: "soul_drain",         name: "SOUL DRAIN",         icon: "🌙", rarity: "cursed",    color: "#fc5c65", bgColor: "#120008", glowColor: "#fc5c65",
                        description: "Drain all foe regen stacks. Deal 8 DMG per stack drained + heal same amount." },

  // ── CORRUPTED ───────────────────────────────────────────────────
  cursed_heal:        { id: "cursed_heal",        name: "CURSED HEAL",        icon: "💜", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Heal 40 HP... foe also heals 20 HP." },
  betrayal:           { id: "betrayal",           name: "BETRAYAL",           icon: "🗡", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "30 DMG, 10 self-damage, give foe a random rare card." },
  plague:             { id: "plague",             name: "PLAGUE",             icon: "🦠", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Both infected: 8 DMG/turn for 3 turns each." },
  sacrifice:          { id: "sacrifice",          name: "SACRIFICE",          icon: "⚰", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Lose 20 HP, immediately draw 4 cards." },
  hand_swap:          { id: "hand_swap",          name: "HAND SWAP",          icon: "🔀", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Swap your entire hand with the foe's." },
  cursed_mirror:      { id: "cursed_mirror",      name: "CURSED MIRROR",      icon: "🪟", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Copy all foe buffs AND debuffs onto yourself." },
  curse_tax:          { id: "curse_tax",          name: "CURSE TAX",          icon: "💸", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff",
                        description: "Destroy foe's random card. Heal HP based on its rarity (5–35 HP)." },

  // ── LEGENDARY ───────────────────────────────────────────────────
  freeze:             { id: "freeze",             name: "FREEZE",             icon: "❄",  rarity: "legendary", color: "#f9ca24", bgColor: "#001520", glowColor: "#74b9ff",
                        description: "30 DMG + block foe's healing for 3 turns." },
  divine_retribution: { id: "divine_retribution", name: "DIVINE RETRIBUTION", icon: "⚖", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24",
                        description: "Strike twice for 25 each (50 total). Second hit stuns foe 1 turn." },
  titans_wrath:       { id: "titans_wrath",       name: "TITAN'S WRATH",      icon: "🔱", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1000", glowColor: "#f9ca24",
                        description: "DMG equals the HP difference between players (min 10)." },
  last_stand:         { id: "last_stand",         name: "LAST STAND",         icon: "🛡", rarity: "legendary", color: "#f9ca24", bgColor: "#1a0005", glowColor: "#fc5c65",
                        description: "≤35 HP: 70 DMG + raise a shield. Else: just 5 DMG." },
  lightning_storm:    { id: "lightning_storm",    name: "LIGHTNING STORM",    icon: "⛈",  rarity: "legendary", color: "#f9ca24", bgColor: "#1a1400", glowColor: "#f9ca24",
                        description: "3 bolts: 15 DMG each (70% hit chance, else 5 backfire)." },
  meteor:             { id: "meteor",             name: "METEOR",             icon: "☄",  rarity: "legendary", color: "#f9ca24", bgColor: "#1a1000", glowColor: "#f9ca24",
                        description: "60 DMG — 25 recoil to self. Bypasses shields." },
  overflow:           { id: "overflow",           name: "OVERFLOW",           icon: "🃏", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24",
                        description: "Draw 5 cards now, discard 5 random cards next turn." },
  echo_strike:        { id: "echo_strike",        name: "ECHO STRIKE",        icon: "🔁", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1200", glowColor: "#f9ca24",
                        description: "Repeat the raw damage of your last played card (no side effects)." },

  // ── MYTHIC ──────────────────────────────────────────────────────
  soul_swap:          { id: "soul_swap",          name: "SOUL SWAP",          icon: "👁", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Swap HP totals with opponent 😈" },
  armageddon:         { id: "armageddon",         name: "ARMAGEDDON",         icon: "💥", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "BOTH take 50 DMG. Bypasses all shields and reflects." },
  void_rift:          { id: "void_rift",          name: "VOID RIFT",          icon: "🌀", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Destroy all hands, both players redraw 3 fresh cards." },
  judgement:          { id: "judgement",          name: "JUDGEMENT",          icon: "⚖", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Instant win if foe ≤25 HP. Otherwise deals 5 DMG." },
  time_warp:          { id: "time_warp",          name: "TIME WARP",          icon: "⏳", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8",
                        description: "Take 2 extra turns now, then skip 2 turns later." },

  // ── VOID ────────────────────────────────────────────────────────
  singularity:        { id: "singularity",        name: "SINGULARITY",        icon: "🕳", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "Equalize both HP to the average. Deadly when you're winning." },
  dark_matter:        { id: "dark_matter",        name: "DARK MATTER",        icon: "🫧", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "Foe's next 3 damaging cards deal 0 damage." },
  event_horizon:      { id: "event_horizon",      name: "EVENT HORIZON",      icon: "🌑", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "Foe's next card damage collapses inward — they hit themselves." },
  neutron_star:       { id: "neutron_star",       name: "NEUTRON STAR",       icon: "⭐", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "25 DMG now + 15 DMG each of foe's next 3 turns." },
  void_pulse:         { id: "void_pulse",         name: "VOID PULSE",         icon: "🔵", rarity: "void",      color: "#00ffcc", bgColor: "#001a15", glowColor: "#00ffcc",
                        description: "8×(foe's active debuff count) DMG, minimum 10. Reward stacking debuffs." },
};