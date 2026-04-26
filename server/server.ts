import { Server } from "socket.io";
import { createServer } from "http";
import { createClient } from "@libsql/client";

const httpServer = createServer((req, res) => { res.writeHead(200); res.end("OK"); });
const io = new Server(httpServer, { cors: { origin: "*" } });

// ── Turso DB ──────────────────────────────────────────────────────
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      session_token TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0
    )
  `);
}

async function recordWin(token: string, name: string) {
  await db.execute({
    sql: `INSERT INTO leaderboard (session_token, name, wins, losses) VALUES (?, ?, 1, 0)
          ON CONFLICT(session_token) DO UPDATE SET wins = wins + 1, name = excluded.name`,
    args: [token, name],
  });
}

async function recordLoss(token: string, name: string) {
  await db.execute({
    sql: `INSERT INTO leaderboard (session_token, name, wins, losses) VALUES (?, ?, 0, 1)
          ON CONFLICT(session_token) DO UPDATE SET losses = losses + 1, name = excluded.name`,
    args: [token, name],
  });
}

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await db.execute(
    `SELECT session_token as sessionToken, name, wins, losses FROM leaderboard ORDER BY wins DESC, losses ASC LIMIT 20`
  );
  return res.rows as unknown as LeaderboardEntry[];
}

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
  | "singularity" | "dark_matter" | "event_horizon" | "neutron_star"
  | "hand_swap" | "overflow" | "time_warp"
  | "shockwave" | "curse_tax"
  | "cursed_mirror" | "void_pulse"
  // ✦ NEW
  | "war_cry" | "chain_stun" | "soul_drain" | "echo_strike";

export type Rarity = "common" | "uncommon" | "rare" | "cursed" | "corrupted" | "legendary" | "mythic" | "void";

export const CARD_NAMES: Record<CardId, string> = {
  slash: "Slash", weak_jab: "Weak Jab", fumble: "Fumble",
  heavy_blow: "Heavy Blow", heal: "Mend Wounds", shield: "Iron Shield",
  poison_dart: "Poison Dart", taunt: "Taunt", mana_burn: "Mana Burn",
  ice_spike: "Ice Spike", regen: "Regen", war_cry: "War Cry",
  gamble: "Gamble", steal: "Mirror Strike", divine_shield: "Divine Shield",
  double_strike: "Double Strike", vampire_bite: "Vampire Bite", earthquake: "Earthquake",
  berserker: "Berserker", ghost_step: "Ghost Step", reflect: "Reflect",
  lucky_shot: "Lucky Shot", counter_stance: "Counter Stance", mana_surge: "Mana Surge",
  pickpocket: "Pickpocket", explosion: "Explosion", chain_stun: "Chain Stun",
  cursed_blade: "Cursed Blade", blood_pact: "Blood Pact", soul_drain: "Soul Drain",
  cursed_heal: "Cursed Heal", betrayal: "Betrayal", plague: "Plague", sacrifice: "Sacrifice",
  hand_swap: "Hand Swap", cursed_mirror: "Cursed Mirror", curse_tax: "Curse Tax",
  freeze: "Freeze", divine_retribution: "Divine Retribution", titans_wrath: "Titan's Wrath",
  last_stand: "Last Stand", lightning_storm: "Lightning Storm", meteor: "Meteor",
  overflow: "Overflow", echo_strike: "Echo Strike",
  soul_swap: "Soul Swap", armageddon: "Armageddon", void_rift: "Void Rift",
  judgement: "Judgement", time_warp: "Time Warp",
  singularity: "Singularity", dark_matter: "Dark Matter", event_horizon: "Event Horizon",
  neutron_star: "Neutron Star", void_pulse: "Void Pulse",
  shockwave: "Shockwave",
};

// Rarity ordering for curse_tax heal scaling
const RARITY_HEAL: Record<string, number> = {
  common: 5, uncommon: 10, rare: 15, cursed: 20, corrupted: 22, legendary: 28, mythic: 32, void: 35,
};
const CARD_RARITIES: Record<CardId, string> = {
  slash: "common", weak_jab: "common", fumble: "common",
  heavy_blow: "uncommon", heal: "uncommon", shield: "uncommon", poison_dart: "uncommon",
  taunt: "uncommon", mana_burn: "uncommon", ice_spike: "uncommon", regen: "uncommon", war_cry: "uncommon",
  gamble: "rare", steal: "rare", divine_shield: "rare", double_strike: "rare",
  vampire_bite: "rare", earthquake: "rare", berserker: "rare", ghost_step: "rare",
  reflect: "rare", lucky_shot: "rare", counter_stance: "rare", mana_surge: "rare",
  pickpocket: "rare", explosion: "rare", shockwave: "rare", chain_stun: "rare",
  cursed_blade: "cursed", blood_pact: "cursed", soul_drain: "cursed",
  cursed_heal: "corrupted", betrayal: "corrupted", plague: "corrupted", sacrifice: "corrupted",
  hand_swap: "corrupted", cursed_mirror: "corrupted", curse_tax: "corrupted",
  freeze: "legendary", divine_retribution: "legendary", titans_wrath: "legendary",
  last_stand: "legendary", lightning_storm: "legendary", meteor: "legendary",
  overflow: "legendary", echo_strike: "legendary",
  soul_swap: "mythic", armageddon: "mythic", void_rift: "mythic", judgement: "mythic", time_warp: "mythic",
  singularity: "void", dark_matter: "void", event_horizon: "void", neutron_star: "void", void_pulse: "void",
};

// ── Draw pool (weighted) ──────────────────────────────────────────
const DRAW_POOL: CardId[] = [
  // Common
  "slash","slash","slash","slash","slash",
  "weak_jab","weak_jab","weak_jab",
  "fumble","fumble",
  // Uncommon
  "heavy_blow","heavy_blow","heavy_blow",
  "heal","heal","heal",
  "shield","shield","shield",
  "poison_dart","poison_dart",
  "taunt","taunt",
  "mana_burn","mana_burn",
  "ice_spike","ice_spike",
  "regen","regen",
  "war_cry","war_cry",
  // Rare
  "gamble","gamble",
  "double_strike","double_strike",
  "steal",
  "divine_shield",
  "vampire_bite","vampire_bite",
  "earthquake",
  "berserker",
  "ghost_step",
  "reflect",
  "lucky_shot","lucky_shot",
  "counter_stance",
  "mana_surge",
  "pickpocket",
  "explosion",
  "shockwave",
  "chain_stun",
  // Cursed
  "cursed_blade",
  "blood_pact",
  "soul_drain",
  // Corrupted
  "cursed_heal",
  "betrayal",
  "plague",
  "sacrifice",
  "hand_swap",
  "cursed_mirror",
  "curse_tax",
  // Legendary
  "freeze",
  "divine_retribution",
  "titans_wrath",
  "last_stand",
  "lightning_storm",
  "meteor",
  "overflow",
  "echo_strike",
  // Mythic
  "soul_swap",
  "armageddon",
  "void_rift",
  "judgement",
  "time_warp",
  // Void
  "singularity",
  "dark_matter",
  "event_horizon",
  "neutron_star",
  "void_pulse",
];

function drawOne(exclude: CardId[] = []): CardId {
  const pool = DRAW_POOL.filter(c => !exclude.includes(c));
  return pool[Math.floor(Math.random() * pool.length)];
}

function drawHand(count = 5): CardId[] {
  const hand: CardId[] = [];
  for (let i = 0; i < count; i++) hand.push(drawOne(hand));
  return hand;
}

// ── Types ─────────────────────────────────────────────────────────
interface Player {
  socketId: string;
  sessionToken: string;
  name: string;
  hp: number;
  maxHp: number;
  shield: boolean;
  reflectActive: boolean;
  counterStanceActive: boolean;
  manaSurgeActive: boolean;
  warCryBonus: number;        // flat DMG bonus from War Cry
  poisoned: number;
  regenStacks: number;
  plagueStacks: number;
  skipTurns: number;
  taunted: boolean;
  extraTurn: boolean;
  extraTurnDebt: number;
  stunsSuffered: number;
  stunCooldown: number;
  darkMatterStacks: number;
  eventHorizonActive: boolean;
  neutronStarTicks: number;
  healBlocked: number;
  overflowDiscard: number;
  overflowCount: number;
  lastCard: CardId | null;
  lastCardDmg: number;        // raw DMG of last card for echo_strike
  hand: CardId[];
  rematchReady: boolean;
  connected: boolean;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  turn: string | null;
  log: string[];
  gameOver: boolean;
  winnerId: string | null;
  isDraw: boolean;
  lastNarration: string;
}

interface LeaderboardEntry {
  sessionToken: string;
  name: string;
  wins: number;
  losses: number;
}

// ── Rooms ─────────────────────────────────────────────────────────
const rooms: Map<string, Room> = new Map();

function getRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId, players: {}, turn: null, log: [],
      gameOver: false, winnerId: null, isDraw: false, lastNarration: "",
    });
  }
  return rooms.get(roomId)!;
}

function addLog(room: Room, msg: string) {
  room.log.unshift(msg);
  if (room.log.length > 30) room.log.pop();
}

function broadcast(room: Room) {
  const tokens = Object.keys(room.players);
  tokens.forEach(myToken => {
    const p = room.players[myToken];
    if (!p.socketId) return;
    const socket = io.sockets.sockets.get(p.socketId);
    if (!socket) return;
    const strippedPlayers: Record<string, any> = {};
    tokens.forEach(t => {
      const pl = room.players[t];
      strippedPlayers[t] = { ...pl, hand: t === myToken ? pl.hand : pl.hand.map(() => "???") };
    });
    socket.emit("stateUpdate", {
      players: strippedPlayers, myToken,
      turn: room.turn, log: room.log,
      gameOver: room.gameOver, winnerId: room.winnerId,
      isDraw: room.isDraw,
      roomId: room.id, lastNarration: room.lastNarration,
    });
  });
}

// ── Game helpers ──────────────────────────────────────────────────
function getOpponentToken(room: Room, token: string): string | null {
  return Object.keys(room.players).find(x => x !== token) ?? null;
}

function replenishCard(player: Player) {
  player.hand.push(drawOne(player.hand as CardId[]));
}

/**
 * Core damage function.
 * Returns: actual DMG dealt (>0), 0 if absorbed/blocked, -1 if reflected/countered, -2 if event horizon self-hit.
 */
function dealDamage(
  room: Room,
  actor: Player,
  target: Player,
  dmg: number,
  source: string,
  bypassShield = false
): number {
  // Event Horizon — damage turns back on the attacker
  if (target.eventHorizonActive) {
    target.eventHorizonActive = false;
    actor.hp = Math.max(0, actor.hp - dmg);
    addLog(room, `🌑 EVENT HORIZON! ${source} collapses inward — ${dmg} damage hits ${actor.name} instead!`);
    return -2;
  }

  // Dark Matter — absorbs damage
  if (target.darkMatterStacks > 0) {
    target.darkMatterStacks--;
    addLog(room, `🫧 DARK MATTER absorbs ${source}! (${target.darkMatterStacks} stack(s) left)`);
    return 0;
  }

  // Counter Stance — reflects + bonus
  if (target.counterStanceActive && !bypassShield) {
    target.counterStanceActive = false;
    actor.hp = Math.max(0, actor.hp - dmg);
    target.hp = Math.max(0, target.hp - 12);
    addLog(room, `🔄 ${target.name}'s COUNTER STANCE reflects ${dmg} damage + deals 12 bonus to them!`);
    return -1;
  }

  // Shield
  if (target.shield && !bypassShield) {
    target.shield = false;
    addLog(room, `🛡 ${target.name}'s shield absorbed ${source}!`);
    return 0;
  }

  // Reflect
  if (target.reflectActive && !bypassShield) {
    target.reflectActive = false;
    actor.hp = Math.max(0, actor.hp - dmg);
    addLog(room, `🔮 ${target.name} REFLECTED ${dmg} damage back at ${actor.name}!`);
    return -1;
  }

  // Mana Surge — double + flat bonus
  let finalDmg = dmg;
  if (actor.manaSurgeActive) {
    actor.manaSurgeActive = false;
    finalDmg = dmg * 2 + 10;
    addLog(room, `✨ MANA SURGE: ${dmg} → ${finalDmg} damage!`);
  }

  // War Cry bonus
  if (actor.warCryBonus > 0) {
    finalDmg += actor.warCryBonus;
    addLog(room, `📯 WAR CRY adds ${actor.warCryBonus} bonus damage!`);
    actor.warCryBonus = 0;
  }

  target.hp = Math.max(0, target.hp - finalDmg);
  return finalDmg;
}

function applyHeal(room: Room, player: Player, amount: number): number {
  if (player.healBlocked > 0) {
    addLog(room, `❄ ${player.name}'s healing is FROZEN — ${amount} HP blocked!`);
    return 0;
  }
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + amount);
  return player.hp - before;
}

function applyStun(room: Room, actor: Player, target: Player, turns: number): boolean {
  if (actor.stunCooldown > 0) {
    addLog(room, `⚠ ${actor.name}'s stun is on cooldown (${actor.stunCooldown} turn(s))! ${target.name} resists.`);
    return false;
  }
  target.skipTurns = Math.max(target.skipTurns, turns);
  actor.stunCooldown = 2;
  return true;
}

/**
 * ── DRAW CONDITION FIX ────────────────────────────────────────────
 * If BOTH players are at 0 HP simultaneously it's a draw.
 * If only one is at 0, the other wins.
 * Returns true if the game ended.
 */
function checkDeath(room: Room, actorToken: string, targetToken: string): boolean {
  const actor  = room.players[actorToken];
  const target = room.players[targetToken];

  const actorDead  = actor  && actor.hp  <= 0;
  const targetDead = target && target.hp <= 0;

  if (actorDead && targetDead) {
    // DRAW
    room.gameOver = true;
    room.winnerId = null;
    room.isDraw   = true;
    addLog(room, `💀 BOTH WARRIORS FALL — IT'S A DRAW!`);
    return true;
  }
  if (targetDead) {
    endGame(room, actorToken);
    return true;
  }
  if (actorDead) {
    endGame(room, targetToken);
    return true;
  }
  return false;
}

function endGame(room: Room, winnerToken: string) {
  room.gameOver = true;
  room.winnerId = winnerToken;
  room.isDraw   = false;
  const winner = room.players[winnerToken];
  const loserToken = getOpponentToken(room, winnerToken);
  const loser = loserToken ? room.players[loserToken] : null;
  addLog(room, `★ ${winner.name} wins the battle!`);
  recordWin(winnerToken, winner.name).catch(console.error);
  if (loser) recordLoss(loserToken!, loser.name).catch(console.error);
}

function startTurn(room: Room, token: string) {
  const player = room.players[token];
  if (!player) return;

  if (player.extraTurnDebt > 0 && player.skipTurns === 0) {
    player.skipTurns = player.extraTurnDebt;
    player.extraTurnDebt = 0;
    addLog(room, `⏳ ${player.name}'s TIME WARP debt kicks in — skipping ${player.skipTurns} turn(s)!`);
  }

  if (player.skipTurns > 0) {
    player.skipTurns--;
    player.stunsSuffered++;
    addLog(room, `😵 ${player.name} is stunned — ${player.skipTurns > 0 ? player.skipTurns + " turn(s) left!" : "last stun!"}`);
    const opp = getOpponentToken(room, token);
    if (opp) startTurn(room, opp);
    return;
  }

  if (player.stunCooldown > 0) {
    player.stunCooldown--;
    if (player.stunCooldown === 0) addLog(room, `⚡ ${player.name}'s stun cooldown expired — stun cards ready!`);
  }

  if (player.healBlocked > 0) {
    player.healBlocked--;
    if (player.healBlocked === 0) addLog(room, `🌡 ${player.name}'s heal block has worn off!`);
  }

  if (player.overflowDiscard > 0) {
    player.overflowDiscard--;
    if (player.overflowDiscard === 0 && player.overflowCount > 0) {
      const discardCount = Math.min(player.overflowCount, player.hand.length);
      const discarded: string[] = [];
      for (let i = 0; i < discardCount; i++) {
        const ridx = Math.floor(Math.random() * player.hand.length);
        discarded.push(CARD_NAMES[player.hand.splice(ridx, 1)[0] as CardId]);
      }
      player.overflowCount = 0;
      addLog(room, `🃏 OVERFLOW DEBT: ${player.name} discards ${discarded.join(", ")}!`);
    }
  }

  if (player.neutronStarTicks > 0) {
    player.hp = Math.max(0, player.hp - 15);
    player.neutronStarTicks--;
    addLog(room, `⭐ NEUTRON STAR deals 15 delayed damage to ${player.name}! (${player.neutronStarTicks} ticks left)`);
    const oppToken = getOpponentToken(room, token);
    if (player.hp <= 0 && oppToken) { endGame(room, oppToken); return; }
  }

  if (player.regenStacks > 0) {
    const regen = player.regenStacks * 10;
    const healed = applyHeal(room, player, regen);
    if (healed > 0) addLog(room, `💚 ${player.name} regenerates ${healed} HP! (${player.regenStacks} stack(s))`);
    player.regenStacks = Math.max(0, player.regenStacks - 1);
  }

  if (player.poisoned > 0) {
    player.hp = Math.max(0, player.hp - player.poisoned);
    addLog(room, `☠ ${player.name} takes ${player.poisoned} poison damage!`);
    player.poisoned = 0;
    const oppToken = getOpponentToken(room, token);
    if (player.hp <= 0 && oppToken) { endGame(room, oppToken); return; }
  }

  if (player.plagueStacks > 0) {
    player.hp = Math.max(0, player.hp - 8);
    player.plagueStacks--;
    addLog(room, `🦠 ${player.name} suffers plague! 8 damage (${player.plagueStacks} turns left)`);
    const oppToken = getOpponentToken(room, token);
    if (player.hp <= 0 && oppToken) { endGame(room, oppToken); return; }
  }

  room.turn = token;
}

function resolveCard(room: Room, actorToken: string, cardId: CardId) {
  const actor = room.players[actorToken];
  const targetToken = getOpponentToken(room, actorToken);
  if (!targetToken) return;
  const target = room.players[targetToken];
  actor.lastCard = cardId;

  const idx = actor.hand.indexOf(cardId);
  if (idx !== -1) actor.hand.splice(idx, 1);

  let narration = "";

  switch (cardId) {
    // ── COMMON ──────────────────────────────────────────────────
    case "slash": {
      const d = dealDamage(room, actor, target, 18, "slash");
      if (d > 0) {
        actor.lastCardDmg = d;
        addLog(room, `⚔ ${actor.name} slashed ${target.name} for ${d} damage!`);
        narration = `${actor.name} draws their blade and slashes ${target.name} for ${d} damage!`;
      }
      break;
    }
    case "weak_jab": {
      const d = dealDamage(room, actor, target, 8, "weak jab");
      const drawn = drawOne(actor.hand as CardId[]);
      actor.hand.push(drawn);
      if (d > 0) {
        actor.lastCardDmg = d;
        addLog(room, `👊 ${actor.name} weak jab — ${d} DMG + drew ${CARD_NAMES[drawn]}!`);
        narration = `${actor.name} throws a quick jab for ${d} damage and draws ${CARD_NAMES[drawn]}!`;
      } else {
        addLog(room, `👊 Weak Jab blocked — but drew ${CARD_NAMES[drawn]}!`);
        narration = `${actor.name}'s jab is blocked, but draws ${CARD_NAMES[drawn]}!`;
      }
      break;
    }
    case "fumble": {
      const d = dealDamage(room, actor, target, 12, "fumble");
      if (d > 0) actor.lastCardDmg = d;
      if (Math.random() < 0.30) {
        actor.skipTurns = Math.max(actor.skipTurns, 1);
        actor.stunsSuffered++;
        addLog(room, `🤦 ${actor.name} FUMBLED! ${d > 0 ? d : 0} damage... and stunned themselves!`);
        narration = `${actor.name} trips over themselves! ${d > 0 ? d : 0} damage but they stun THEMSELVES!`;
      } else {
        addLog(room, `🤦 ${actor.name} fumbled awkwardly but got ${d > 0 ? d : 0} damage through.`);
        narration = `${actor.name} fumbles the strike but lands ${d > 0 ? d : 0} damage. Lucky this time.`;
      }
      break;
    }

    // ── UNCOMMON ────────────────────────────────────────────────
    case "heavy_blow": {
      const d = dealDamage(room, actor, target, 20, "heavy blow");
      if (d > 0) {
        actor.lastCardDmg = d;
        const stunned = applyStun(room, actor, target, 1);
        if (stunned) {
          addLog(room, `💥 HEAVY BLOW — ${d} damage + STUN!`);
          narration = `${actor.name} winds up and SMASHES ${target.name} for ${d} damage! The crushing blow STUNS them!`;
        } else {
          addLog(room, `💥 HEAVY BLOW — ${d} damage (stun on cooldown)`);
          narration = `${actor.name} smashes for ${d} damage! Stun is on cooldown — ${target.name} stays standing.`;
        }
      }
      break;
    }
    case "heal": {
      const healed = applyHeal(room, actor, 25);
      if (healed > 0) {
        addLog(room, `♥ ${actor.name} healed ${healed} HP!`);
        narration = `${actor.name} mends their wounds, recovering ${healed} HP!`;
      } else {
        addLog(room, `♥ ${actor.name} tried to heal — FROZEN!`);
        narration = `${actor.name} reaches for healing... but it's FROZEN solid. Nothing restored.`;
      }
      break;
    }
    case "shield": {
      if (actor.shield) {
        // Already shielded — heal instead
        const healed = applyHeal(room, actor, 10);
        addLog(room, `🛡 ${actor.name} already shielded — converted to ${healed} HP heal!`);
        narration = `${actor.name} raises a second shield... but they're already protected! Converts to ${healed} HP instead.`;
      } else {
        actor.shield = true;
        addLog(room, `🛡 ${actor.name} raised a shield!`);
        narration = `${actor.name} conjures an iron barrier — the next attack will be nullified!`;
      }
      break;
    }
    case "poison_dart": {
      const d = dealDamage(room, actor, target, 10, "poison dart");
      if (d > 0) {
        actor.lastCardDmg = d;
        target.poisoned = 8;
        addLog(room, `☠ ${actor.name} poisoned ${target.name}! 10 + 8 poison next turn.`);
        narration = `${actor.name} fires a toxic dart! ${target.name} takes ${d} damage and is POISONED for 8 next turn!`;
      }
      break;
    }
    case "taunt": {
      const d = dealDamage(room, actor, target, 8, "taunt");
      if (d > 0) actor.lastCardDmg = d;
      const stunned = applyStun(room, actor, target, 1);
      if (stunned) {
        addLog(room, `😤 ${actor.name} taunts ${target.name}! ${d > 0 ? d : 0} DMG + STUNNED!`);
        narration = `${actor.name} gets in ${target.name}'s face — ${d > 0 ? d : 0} damage and the foe is STUNNED with rage!`;
      } else {
        addLog(room, `😤 ${actor.name} taunts! ${d > 0 ? d : 0} DMG (stun on cooldown)`);
        narration = `${actor.name} hurls insults for ${d > 0 ? d : 0} damage, but the stun is on cooldown!`;
      }
      break;
    }
    case "mana_burn": {
      if (target.hand.length > 0) {
        const ridx = Math.floor(Math.random() * target.hand.length);
        const burned = target.hand.splice(ridx, 1)[0] as CardId;
        addLog(room, `🔥 ${actor.name} burned ${target.name}'s ${CARD_NAMES[burned]}!`);
        const d = dealDamage(room, actor, target, 12, "mana burn");
        if (d > 0) actor.lastCardDmg = d;
        narration = `${actor.name} ignites ${target.name}'s ${CARD_NAMES[burned]}! Destroyed + ${d > 0 ? d : 0} damage.`;
      } else {
        addLog(room, `🔥 Mana Burn — nothing to burn!`);
        narration = `${actor.name} tries to burn a card... but ${target.name} has nothing!`;
      }
      break;
    }
    case "ice_spike": {
      const d = dealDamage(room, actor, target, 15, "ice spike");
      if (d > 0) {
        actor.lastCardDmg = d;
        const stunned = applyStun(room, actor, target, 1);
        if (stunned) {
          addLog(room, `🧊 ICE SPIKE — ${d} DMG + stunned 1 turn!`);
          narration = `${actor.name} launches a massive ice spike! ${target.name} takes ${d} damage and is FROZEN solid!`;
        } else {
          addLog(room, `🧊 ICE SPIKE — ${d} DMG (stun on cooldown!)`);
          narration = `${actor.name} launches an ice spike for ${d} damage, but the stun is on cooldown!`;
        }
      } else if (d === 0) {
        addLog(room, `🧊 Ice Spike blocked by shield!`);
        narration = `${actor.name}'s ice spike shatters against ${target.name}'s shield!`;
      }
      break;
    }
    case "regen": {
      actor.regenStacks = Math.min(actor.regenStacks + 3, 6);
      addLog(room, `💚 REGEN activated — ${actor.regenStacks * 10} HP/turn!`);
      narration = `${actor.name} activates REGEN — recovering ${actor.regenStacks * 10} HP per turn for 3 turns!`;
      break;
    }
    case "war_cry": {
      actor.warCryBonus = 15;
      addLog(room, `📯 WAR CRY — ${actor.name}'s next attack deals +15 bonus DMG!`);
      narration = `${actor.name} lets out a WAR CRY! Their next strike will hit 15 DMG harder — and it stacks with Mana Surge!`;
      break;
    }

    // ── RARE ────────────────────────────────────────────────────
    case "gamble": {
      if (Math.random() < 0.5) {
        const d = dealDamage(room, actor, target, 35, "gamble");
        if (d > 0) {
          actor.lastCardDmg = d;
          addLog(room, `🎲 GAMBLED AND WON — ${d} damage!`);
          narration = `${actor.name} rolled the dice and WON! ${target.name} takes ${d} damage!`;
        }
      } else {
        actor.hp = Math.max(0, actor.hp - 15);
        addLog(room, `🎲 GAMBLED AND LOST — 15 self-damage!`);
        narration = `${actor.name} rolled the dice and LOST. The gods laugh as they take 15 damage!`;
      }
      break;
    }
    case "steal": {
      if (!target.lastCard || target.lastCard === "steal") {
        addLog(room, `🪞 Mirror Strike — nothing to copy!`);
        narration = `${actor.name} holds up the mirror... nothing to copy!`;
      } else {
        const copyId = target.lastCard;
        addLog(room, `🪞 ${actor.name} mirrors ${CARD_NAMES[copyId]}!`);
        narration = `${actor.name} mirrors ${target.name}'s ${CARD_NAMES[copyId]}!`;
        actor.hand.unshift(copyId);
        resolveCard(room, actorToken, copyId);
        return;
      }
      break;
    }
    case "divine_shield": {
      actor.shield = true;
      const divHealed = applyHeal(room, actor, 15);
      addLog(room, `✦ DIVINE SHIELD — shield + ${divHealed} HP!`);
      narration = `${actor.name} bathes in divine light! Shield + ${divHealed} HP restored.`;
      break;
    }
    case "double_strike": {
      let total = 0;
      for (let i = 0; i < 2; i++) {
        const d = dealDamage(room, actor, target, 15, `strike ${i + 1}`);
        if (d > 0) total += d; else break;
      }
      if (total > 0) {
        actor.lastCardDmg = total;
        addLog(room, `⚡ DOUBLE STRIKE — ${total} total!`);
        narration = `${actor.name} blurs into motion — striking TWICE for ${total} total damage!`;
      }
      break;
    }
    case "vampire_bite": {
      const d = dealDamage(room, actor, target, 16, "vampire bite");
      if (d > 0) {
        actor.lastCardDmg = d;
        const stolen = Math.floor(d / 2);
        const healed = applyHeal(room, actor, stolen);
        addLog(room, `🧛 VAMPIRE BITE — ${d} drained, +${healed} HP!`);
        narration = `${actor.name} sinks their fangs! Drains ${d} HP and restores ${healed} to themselves!`;
      }
      break;
    }
    case "earthquake": {
      const d = dealDamage(room, actor, target, 28, "earthquake");
      if (d > 0) {
        actor.lastCardDmg = d;
        actor.hp = Math.max(0, actor.hp - 8);
        addLog(room, `🌍 EARTHQUAKE — ${d} to foe, 8 self-damage!`);
        narration = `EARTHQUAKE! ${target.name} takes ${d} damage, but tremors deal 8 to ${actor.name} too!`;
      }
      break;
    }
    case "berserker": {
      const ratio = 1 - actor.hp / actor.maxHp;
      const dmg = Math.floor(8 + ratio * 32);
      const d = dealDamage(room, actor, target, Math.min(dmg, 40), "berserker");
      if (d > 0) {
        actor.lastCardDmg = d;
        addLog(room, `😡 BERSERKER — ${d} rage damage!`);
        narration = `${actor.name} BERSERKS! The lower their HP, the harder they hit — ${d} furious damage!`;
      }
      break;
    }
    case "ghost_step": {
      actor.shield = true;
      const d = dealDamage(room, actor, target, 12, "ghost counter");
      if (d > 0) actor.lastCardDmg = d;
      addLog(room, `👻 GHOST STEP — shield + ${d > 0 ? d : 0} counter!`);
      narration = `${actor.name} phases through reality! Shield raised + ${d > 0 ? d : 0} counter damage!`;
      break;
    }
    case "reflect": {
      actor.reflectActive = true;
      addLog(room, `🔮 REFLECT set — next hit bounces back!`);
      narration = `${actor.name} conjures a mystic mirror. The next attack will be REFLECTED at full power!`;
      break;
    }
    case "lucky_shot": {
      const dmg = Math.floor(Math.random() * 46) + 5;
      const d = dealDamage(room, actor, target, dmg, "lucky shot");
      if (d > 0) {
        actor.lastCardDmg = d;
        addLog(room, `🍀 LUCKY SHOT — ${d} damage!${d >= 40 ? " INSANE!" : d <= 10 ? " Barely..." : ""}`);
        narration = d >= 40
          ? `LUCKY SHOT hits for ${d} INSANE damage! Absolutely blessed!`
          : d <= 10
          ? `Lucky shot... barely ${d} damage. Rough.`
          : `Lucky shot! ${d} damage from pure chaos.`;
      }
      break;
    }
    case "counter_stance": {
      actor.counterStanceActive = true;
      addLog(room, `🔄 ${actor.name} takes COUNTER STANCE — next hit reflected + 12 bonus!`);
      narration = `${actor.name} drops into a fighting stance. The next attack against them will be REFLECTED with a 12 damage bonus!`;
      break;
    }
    case "mana_surge": {
      actor.manaSurgeActive = true;
      addLog(room, `✨ ${actor.name} charged MANA SURGE — next card deals double + 10 bonus!`);
      narration = `${actor.name} channels raw mana — their next strike will deal DOUBLE DAMAGE plus 10 bonus!`;
      break;
    }
    case "pickpocket": {
      if (target.hand.length > 0) {
        const ridx = Math.floor(Math.random() * target.hand.length);
        const stolen = target.hand.splice(ridx, 1)[0] as CardId;
        actor.hand.push(stolen);
        addLog(room, `🤏 ${actor.name} stole ${CARD_NAMES[stolen]} from ${target.name}!`);
        narration = `${actor.name} slips their hand into ${target.name}'s deck and steals ${CARD_NAMES[stolen]}!`;
      } else {
        addLog(room, `🤏 Pickpocket — ${target.name} has no cards!`);
        narration = `${actor.name} tries to pickpocket... ${target.name} has nothing!`;
      }
      break;
    }
    case "explosion": {
      const d = dealDamage(room, actor, target, 30, "explosion");
      if (d > 0) actor.lastCardDmg = d;
      if (actor.hand.length > 0) {
        const ridx = Math.floor(Math.random() * actor.hand.length);
        const lost = actor.hand.splice(ridx, 1)[0] as CardId;
        addLog(room, `💣 EXPLOSION — ${d > 0 ? d : 0} damage! Lost ${CARD_NAMES[lost]} from own hand.`);
        narration = `${actor.name} detonates for ${d > 0 ? d : 0} damage! But the blast destroys ${CARD_NAMES[lost]} from their own hand!`;
      } else {
        addLog(room, `💣 EXPLOSION — ${d > 0 ? d : 0} damage!`);
        narration = `${actor.name} detonates for ${d > 0 ? d : 0} damage!`;
      }
      break;
    }
    case "shockwave": {
      const isStunned = target.skipTurns > 0;
      const totalDmg = isStunned ? 45 : 20;
      const d = dealDamage(room, actor, target, totalDmg, "shockwave");
      if (d > 0) actor.lastCardDmg = d;
      if (isStunned) {
        addLog(room, `🌊 SHOCKWAVE — ${d > 0 ? d : 0} CRUSHING damage (foe was stunned)!`);
        narration = `${actor.name} sends a shockwave crashing through the stunned ${target.name}! ${d > 0 ? d : 0} CRUSHING damage!`;
      } else {
        addLog(room, `🌊 SHOCKWAVE — ${d > 0 ? d : 0} damage (no stun bonus)`);
        narration = `${actor.name} fires a shockwave for ${d > 0 ? d : 0} damage. Would've hit harder if ${target.name} was stunned!`;
      }
      break;
    }
    case "chain_stun": {
      const isStunned = target.skipTurns > 0;
      if (isStunned) {
        // Extend stun + massive damage
        target.skipTurns += 1;
        const d = dealDamage(room, actor, target, 25, "chain stun");
        if (d > 0) actor.lastCardDmg = d;
        addLog(room, `⛓ CHAIN STUN — foe already stunned! ${d > 0 ? d : 0} DMG + stun extended!`);
        narration = `${actor.name} chains the stun! ${target.name} is KEPT DOWN — ${d > 0 ? d : 0} damage and their stun is extended!`;
      } else {
        const d = dealDamage(room, actor, target, 10, "chain stun");
        if (d > 0) actor.lastCardDmg = d;
        addLog(room, `⛓ Chain Stun — ${d > 0 ? d : 0} DMG (no stun active, use when foe is stunned!)`);
        narration = `${actor.name} swings the chain for ${d > 0 ? d : 0} damage. Combo with a stun first for full power!`;
      }
      break;
    }

    // ── CURSED ──────────────────────────────────────────────────
    case "cursed_blade": {
      const d = dealDamage(room, actor, target, 45, "cursed blade");
      if (d > 0) {
        actor.lastCardDmg = d;
        addLog(room, `🩸 CURSED BLADE — ${d} damage!`);
        narration = `${actor.name} unleashes the Cursed Blade — ${d} devastating damage! Pure corrupted power.`;
      }
      break;
    }
    case "blood_pact": {
      actor.hp = Math.max(0, actor.hp - 15);
      const d = dealDamage(room, actor, target, 40, "blood pact");
      if (d > 0) {
        actor.lastCardDmg = d;
        addLog(room, `🩸 BLOOD PACT — sacrifice 15, deal ${d}!`);
        narration = `${actor.name} seals a Blood Pact! Sacrifices 15 HP to unleash ${d} dark damage!`;
      }
      break;
    }
    case "soul_drain": {
      const stacks = target.regenStacks;
      if (stacks === 0) {
        addLog(room, `🌙 SOUL DRAIN — ${target.name} has no regen to drain!`);
        narration = `${actor.name} reaches for ${target.name}'s life force... but there's nothing to drain!`;
      } else {
        target.regenStacks = 0;
        const dmg = stacks * 8;
        const d = dealDamage(room, actor, target, dmg, "soul drain");
        const healed = applyHeal(room, actor, dmg);
        if (d > 0) actor.lastCardDmg = d;
        addLog(room, `🌙 SOUL DRAIN — drained ${stacks} regen stack(s)! ${d > 0 ? d : 0} DMG + ${healed} HP stolen!`);
        narration = `${actor.name} rips ${stacks} regen stack(s) from ${target.name}'s soul! ${d > 0 ? d : 0} damage and ${healed} HP stolen!`;
      }
      break;
    }

    // ── CORRUPTED ───────────────────────────────────────────────
    case "cursed_heal": {
      const healed = applyHeal(room, actor, 40);
      const oppHeal = applyHeal(room, target, 20);
      addLog(room, `💜 CURSED HEAL — +${healed} HP... but ${target.name} heals ${oppHeal} too!`);
      narration = `${actor.name} drinks a cursed potion, healing ${healed} HP! But the corruption spreads — ${target.name} also heals ${oppHeal} HP!`;
      break;
    }
    case "betrayal": {
      const d = dealDamage(room, actor, target, 30, "betrayal");
      if (d > 0) actor.lastCardDmg = d;
      actor.hp = Math.max(0, actor.hp - 10);
      const rareCards: CardId[] = ["gamble", "divine_shield", "double_strike", "vampire_bite", "reflect", "chain_stun"];
      const gift = rareCards[Math.floor(Math.random() * rareCards.length)];
      target.hand.push(gift);
      addLog(room, `🗡 BETRAYAL — ${d > 0 ? d : 0} to foe, 10 self-dmg, gave ${CARD_NAMES[gift]} to ${target.name}!`);
      narration = `${actor.name} betrays all logic! ${d > 0 ? d : 0} damage, 10 self-damage, and gifts ${CARD_NAMES[gift]} to ${target.name}. Chaos!`;
      break;
    }
    case "plague": {
      actor.plagueStacks = 3;
      target.plagueStacks = 3;
      addLog(room, `🦠 PLAGUE — both players infected! 8 damage/turn for 3 turns!`);
      narration = `${actor.name} releases the PLAGUE! Both players are infected — 8 damage per turn for 3 turns each!`;
      break;
    }
    case "sacrifice": {
      actor.hp = Math.max(0, actor.hp - 20);
      const drawn: CardId[] = [];
      for (let i = 0; i < 4; i++) drawn.push(drawOne([...actor.hand as CardId[], ...drawn]));
      actor.hand.push(...drawn);
      addLog(room, `💀 SACRIFICE — lose 20 HP, draw 4 cards!`);
      narration = `${actor.name} offers their life force! Loses 20 HP but draws 4 new cards!`;
      break;
    }
    case "hand_swap": {
      const myHand = [...actor.hand];
      const theirHand = [...target.hand];
      actor.hand = theirHand;
      target.hand = myHand;
      addLog(room, `🔀 HAND SWAP — ${actor.name} swapped hands with ${target.name}!`);
      narration = `${actor.name} rips the cards from ${target.name}'s grip and shoves their own deck back! HANDS SWAPPED!`;
      break;
    }
    case "cursed_mirror": {
      const effects: string[] = [];
      if (target.shield)               { actor.shield = true;               effects.push("Shield"); }
      if (target.reflectActive)        { actor.reflectActive = true;        effects.push("Reflect"); }
      if (target.counterStanceActive)  { actor.counterStanceActive = true;  effects.push("Counter Stance"); }
      if (target.manaSurgeActive)      { actor.manaSurgeActive = true;      effects.push("Mana Surge"); }
      if (target.warCryBonus > 0)      { actor.warCryBonus = Math.max(actor.warCryBonus, target.warCryBonus); effects.push(`War Cry+${target.warCryBonus}`); }
      if (target.regenStacks > 0)      { actor.regenStacks = Math.max(actor.regenStacks, target.regenStacks); effects.push(`Regen×${target.regenStacks}`); }
      if (target.darkMatterStacks > 0) { actor.darkMatterStacks = Math.max(actor.darkMatterStacks, target.darkMatterStacks); effects.push(`Dark Matter×${target.darkMatterStacks}`); }
      if (target.poisoned > 0)         { actor.poisoned = Math.max(actor.poisoned, target.poisoned); effects.push(`Poison`); }
      if (target.plagueStacks > 0)     { actor.plagueStacks = Math.max(actor.plagueStacks, target.plagueStacks); effects.push(`Plague`); }
      if (effects.length === 0) {
        addLog(room, `🪟 CURSED MIRROR — ${target.name} has no effects to copy!`);
        narration = `${actor.name} holds up the Cursed Mirror... but ${target.name} has nothing to copy!`;
      } else {
        addLog(room, `🪟 CURSED MIRROR — ${actor.name} copied: ${effects.join(", ")}!`);
        narration = `${actor.name} gazes into the Cursed Mirror and absorbs ${target.name}'s aura! Copied: ${effects.join(", ")}!`;
      }
      break;
    }
    case "curse_tax": {
      if (target.hand.length === 0) {
        addLog(room, `💸 CURSE TAX — ${target.name} has no cards to destroy!`);
        narration = `${actor.name} reaches for the Curse Tax... ${target.name} has nothing to take!`;
      } else {
        const ridx = Math.floor(Math.random() * target.hand.length);
        const destroyed = target.hand.splice(ridx, 1)[0] as CardId;
        const rarity = CARD_RARITIES[destroyed] ?? "common";
        const healAmt = RARITY_HEAL[rarity] ?? 5;
        const healed = applyHeal(room, actor, healAmt);
        addLog(room, `💸 CURSE TAX — destroyed ${target.name}'s ${CARD_NAMES[destroyed]} (${rarity}), healed ${healed} HP!`);
        narration = `${actor.name} collects the Curse Tax! Destroys ${target.name}'s ${CARD_NAMES[destroyed]} — a ${rarity} card — and siphons ${healed} HP!`;
      }
      break;
    }

    // ── LEGENDARY ───────────────────────────────────────────────
    case "freeze": {
      const d = dealDamage(room, actor, target, 30, "freeze");
      if (d > 0) actor.lastCardDmg = d;
      target.healBlocked = 3;
      addLog(room, `❄ FREEZE — ${d > 0 ? d : 0} damage + ${target.name}'s healing BLOCKED for 3 turns!`);
      narration = `${actor.name} encases ${target.name} in cosmic ice — ${d > 0 ? d : 0} damage and their healing is FROZEN for 3 turns!`;
      break;
    }
    case "divine_retribution": {
      // REWORKED: Two strikes of 25 each. Second strike stuns.
      let total = 0;
      const d1 = dealDamage(room, actor, target, 25, "first smite");
      if (d1 > 0) total += d1;
      addLog(room, `⚖ DIVINE RETRIBUTION — First smite: ${d1 > 0 ? d1 : "blocked"}!`);
      if (d1 >= 0) { // proceed to second strike unless reflected (−1) or event horizon (−2)
        const d2 = dealDamage(room, actor, target, 25, "second smite");
        if (d2 > 0) {
          total += d2;
          const stunned = applyStun(room, actor, target, 1);
          addLog(room, `⚖ DIVINE RETRIBUTION — Second smite: ${d2}!${stunned ? " + STUN!" : " (stun on CD)"}`);
          narration = `${actor.name} calls down DIVINE RETRIBUTION! Two holy smites for ${total} total damage!${stunned ? " The second blow STUNS!" : ""}`;
        } else {
          addLog(room, `⚖ DIVINE RETRIBUTION — Second smite: blocked!`);
          narration = `${actor.name} calls down DIVINE RETRIBUTION! First smite: ${d1 > 0 ? d1 : 0} damage, second was blocked!`;
        }
      } else {
        narration = `${actor.name} calls down DIVINE RETRIBUTION — but it was reflected/absorbed!`;
      }
      if (total > 0) actor.lastCardDmg = total;
      break;
    }
    case "titans_wrath": {
      const diff = Math.abs(actor.hp - target.hp);
      const dmg = Math.max(10, diff);
      const d = dealDamage(room, actor, target, dmg, "titan's wrath");
      if (d > 0) actor.lastCardDmg = d;
      addLog(room, `🔱 TITAN'S WRATH — ${d > 0 ? d : 0} damage (HP diff: ${diff})!`);
      narration = `${actor.name} channels TITAN'S WRATH! Deals ${d > 0 ? d : 0} damage — the greater the HP gap, the harder the strike!`;
      break;
    }
    case "last_stand": {
      if (actor.hp <= 35) {
        const d = dealDamage(room, actor, target, 70, "last stand");
        actor.shield = true;
        if (d > 0) actor.lastCardDmg = d;
        addLog(room, `🛡 LAST STAND — ${d > 0 ? d : 0} MASSIVE damage + shield raised!`);
        narration = `${actor.name} is on the brink! LAST STAND triggers — ${d > 0 ? d : 0} MASSIVE damage AND a desperate shield!`;
      } else {
        const d = dealDamage(room, actor, target, 5, "last stand");
        if (d > 0) actor.lastCardDmg = d;
        addLog(room, `🛡 Last Stand... only 5 damage (HP too high)`);
        narration = `${actor.name} plays Last Stand... but their HP is too high! Only 5 damage. Save it for desperate moments!`;
      }
      break;
    }
    case "lightning_storm": {
      const hits: string[] = [];
      let stormTotal = 0;
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.70) {
          const d = dealDamage(room, actor, target, 15, "bolt");
          if (d > 0) { stormTotal += d; hits.push(`${d} to ${target.name}`); }
          else hits.push("blocked!");
        } else {
          actor.hp = Math.max(0, actor.hp - 5);
          hits.push(`5 backfire!`);
        }
      }
      if (stormTotal > 0) actor.lastCardDmg = stormTotal;
      addLog(room, `⛈ LIGHTNING STORM: ${hits.join(", ")}`);
      narration = `${actor.name} summons a LIGHTNING STORM! Three chaotic bolts — ${hits.join(", ")}!`;
      break;
    }
    case "meteor": {
      // Bypasses shields
      const d = dealDamage(room, actor, target, 60, "meteor", true);
      actor.hp = Math.max(0, actor.hp - 25);
      if (d > 0) {
        actor.lastCardDmg = d;
        addLog(room, `☄ METEOR — ${d} damage (bypasses shields)! 25 recoil to self.`);
        narration = `${actor.name} calls down a METEOR! ${d} catastrophic damage — shields mean nothing! But 25 recoil SHATTERS ${actor.name}!`;
      }
      break;
    }
    case "overflow": {
      const drawn: CardId[] = [];
      for (let i = 0; i < 5; i++) drawn.push(drawOne([...actor.hand as CardId[], ...drawn]));
      actor.hand.push(...drawn);
      actor.overflowDiscard = 1;
      actor.overflowCount = 5;
      addLog(room, `🃏 OVERFLOW — drew 5 cards! Will discard 5 at start of next turn.`);
      narration = `${actor.name} channels cosmic overflow — draws 5 cards! But the universe balances — 5 will be discarded next turn!`;
      break;
    }
    case "echo_strike": {
      if (!actor.lastCard || actor.lastCardDmg <= 0) {
        addLog(room, `🔁 ECHO STRIKE — no previous damage to echo!`);
        narration = `${actor.name} tries to echo their last strike... but there's nothing to repeat!`;
      } else {
        const echoDmg = actor.lastCardDmg;
        const d = dealDamage(room, actor, target, echoDmg, "echo strike");
        addLog(room, `🔁 ECHO STRIKE — echoes ${CARD_NAMES[actor.lastCard]} for ${d > 0 ? d : 0} damage!`);
        narration = `${actor.name} channels an ECHO STRIKE! Replays the raw power of ${CARD_NAMES[actor.lastCard]} for ${d > 0 ? d : 0} damage!`;
        // Note: don't update lastCardDmg so it can't chain infinitely
      }
      break;
    }

    // ── MYTHIC ──────────────────────────────────────────────────
    case "soul_swap": {
      const myHp = actor.hp;
      const theirHp = target.hp;
      actor.hp = theirHp;
      target.hp = myHp;
      addLog(room, `👁 SOUL SWAP — HP totals swapped! ${actor.name}: ${actor.hp}, ${target.name}: ${target.hp}`);
      narration = `${actor.name} rips the souls from their bodies — HP SWAPPED! ${actor.name} now has ${actor.hp} HP, ${target.name} has ${target.hp} HP!`;
      break;
    }
    case "armageddon": {
      // Bypasses ALL defences
      const prevActorShield  = actor.shield;  actor.shield  = false;
      const prevTargetShield = target.shield; target.shield = false;
      actor.hp  = Math.max(0, actor.hp  - 50);
      target.hp = Math.max(0, target.hp - 50);
      actor.shield  = prevActorShield  && actor.hp  > 0;
      target.shield = prevTargetShield && target.hp > 0;
      addLog(room, `💥 ARMAGEDDON — both players take 50 damage! No shields!`);
      narration = `${actor.name} triggers ARMAGEDDON! The cosmos trembles — BOTH players take 50 damage! Shields are useless!`;
      break;
    }
    case "void_rift": {
      actor.hand  = drawHand(3);
      target.hand = drawHand(3);
      addLog(room, `🌀 VOID RIFT — all hands destroyed! Both redraw 3 cards!`);
      narration = `${actor.name} tears open a VOID RIFT! Both hands consumed by darkness — each player redraws 3 fresh cards!`;
      break;
    }
    case "judgement": {
      if (target.hp <= 25) {
        endGame(room, actorToken);
        addLog(room, `⚖ JUDGEMENT — ${target.name} had ≤25 HP. INSTANT WIN!`);
        narration = `${actor.name} passes JUDGEMENT! ${target.name} had only ${target.hp} HP — they are INSTANTLY DEFEATED!`;
        broadcast(room);
        return;
      } else {
        const d = dealDamage(room, actor, target, 5, "judgement");
        if (d > 0) actor.lastCardDmg = d;
        addLog(room, `⚖ Judgement... only 5 damage (${target.name} has ${target.hp} HP > 25)`);
        narration = `${actor.name} tries to pass Judgement... but ${target.name} has ${target.hp} HP — too healthy! Only 5 damage.`;
      }
      break;
    }
    case "time_warp": {
      actor.extraTurn = true;
      actor.extraTurnDebt = 2;
      addLog(room, `⏳ TIME WARP — ${actor.name} gets 2 extra turns! Debt: skip 2 turns later.`);
      narration = `${actor.name} warps time itself! Taking 2 extra turns NOW... but will owe 2 skipped turns afterward!`;
      break;
    }

    // ── VOID ────────────────────────────────────────────────────
    case "singularity": {
      const avg = Math.floor((actor.hp + target.hp) / 2);
      const actorOld  = actor.hp;
      const targetOld = target.hp;
      actor.hp  = Math.min(actor.maxHp,  avg);
      target.hp = Math.min(target.maxHp, avg);
      addLog(room, `🕳 SINGULARITY — HP equalized to ${avg}! ${actor.name}: ${actorOld}→${avg}, ${target.name}: ${targetOld}→${avg}`);
      narration = actorOld > targetOld
        ? `${actor.name} collapses space-time into a SINGULARITY! HP equalized at ${avg} — brutal for ${target.name}!`
        : `${actor.name} collapses the singularity... equalized at ${avg} HP. Bold move when losing!`;
      break;
    }
    case "dark_matter": {
      target.darkMatterStacks = 3;
      addLog(room, `🫧 DARK MATTER — ${target.name}'s next 3 damaging cards deal 0 damage!`);
      narration = `${actor.name} surrounds ${target.name} in DARK MATTER! Their next 3 attacks will be completely absorbed!`;
      break;
    }
    case "event_horizon": {
      target.eventHorizonActive = true;
      addLog(room, `🌑 EVENT HORIZON — ${target.name}'s next attack collapses back on themselves!`);
      narration = `${actor.name} creates an EVENT HORIZON! The next time ${target.name} attacks, the damage folds back on themselves!`;
      break;
    }
    case "neutron_star": {
      const d = dealDamage(room, actor, target, 25, "neutron star");
      if (d > 0) actor.lastCardDmg = d;
      target.neutronStarTicks = 3;
      addLog(room, `⭐ NEUTRON STAR — ${d > 0 ? d : 0} now + 15/turn for 3 turns!`);
      narration = `${actor.name} launches a NEUTRON STAR! ${d > 0 ? d : 0} immediate damage + 15 radiation each of ${target.name}'s next 3 turns!`;
      break;
    }
    case "void_pulse": {
      let effectCount = 0;
      if (target.poisoned > 0)          effectCount++;
      if (target.plagueStacks > 0)      effectCount++;
      if (target.skipTurns > 0)         effectCount++;
      if (target.neutronStarTicks > 0)  effectCount++;
      if (target.eventHorizonActive)    effectCount++;
      if (target.darkMatterStacks > 0)  effectCount++;
      if (target.taunted)               effectCount++;
      if (target.healBlocked > 0)       effectCount++;
      const vpDmg = Math.max(10, effectCount * 8);
      const d = dealDamage(room, actor, target, vpDmg, "void pulse");
      if (d > 0) actor.lastCardDmg = d;
      addLog(room, `🔵 VOID PULSE — ${effectCount} effect(s) × 8 = ${d > 0 ? d : 0} damage!`);
      narration = effectCount >= 3
        ? `${actor.name} fires a VOID PULSE! ${target.name} had ${effectCount} debuffs — ${d > 0 ? d : 0} CRUSHING damage!`
        : `${actor.name} fires a Void Pulse for ${d > 0 ? d : 0} damage. Stack more debuffs for maximum pain!`;
      break;
    }
  }

  room.lastNarration = narration;
  if (checkDeath(room, actorToken, targetToken)) { broadcast(room); return; }
  replenishCard(actor);

  // Time warp extra turn logic
  if (actor.extraTurn) {
    actor.extraTurn = false;
    if ((actor as any)._warpTurnsLeft === undefined) (actor as any)._warpTurnsLeft = 0;
    if (cardId === "time_warp") {
      (actor as any)._warpTurnsLeft = 2;
    }
    if ((actor as any)._warpTurnsLeft > 0) {
      (actor as any)._warpTurnsLeft--;
      if ((actor as any)._warpTurnsLeft > 0) actor.extraTurn = true;
      addLog(room, `⏳ ${actor.name} takes an extra TIME WARP turn!`);
      startTurn(room, actorToken);
    } else {
      addLog(room, `⏳ ${actor.name} takes an EXTRA TURN!`);
      startTurn(room, actorToken);
    }
  } else {
    startTurn(room, targetToken);
  }
  broadcast(room);
}

// ── Socket events ─────────────────────────────────────────────────
io.on("connection", socket => {
  socket.on("joinRoom", ({ roomId, sessionToken, preferredName }: { roomId: string; sessionToken: string; preferredName: string }) => {
    const room = getRoom(roomId);
    const tokens = Object.keys(room.players);

    if (room.players[sessionToken]) {
      const player = room.players[sessionToken];
      player.socketId = socket.id;
      player.connected = true;
      socket.join(roomId);
      addLog(room, `${player.name} reconnected!`);
      broadcast(room);
      return;
    }

    if (tokens.length >= 2) { socket.emit("roomFull"); return; }

    const player: Player = {
      socketId: socket.id, sessionToken,
      name: preferredName.slice(0, 16),
      hp: 100, maxHp: 100,
      shield: false, reflectActive: false, counterStanceActive: false,
      manaSurgeActive: false, warCryBonus: 0,
      poisoned: 0, regenStacks: 0, plagueStacks: 0,
      skipTurns: 0, taunted: false, extraTurn: false, extraTurnDebt: 0,
      stunsSuffered: 0, stunCooldown: 0,
      darkMatterStacks: 0, eventHorizonActive: false, neutronStarTicks: 0,
      healBlocked: 0, overflowDiscard: 0, overflowCount: 0,
      lastCard: null, lastCardDmg: 0,
      hand: drawHand(5), rematchReady: false, connected: true,
    };

    room.players[sessionToken] = player;
    socket.join(roomId);
    addLog(room, `${player.name} entered the arena!`);

    if (Object.keys(room.players).length === 2) {
      room.gameOver = false; room.winnerId = null; room.isDraw = false;
      room.turn = Object.keys(room.players)[0];
      addLog(room, "★ THE BATTLE BEGINS!");
    }
    broadcast(room);
  });

  socket.on("playCard", (cardId: CardId) => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token) continue;
      if (room.gameOver || room.turn !== token) return;
      if (!room.players[token].hand.includes(cardId)) return;
      resolveCard(room, token, cardId);
      return;
    }
  });

  socket.on("forfeit", () => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token) continue;
      if (room.gameOver) return;
      const oppToken = Object.keys(room.players).find(t => t !== token);
      addLog(room, `${room.players[token].name} forfeited!`);
      if (oppToken) endGame(room, oppToken);
      else room.gameOver = true;
      broadcast(room);
      return;
    }
  });

  socket.on("rematch", () => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token || !room.gameOver) continue;
      room.players[token].rematchReady = true;
      const tokens = Object.keys(room.players);
      if (tokens.length === 2 && tokens.every(t => room.players[t].rematchReady)) {
        tokens.forEach(t => {
          const p = room.players[t];
          p.hp = 100; p.maxHp = 100;
          p.shield = false; p.reflectActive = false; p.counterStanceActive = false;
          p.manaSurgeActive = false; p.warCryBonus = 0;
          p.poisoned = 0; p.regenStacks = 0; p.plagueStacks = 0;
          p.skipTurns = 0; p.taunted = false; p.extraTurn = false; p.extraTurnDebt = 0;
          p.stunsSuffered = 0; p.stunCooldown = 0;
          p.darkMatterStacks = 0; p.eventHorizonActive = false; p.neutronStarTicks = 0;
          p.healBlocked = 0; p.overflowDiscard = 0; p.overflowCount = 0;
          p.lastCard = null; p.lastCardDmg = 0;
          p.hand = drawHand(5); p.rematchReady = false;
        });
        room.gameOver = false; room.winnerId = null; room.isDraw = false;
        room.log = []; room.lastNarration = "";
        room.turn = tokens[Math.floor(Math.random() * 2)];
        addLog(room, "★ REMATCH — FIGHT!");
      }
      broadcast(room);
      return;
    }
  });

  socket.on("getLeaderboard", async () => {
    socket.emit("leaderboard", await getLeaderboard());
  });

  socket.on("setName", (name: string) => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (token) { room.players[token].name = name.slice(0, 16); broadcast(room); return; }
    }
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token) continue;
      room.players[token].connected = false;
      addLog(room, `${room.players[token].name} disconnected — waiting for reconnect...`);
      broadcast(room);
      return;
    }
  });
});

initDB().then(() => {
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  httpServer.listen(PORT, () => console.log(`✅ Server running on :${PORT}`));
}).catch(err => { console.error("DB init failed:", err); process.exit(1); });