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
  | "soul_swap" | "armageddon" | "void_rift" | "judgement";

export type Rarity = "common" | "uncommon" | "rare" | "cursed" | "corrupted" | "legendary" | "mythic";

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
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common:    "COMMON",
  uncommon:  "UNCOMMON",
  rare:      "◆ RARE",
  cursed:    "☠ CURSED",
  corrupted: "☣ CORRUPTED",
  legendary: "★ LEGENDARY",
  mythic:    "✦ MYTHIC ✦",
};

export const CARD_DEFS: Record<CardId, CardDef> = {
  // ── COMMON ──────────────────────────────────────────────────────
  slash:           { id: "slash",           name: "SLASH",            icon: "⚔",  rarity: "common",    color: "#ff6b6b", bgColor: "#1a0505", glowColor: "#ff6b6b", description: "Deal 15 damage" },
  weak_jab:        { id: "weak_jab",        name: "WEAK JAB",         icon: "👊", rarity: "common",    color: "#666",    bgColor: "#0d0d0d", glowColor: "#555",    description: "Only 5 DMG... sorry" },
  fumble:          { id: "fumble",          name: "FUMBLE",           icon: "🤦", rarity: "common",    color: "#777",    bgColor: "#0f0f0f", glowColor: "#666",    description: "5 DMG + lose a random card" },

  // ── UNCOMMON ────────────────────────────────────────────────────
  heavy_blow:      { id: "heavy_blow",      name: "HEAVY BLOW",       icon: "💥", rarity: "uncommon",  color: "#ff9f43", bgColor: "#1a0d00", glowColor: "#ff9f43", description: "22 DMG — skip next turn" },
  heal:            { id: "heal",            name: "MEND WOUNDS",      icon: "♥",  rarity: "uncommon",  color: "#26de81", bgColor: "#001a0a", glowColor: "#26de81", description: "Restore 20 HP" },
  shield:          { id: "shield",          name: "IRON SHIELD",      icon: "🛡", rarity: "uncommon",  color: "#45aaf2", bgColor: "#001020", glowColor: "#45aaf2", description: "Block next hit" },
  poison_dart:     { id: "poison_dart",     name: "POISON DART",      icon: "☠",  rarity: "uncommon",  color: "#78e08f", bgColor: "#001500", glowColor: "#78e08f", description: "8 DMG + 6 poison next turn" },
  taunt:           { id: "taunt",           name: "TAUNT",            icon: "😤", rarity: "uncommon",  color: "#fd9644", bgColor: "#1a0800", glowColor: "#fd9644", description: "5 DMG + foe draws 1 fewer" },
  mana_burn:       { id: "mana_burn",       name: "MANA BURN",        icon: "🔥", rarity: "uncommon",  color: "#ff5e57", bgColor: "#1a0200", glowColor: "#ff5e57", description: "Burn foe's card + 8 DMG" },
  ice_spike:       { id: "ice_spike",       name: "ICE SPIKE",        icon: "🧊", rarity: "uncommon",  color: "#74b9ff", bgColor: "#001015", glowColor: "#74b9ff", description: "12 DMG + stun foe 1 turn" },
  regen:           { id: "regen",           name: "REGEN",            icon: "💚", rarity: "uncommon",  color: "#26de81", bgColor: "#001508", glowColor: "#26de81", description: "Heal 9 HP/turn for 3 turns" },

  // ── RARE ────────────────────────────────────────────────────────
  gamble:          { id: "gamble",          name: "GAMBLE",           icon: "🎲", rarity: "rare",      color: "#f7b731", bgColor: "#1a1200", glowColor: "#f7b731", description: "50/50: 30 DMG or −15 HP" },
  steal:           { id: "steal",           name: "MIRROR STRIKE",    icon: "🪞", rarity: "rare",      color: "#a55eea", bgColor: "#100018", glowColor: "#a55eea", description: "Copy opponent's last card" },
  divine_shield:   { id: "divine_shield",   name: "DIVINE SHIELD",    icon: "✦",  rarity: "rare",      color: "#fed330", bgColor: "#1a1500", glowColor: "#fed330", description: "Block + heal 10 HP" },
  double_strike:   { id: "double_strike",   name: "DOUBLE STRIKE",    icon: "⚡", rarity: "rare",      color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24", description: "Strike twice for 12 each" },
  vampire_bite:    { id: "vampire_bite",    name: "VAMPIRE BITE",     icon: "🧛", rarity: "rare",      color: "#e056fd", bgColor: "#150010", glowColor: "#e056fd", description: "14 DMG + steal half as HP" },
  earthquake:      { id: "earthquake",      name: "EARTHQUAKE",       icon: "🌍", rarity: "rare",      color: "#f0932b", bgColor: "#1a0a00", glowColor: "#f0932b", description: "20 to foe + 5 self-damage" },
  berserker:       { id: "berserker",       name: "BERSERKER",        icon: "😡", rarity: "rare",      color: "#fc5c65", bgColor: "#1a0005", glowColor: "#fc5c65", description: "10–45 DMG based on missing HP" },
  ghost_step:      { id: "ghost_step",      name: "GHOST STEP",       icon: "👻", rarity: "rare",      color: "#dfe6e9", bgColor: "#0a0a10", glowColor: "#b2bec3", description: "Shield + 8 counter damage" },
  reflect:         { id: "reflect",         name: "REFLECT",          icon: "🔮", rarity: "rare",      color: "#a55eea", bgColor: "#0d0018", glowColor: "#a55eea", description: "Bounce next attack back" },
  lucky_shot:      { id: "lucky_shot",      name: "LUCKY SHOT",       icon: "🍀", rarity: "rare",      color: "#26de81", bgColor: "#001500", glowColor: "#26de81", description: "Random 1–40 DMG. Pure chaos" },
  counter_stance:  { id: "counter_stance",  name: "COUNTER STANCE",   icon: "🔄", rarity: "rare",      color: "#45aaf2", bgColor: "#001020", glowColor: "#45aaf2", description: "Reflect next hit + 5 bonus DMG" },
  mana_surge:      { id: "mana_surge",      name: "MANA SURGE",       icon: "✨", rarity: "rare",      color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24", description: "Next card deals DOUBLE damage" },
  pickpocket:      { id: "pickpocket",      name: "PICKPOCKET",       icon: "🤏", rarity: "rare",      color: "#fd9644", bgColor: "#1a0800", glowColor: "#fd9644", description: "Steal a card from foe's hand" },
  explosion:       { id: "explosion",       name: "EXPLOSION",        icon: "💣", rarity: "rare",      color: "#ff6b6b", bgColor: "#1a0505", glowColor: "#ff6b6b", description: "25 DMG — destroys 1 own card too" },

  // ── CURSED ──────────────────────────────────────────────────────
  cursed_blade:    { id: "cursed_blade",    name: "CURSED BLADE",     icon: "🩸", rarity: "cursed",    color: "#fc5c65", bgColor: "#1a0008", glowColor: "#fc5c65", description: "40 DMG — stunned next turn" },
  blood_pact:      { id: "blood_pact",      name: "BLOOD PACT",       icon: "💀", rarity: "cursed",    color: "#fc5c65", bgColor: "#1a0000", glowColor: "#fc5c65", description: "Pay 15 HP, deal 35 DMG" },

  // ── CORRUPTED ───────────────────────────────────────────────────
  cursed_heal:     { id: "cursed_heal",     name: "CURSED HEAL",      icon: "💜", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff", description: "Heal 35... foe heals 20 too" },
  betrayal:        { id: "betrayal",        name: "BETRAYAL",         icon: "🗡", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff", description: "25 DMG, 10 self, give foe a rare" },
  plague:          { id: "plague",          name: "PLAGUE",           icon: "🦠", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff", description: "Both infected: 8 DMG/turn, 2 turns" },
  sacrifice:       { id: "sacrifice",       name: "SACRIFICE",        icon: "⚰", rarity: "corrupted", color: "#c44dff", bgColor: "#120018", glowColor: "#c44dff", description: "Lose 30 HP, draw 4 cards instantly" },

  // ── LEGENDARY ───────────────────────────────────────────────────
  freeze:          { id: "freeze",          name: "FREEZE",           icon: "❄",  rarity: "legendary", color: "#f9ca24", bgColor: "#001520", glowColor: "#74b9ff", description: "Freeze foe for 2 full turns" },
  divine_retribution: { id: "divine_retribution", name: "DIVINE RETRIBUTION", icon: "⚖", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1500", glowColor: "#f9ca24", description: "Stun 2 turns + 15+(stunsSuffered×10) DMG" },
  titans_wrath:    { id: "titans_wrath",    name: "TITAN'S WRATH",    icon: "🔱", rarity: "legendary", color: "#f9ca24", bgColor: "#1a1000", glowColor: "#f9ca24", description: "DMG = HP difference between players" },
  last_stand:      { id: "last_stand",      name: "LAST STAND",       icon: "🛡", rarity: "legendary", color: "#f9ca24", bgColor: "#1a0005", glowColor: "#fc5c65", description: "≤30 HP: 60 DMG. Else: just 5 DMG" },
  lightning_storm: { id: "lightning_storm", name: "LIGHTNING STORM",  icon: "⛈",  rarity: "legendary", color: "#f9ca24", bgColor: "#1a1400", glowColor: "#f9ca24", description: "3 bolts: 10 DMG each (may backfire)" },
  meteor:          { id: "meteor",          name: "METEOR",           icon: "☄",  rarity: "legendary", color: "#f9ca24", bgColor: "#1a1000", glowColor: "#f9ca24", description: "50 DMG — stunned after" },

  // ── MYTHIC ──────────────────────────────────────────────────────
  soul_swap:       { id: "soul_swap",       name: "SOUL SWAP",        icon: "👁", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8", description: "Swap HP totals with opponent 😈" },
  armageddon:      { id: "armageddon",      name: "ARMAGEDDON",       icon: "💥", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8", description: "BOTH take 40 DMG. No shields." },
  void_rift:       { id: "void_rift",       name: "VOID RIFT",        icon: "🌀", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8", description: "Destroy all hands, both redraw 3" },
  judgement:       { id: "judgement",       name: "JUDGEMENT",        icon: "⚖", rarity: "mythic",    color: "#ff6fd8", bgColor: "#1a0015", glowColor: "#ff6fd8", description: "Instant win if foe ≤20 HP. Else 5 DMG." },
};