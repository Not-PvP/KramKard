import { Server } from "socket.io";
import { createServer } from "http";
import { createClient } from "@libsql/client";

const httpServer = createServer((req, res) => { res.writeHead(200); res.end("OK"); });
const io = new Server(httpServer, { cors: { origin: "*" } });

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
  | "war_cry" | "chain_stun" | "soul_drain" | "echo_strike"
  | "sacred_spring" | "blood_transfusion" | "celestial_mend" | "phoenix_ember";

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
  sacred_spring: "Sacred Spring", blood_transfusion: "Blood Transfusion",
  celestial_mend: "Celestial Mend", phoenix_ember: "Phoenix Ember",
};

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
  pickpocket: "rare", explosion: "rare", shockwave: "rare", chain_stun: "rare", sacred_spring: "rare",
  cursed_blade: "cursed", blood_pact: "cursed", soul_drain: "cursed",
  cursed_heal: "corrupted", betrayal: "corrupted", plague: "corrupted", sacrifice: "corrupted",
  hand_swap: "corrupted", cursed_mirror: "corrupted", curse_tax: "corrupted", blood_transfusion: "corrupted",
  freeze: "legendary", divine_retribution: "legendary", titans_wrath: "legendary",
  last_stand: "legendary", lightning_storm: "legendary", meteor: "legendary",
  overflow: "legendary", echo_strike: "legendary", celestial_mend: "legendary",
  soul_swap: "mythic", armageddon: "mythic", void_rift: "mythic", judgement: "mythic",
  time_warp: "mythic", phoenix_ember: "mythic",
  singularity: "void", dark_matter: "void", event_horizon: "void", neutron_star: "void", void_pulse: "void",
};

const POOLS: Record<string, CardId[]> = {
  common:    ["slash", "slash", "slash", "weak_jab", "weak_jab", "fumble"],
  uncommon:  ["heavy_blow", "heal", "shield", "poison_dart", "taunt", "mana_burn", "ice_spike", "regen", "war_cry"],
  rare:      ["gamble", "steal", "divine_shield", "double_strike", "vampire_bite", "earthquake", "berserker",
              "ghost_step", "reflect", "lucky_shot", "counter_stance", "mana_surge", "pickpocket", "explosion",
              "shockwave", "chain_stun", "sacred_spring"],
  cursed:    ["cursed_blade", "blood_pact", "soul_drain"],
  corrupted: ["cursed_heal", "betrayal", "plague", "sacrifice", "hand_swap", "cursed_mirror", "curse_tax", "blood_transfusion"],
  legendary: ["freeze", "divine_retribution", "titans_wrath", "last_stand", "lightning_storm", "meteor", "overflow", "echo_strike", "celestial_mend"],
  mythic:    ["soul_swap", "armageddon", "void_rift", "judgement", "time_warp", "phoenix_ember"],
  void:      ["singularity", "dark_matter", "event_horizon", "neutron_star", "void_pulse"],
};

function drawOne(exclude: CardId[] = []): CardId {
  const roll = Math.random() * 100;
  let tier: string;
  if      (roll < 0.3)  tier = "void";
  else if (roll < 1.5)  tier = "mythic";
  else if (roll < 4.5)  tier = "legendary";
  else if (roll < 10.5) tier = "corrupted";
  else if (roll < 16.5) tier = "cursed";
  else if (roll < 36.5) tier = "rare";
  else if (roll < 66.5) tier = "uncommon";
  else                  tier = "common";

  const pool = POOLS[tier].filter(c => !exclude.includes(c));
  const finalPool = pool.length > 0 ? pool : POOLS["common"].filter(c => !exclude.includes(c));
  if (finalPool.length === 0) {
    const all = Object.values(POOLS).flat().filter(c => !exclude.includes(c));
    return all[Math.floor(Math.random() * all.length)] as CardId;
  }
  return finalPool[Math.floor(Math.random() * finalPool.length)] as CardId;
}

function drawHand(count = 5): CardId[] {
  const hand: CardId[] = [];
  for (let i = 0; i < count; i++) hand.push(drawOne(hand));
  return hand;
}

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
  warCryBonus: number;
  poisoned: number;
  regenStacks: number;
  plagueStacks: number;
  skipTurns: number;
  taunted: boolean;
  extraTurn: boolean;
  extraTurnDebt: number;
  warpTurnsLeft: number;
  stunsSuffered: number;
  stunCooldown: number;
  // ── NEW: persists for one opponent turn after a stun lands so Chain Stun
  //         and Shockwave can detect "was stunned recently" even after skipTurns
  //         gets consumed by startTurn ──────────────────────────────────────
  stunFlagForChain: boolean;
  darkMatterStacks: number;
  eventHorizonActive: boolean;
  neutronStarTicks: number;
  healBlocked: number;
  overflowDiscard: number;
  overflowCount: number;
  lastCard: CardId | null;
  lastCardDmg: number;
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
  turnStartTime: number; // ms epoch — sent to client so it can render a countdown timer
}

interface LeaderboardEntry {
  sessionToken: string;
  name: string;
  wins: number;
  losses: number;
}

const rooms: Map<string, Room> = new Map();

function getRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId, players: {}, turn: null, log: [],
      gameOver: false, winnerId: null, isDraw: false, lastNarration: "",
      turnStartTime: 0,
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
      turnStartTime: room.turnStartTime,
    });
  });
}

function getOpponentToken(room: Room, token: string): string | null {
  return Object.keys(room.players).find(x => x !== token) ?? null;
}

function replenishCard(player: Player) {
  player.hand.push(drawOne(player.hand as CardId[]));
}

function dealDamage(
  room: Room,
  actor: Player,
  target: Player,
  dmg: number,
  source: string,
  bypassShield = false
): number {
  if (target.eventHorizonActive && !bypassShield) {
    target.eventHorizonActive = false;
    actor.hp = Math.max(0, actor.hp - dmg);
    addLog(room, `🌑 EVENT HORIZON! ${source} collapses inward — ${dmg} damage hits ${actor.name} instead!`);
    return -2;
  }
  if (target.darkMatterStacks > 0) {
    target.darkMatterStacks--;
    addLog(room, `🫧 DARK MATTER absorbs ${source}! (${target.darkMatterStacks} stack(s) left)`);
    return 0;
  }
  if (target.counterStanceActive && !bypassShield) {
    target.counterStanceActive = false;
    actor.hp = Math.max(0, actor.hp - dmg);
    target.hp = Math.max(0, target.hp - 12);
    addLog(room, `🔄 ${target.name}'s COUNTER STANCE reflects ${dmg} damage + deals 12 bonus to them!`);
    return -1;
  }
  if (target.shield && !bypassShield) {
    target.shield = false;
    addLog(room, `🛡 ${target.name}'s shield absorbed ${source}!`);
    return 0;
  }
  if (target.reflectActive && !bypassShield) {
    target.reflectActive = false;
    actor.hp = Math.max(0, actor.hp - dmg);
    addLog(room, `🔮 ${target.name} REFLECTED ${dmg} damage back at ${actor.name}!`);
    return -1;
  }

  let finalDmg = dmg;
  if (actor.manaSurgeActive) {
    actor.manaSurgeActive = false;
    finalDmg = dmg * 2 + 10;
    addLog(room, `✨ MANA SURGE: ${dmg} → ${finalDmg} damage!`);
  }
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
  // ── Set the chain flag so the opponent can use Chain Stun / Shockwave
  //    on their very next turn even after skipTurns is consumed ──────────
  target.stunFlagForChain = true;
  actor.stunCooldown = 2;
  return true;
}

function checkDeath(room: Room, actorToken: string, targetToken: string): boolean {
  const actor  = room.players[actorToken];
  const target = room.players[targetToken];
  const actorDead  = actor  && actor.hp  <= 0;
  const targetDead = target && target.hp <= 0;
  if (actorDead && targetDead) {
    room.gameOver = true; room.winnerId = null; room.isDraw = true;
    addLog(room, `💀 BOTH WARRIORS FALL — IT'S A DRAW!`);
    return true;
  }
  if (targetDead) { endGame(room, actorToken); return true; }
  if (actorDead)  { endGame(room, targetToken); return true; }
  return false;
}

function endGame(room: Room, winnerToken: string) {
  room.gameOver = true; room.winnerId = winnerToken; room.isDraw = false;
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

  // Player is actually taking their turn now — clear the chain flag so it
  // only lasts for ONE opponent turn window (not forever).
  player.stunFlagForChain = false;

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
    player.hp = Math.max(0, player.hp - 12);
    player.neutronStarTicks--;
    addLog(room, `⭐ NEUTRON STAR deals 12 delayed damage to ${player.name}! (${player.neutronStarTicks} ticks left)`);
    const oppToken = getOpponentToken(room, token);
    if (player.hp <= 0 && oppToken) { endGame(room, oppToken); return; }
  }

  if (player.regenStacks > 0) {
    const regen = player.regenStacks * 13;
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
    player.plagueStacks = Math.max(0, player.plagueStacks - 1);
    addLog(room, `🦠 ${player.name} suffers plague! 8 damage (${player.plagueStacks} turns left)`);
    const oppToken = getOpponentToken(room, token);
    if (player.hp <= 0 && oppToken) { endGame(room, oppToken); return; }
  }

  room.turn = token;
  room.turnStartTime = Date.now(); // ── tick the timer for the client
}

// ── resolveCard ───────────────────────────────────────────────────
function resolveCard(room: Room, actorToken: string, cardId: CardId) {
  const actor = room.players[actorToken];
  const targetToken = getOpponentToken(room, actorToken);
  if (!targetToken) return;
  const target = room.players[targetToken];

  actor.lastCard = cardId;
  const prevCardDmg = actor.lastCardDmg;
  actor.lastCardDmg = 0;

  const idx = actor.hand.indexOf(cardId);
  if (idx !== -1) actor.hand.splice(idx, 1);

  let narration = "";

  switch (cardId) {
    case "slash": {
      const d = dealDamage(room, actor, target, 14, "slash");
      actor.lastCardDmg = Math.max(0, d);
      if (d > 0) { addLog(room, `⚔ ${actor.name} slashed ${target.name} for ${d} damage!`); narration = `${actor.name} draws their blade and slashes ${target.name} for ${d} damage!`; }
      else { addLog(room, `⚔ Slash — blocked or reflected!`); narration = `${actor.name}'s slash was stopped cold!`; }
      break;
    }
    case "weak_jab": {
      const d = dealDamage(room, actor, target, 8, "weak jab");
      actor.lastCardDmg = Math.max(0, d);
      const drawn = drawOne(actor.hand as CardId[]);
      actor.hand.push(drawn);
      if (d > 0) { addLog(room, `👊 ${actor.name} weak jab — ${d} DMG + drew ${CARD_NAMES[drawn]}!`); narration = `${actor.name} throws a quick jab for ${d} damage and draws ${CARD_NAMES[drawn]}!`; }
      else { addLog(room, `👊 Weak Jab blocked — but drew ${CARD_NAMES[drawn]}!`); narration = `${actor.name}'s jab is blocked, but draws ${CARD_NAMES[drawn]}!`; }
      break;
    }
    case "fumble": {
      const d = dealDamage(room, actor, target, 12, "fumble");
      actor.lastCardDmg = Math.max(0, d);
      if (Math.random() < 0.30) {
        actor.skipTurns = Math.max(actor.skipTurns, 1); actor.stunsSuffered++;
        addLog(room, `🤦 ${actor.name} FUMBLED! ${actor.lastCardDmg} damage... and stunned themselves!`);
        narration = `${actor.name} trips over themselves! ${actor.lastCardDmg} damage but they stun THEMSELVES!`;
      } else {
        addLog(room, `🤦 ${actor.name} fumbled awkwardly but got ${actor.lastCardDmg} damage through.`);
        narration = `${actor.name} fumbles the strike but lands ${actor.lastCardDmg} damage.`;
      }
      break;
    }
    case "heavy_blow": {
      const d = dealDamage(room, actor, target, 20, "heavy blow");
      actor.lastCardDmg = Math.max(0, d);
      if (d > 0) {
        const stunned = applyStun(room, actor, target, 1);
        addLog(room, `💥 HEAVY BLOW — ${d} damage${stunned ? " + STUN!" : " (stun on cooldown)"}`);
        narration = stunned ? `${actor.name} winds up and SMASHES ${target.name} for ${d} damage! The crushing blow STUNS them!` : `${actor.name} smashes for ${d} damage! Stun is on cooldown.`;
      } else { addLog(room, `💥 Heavy Blow — blocked or reflected!`); narration = `${actor.name}'s heavy blow was deflected!`; }
      break;
    }
    case "heal": {
      const healed = applyHeal(room, actor, 32);
      if (healed > 0) { addLog(room, `♥ ${actor.name} healed ${healed} HP!`); narration = `${actor.name} mends their wounds, recovering ${healed} HP!`; }
      else { addLog(room, `♥ ${actor.name} tried to heal — FROZEN!`); narration = `${actor.name} reaches for healing... but it's FROZEN solid.`; }
      break;
    }
    case "shield": {
      if (actor.shield) { const h = applyHeal(room, actor, 10); addLog(room, `🛡 ${actor.name} already shielded — converted to ${h} HP heal!`); narration = `${actor.name} raises a second shield... already protected! Converts to ${h} HP.`; }
      else { actor.shield = true; addLog(room, `🛡 ${actor.name} raised a shield!`); narration = `${actor.name} conjures an iron barrier — the next attack will be nullified!`; }
      break;
    }
    case "poison_dart": {
      const d = dealDamage(room, actor, target, 10, "poison dart");
      actor.lastCardDmg = Math.max(0, d);
      if (d > 0) { target.poisoned = 8; addLog(room, `☠ ${actor.name} poisoned ${target.name}! ${d} + 8 poison next turn.`); narration = `${actor.name} fires a toxic dart! ${target.name} takes ${d} damage and is POISONED for 8 next turn!`; }
      else { addLog(room, `☠ Poison Dart — blocked! No poison applied.`); narration = `${actor.name}'s dart was blocked — no poison today!`; }
      break;
    }
    case "taunt": {
      const d = dealDamage(room, actor, target, 8, "taunt");
      actor.lastCardDmg = Math.max(0, d);
      const stunned = applyStun(room, actor, target, 1);
      if (stunned) { addLog(room, `😤 ${actor.name} taunts ${target.name}! ${actor.lastCardDmg} DMG + STUNNED!`); narration = `${actor.name} gets in ${target.name}'s face — ${actor.lastCardDmg} damage and the foe is STUNNED with rage!`; }
      else { addLog(room, `😤 ${actor.name} taunts! ${actor.lastCardDmg} DMG (stun on cooldown)`); narration = `${actor.name} hurls insults for ${actor.lastCardDmg} damage, but the stun is on cooldown!`; }
      break;
    }
    case "mana_burn": {
      if (target.hand.length > 0) {
        const ridx = Math.floor(Math.random() * target.hand.length);
        const burned = target.hand.splice(ridx, 1)[0] as CardId;
        const d = dealDamage(room, actor, target, 12, "mana burn");
        actor.lastCardDmg = Math.max(0, d);
        addLog(room, `🔥 ${actor.name} burned ${target.name}'s ${CARD_NAMES[burned]}! +${actor.lastCardDmg} DMG`);
        narration = `${actor.name} ignites ${target.name}'s ${CARD_NAMES[burned]}! Destroyed + ${actor.lastCardDmg} damage.`;
      } else { addLog(room, `🔥 Mana Burn — nothing to burn!`); narration = `${actor.name} tries to burn a card... but ${target.name} has nothing!`; }
      break;
    }
    case "ice_spike": {
      const d = dealDamage(room, actor, target, 15, "ice spike");
      actor.lastCardDmg = Math.max(0, d);
      if (d > 0) {
        const stunned = applyStun(room, actor, target, 1);
        addLog(room, `🧊 ICE SPIKE — ${d} DMG${stunned ? " + stunned 1 turn!" : " (stun on cooldown!)"}`);
        narration = stunned ? `${actor.name} launches a massive ice spike! ${target.name} takes ${d} damage and is FROZEN solid!` : `${actor.name} launches an ice spike for ${d} damage, but the stun is on cooldown!`;
      } else { addLog(room, `🧊 Ice Spike — blocked or reflected!`); narration = `${actor.name}'s ice spike shatters harmlessly!`; }
      break;
    }
    case "regen": {
      actor.regenStacks = Math.min(actor.regenStacks + 3, 6);
      addLog(room, `💚 REGEN activated — ${actor.regenStacks * 13} HP/turn!`);
      narration = `${actor.name} activates REGEN — recovering ${actor.regenStacks * 13} HP per turn!`;
      break;
    }
    case "war_cry": {
      actor.warCryBonus = 15;
      addLog(room, `📯 WAR CRY — ${actor.name}'s next attack deals +15 bonus DMG!`);
      narration = `${actor.name} lets out a WAR CRY! Their next strike will hit 15 DMG harder!`;
      break;
    }
    case "gamble": {
      if (Math.random() < 0.5) {
        const d = dealDamage(room, actor, target, 28, "gamble");
        actor.lastCardDmg = Math.max(0, d);
        addLog(room, `🎲 GAMBLED AND WON — ${actor.lastCardDmg} damage!`);
        narration = `${actor.name} rolled the dice and WON! ${target.name} takes ${actor.lastCardDmg} damage!`;
      } else {
        actor.hp = Math.max(0, actor.hp - 15);
        addLog(room, `🎲 GAMBLED AND LOST — 15 self-damage!`);
        narration = `${actor.name} rolled the dice and LOST. 15 self-damage!`;
        if (actor.hp <= 0) { endGame(room, targetToken); broadcast(room); return; }
      }
      break;
    }
    case "steal": {
      if (!target.lastCard || target.lastCard === "steal") { addLog(room, `🪞 Mirror Strike — nothing to copy!`); narration = `${actor.name} holds up the mirror... nothing to copy!`; }
      else {
        const copyId = target.lastCard;
        addLog(room, `🪞 ${actor.name} mirrors ${CARD_NAMES[copyId]}!`);
        narration = `${actor.name} mirrors ${target.name}'s ${CARD_NAMES[copyId]}!`;
        room.lastNarration = narration;
        actor.hand.unshift(copyId);
        resolveCard(room, actorToken, copyId);
        return;
      }
      break;
    }
    case "divine_shield": {
      actor.shield = true;
      const dh = applyHeal(room, actor, 15);
      addLog(room, `✦ DIVINE SHIELD — shield + ${dh} HP!`);
      narration = `${actor.name} bathes in divine light! Shield + ${dh} HP restored.`;
      break;
    }
    case "double_strike": {
      let total = 0;
      for (let i = 0; i < 2; i++) { const d = dealDamage(room, actor, target, 14, `strike ${i+1}`); if (d > 0) total += d; else break; }
      actor.lastCardDmg = total;
      if (total > 0) { addLog(room, `⚡ DOUBLE STRIKE — ${total} total!`); narration = `${actor.name} blurs into motion — striking TWICE for ${total} total damage!`; }
      else { addLog(room, `⚡ Double Strike — both hits blocked!`); narration = `${actor.name} strikes twice but both blows are stopped!`; }
      break;
    }
    case "vampire_bite": {
      const d = dealDamage(room, actor, target, 16, "vampire bite");
      actor.lastCardDmg = Math.max(0, d);
      if (d > 0) { const h = applyHeal(room, actor, Math.floor(d/2)); addLog(room, `🧛 VAMPIRE BITE — ${d} drained, +${h} HP!`); narration = `${actor.name} sinks their fangs! Drains ${d} HP and restores ${h} to themselves!`; }
      else { addLog(room, `🧛 Vampire Bite — blocked! No lifesteal.`); narration = `${actor.name}'s bite was blocked — no blood tonight!`; }
      break;
    }
    case "earthquake": {
      const d = dealDamage(room, actor, target, 24, "earthquake");
      actor.lastCardDmg = Math.max(0, d);
      actor.hp = Math.max(0, actor.hp - 8);
      if (d > 0) { addLog(room, `🌍 EARTHQUAKE — ${d} to foe, 8 self-damage!`); narration = `EARTHQUAKE! ${target.name} takes ${d} damage, but tremors deal 8 to ${actor.name} too!`; }
      else { addLog(room, `🌍 Earthquake — blocked! But 8 self-damage still hits.`); narration = `${actor.name}'s earthquake is blocked — but the tremors still hurt them for 8!`; }
      if (actor.hp <= 0) { endGame(room, targetToken); broadcast(room); return; }
      break;
    }
    case "berserker": {
      const ratio = 1 - actor.hp / actor.maxHp;
      const d = dealDamage(room, actor, target, Math.min(Math.floor(10 + ratio * 35), 45), "berserker");
      actor.lastCardDmg = Math.max(0, d);
      if (d > 0) { addLog(room, `😡 BERSERKER — ${d} rage damage!`); narration = `${actor.name} BERSERKS! The lower their HP, the harder they hit — ${d} furious damage!`; }
      else { addLog(room, `😡 Berserker — blocked!`); narration = `${actor.name} rages... but the blow is absorbed!`; }
      break;
    }
    case "ghost_step": {
      actor.shield = true;
      const d = dealDamage(room, actor, target, 12, "ghost counter");
      actor.lastCardDmg = Math.max(0, d);
      addLog(room, `👻 GHOST STEP — shield + ${actor.lastCardDmg} counter!`);
      narration = `${actor.name} phases through reality! Shield raised + ${actor.lastCardDmg} counter damage!`;
      break;
    }
    case "reflect": {
      actor.reflectActive = true;
      addLog(room, `🔮 REFLECT set — next hit bounces back!`);
      narration = `${actor.name} conjures a mystic mirror. The next attack will be REFLECTED at full power!`;
      break;
    }
    case "lucky_shot": {
      const dmg = Math.floor(Math.random() * 36) + 5;
      const d = dealDamage(room, actor, target, dmg, "lucky shot");
      actor.lastCardDmg = Math.max(0, d);
      if (d > 0) { addLog(room, `🍀 LUCKY SHOT — ${d} damage!${d >= 35 ? " INSANE!" : d <= 10 ? " Barely..." : ""}`); narration = d >= 35 ? `LUCKY SHOT hits for ${d} INSANE damage!` : d <= 10 ? `Lucky shot... barely ${d} damage. Rough.` : `Lucky shot! ${d} damage from pure chaos.`; }
      else { addLog(room, `🍀 Lucky Shot — blocked!`); narration = `Even luck can't pierce that shield!`; }
      break;
    }
    case "counter_stance": {
      actor.counterStanceActive = true;
      addLog(room, `🔄 ${actor.name} takes COUNTER STANCE — next hit reflected + 12 bonus!`);
      narration = `${actor.name} drops into a fighting stance. The next attack will be REFLECTED with a 12 damage bonus!`;
      break;
    }
    case "mana_surge": {
      actor.manaSurgeActive = true;
      addLog(room, `✨ ${actor.name} charged MANA SURGE — next card deals double + 10 bonus!`);
      narration = `${actor.name} channels raw mana — their next strike will deal DOUBLE DAMAGE plus 10 bonus!`;
      break;
    }
    case "pickpocket": {
      if (target.hand.length > 0) { const ridx = Math.floor(Math.random() * target.hand.length); const stolen = target.hand.splice(ridx, 1)[0] as CardId; actor.hand.push(stolen); addLog(room, `🤏 ${actor.name} stole ${CARD_NAMES[stolen]} from ${target.name}!`); narration = `${actor.name} slips their hand into ${target.name}'s deck and steals ${CARD_NAMES[stolen]}!`; }
      else { addLog(room, `🤏 Pickpocket — ${target.name} has no cards!`); narration = `${actor.name} tries to pickpocket... ${target.name} has nothing!`; }
      break;
    }
    case "explosion": {
      const d = dealDamage(room, actor, target, 28, "explosion");
      actor.lastCardDmg = Math.max(0, d);
      if (actor.hand.length > 0) { const ridx = Math.floor(Math.random() * actor.hand.length); const lost = actor.hand.splice(ridx, 1)[0] as CardId; addLog(room, `💣 EXPLOSION — ${actor.lastCardDmg} damage! Lost ${CARD_NAMES[lost]} from own hand.`); narration = `${actor.name} detonates for ${actor.lastCardDmg} damage! But the blast destroys ${CARD_NAMES[lost]} from their own hand!`; }
      else { addLog(room, `💣 EXPLOSION — ${actor.lastCardDmg} damage!`); narration = `${actor.name} detonates for ${actor.lastCardDmg} damage!`; }
      break;
    }
    case "shockwave": {
      // ── FIX: also check stunFlagForChain so shockwave works the turn after a stun
      const isStunned = target.skipTurns > 0 || target.stunFlagForChain;
      const totalDmg = isStunned ? 42 : 18;
      const d = dealDamage(room, actor, target, totalDmg, "shockwave");
      actor.lastCardDmg = Math.max(0, d);
      if (isStunned) { addLog(room, `🌊 SHOCKWAVE — ${actor.lastCardDmg} CRUSHING damage (foe was stunned)!`); narration = `${actor.name} sends a shockwave crashing through the stunned ${target.name}! ${actor.lastCardDmg} CRUSHING damage!`; }
      else { addLog(room, `🌊 SHOCKWAVE — ${actor.lastCardDmg} damage (no stun bonus)`); narration = `${actor.name} fires a shockwave for ${actor.lastCardDmg} damage. Would've hit harder if ${target.name} was stunned!`; }
      break;
    }
    case "chain_stun": {
      // ── FIX: the core issue — check stunFlagForChain (set when stun lands,
      //    cleared when the stunned player gets their next real turn) in addition
      //    to skipTurns. This way Chain Stun works on the VERY NEXT opponent turn
      //    even though startTurn has already consumed the skipTurns counter. ──
      const isStunned = target.skipTurns > 0 || target.stunFlagForChain;
      if (isStunned) {
        // Extend stun by 1 — bypass applyStun to avoid cooldown side effects
        target.skipTurns = Math.max(target.skipTurns, 1);
        target.stunFlagForChain = true; // keep flag alive for another round
        const d = dealDamage(room, actor, target, 22, "chain stun");
        actor.lastCardDmg = Math.max(0, d);
        addLog(room, `⛓ CHAIN STUN — foe stunned! ${actor.lastCardDmg} DMG + stun extended!`);
        narration = `${actor.name} chains the stun! ${target.name} is KEPT DOWN — ${actor.lastCardDmg} damage and their stun is extended!`;
      } else {
        const d = dealDamage(room, actor, target, 10, "chain stun");
        actor.lastCardDmg = Math.max(0, d);
        addLog(room, `⛓ Chain Stun — ${actor.lastCardDmg} DMG (no stun active)`);
        narration = `${actor.name} swings the chain for ${actor.lastCardDmg} damage. Combo with a stun first for full power!`;
      }
      break;
    }
    case "sacred_spring": {
      const h = applyHeal(room, actor, 35);
      actor.regenStacks = Math.min(actor.regenStacks + 2, 6);
      addLog(room, `🌿 SACRED SPRING — healed ${h} HP + 2 regen stacks!`);
      narration = `${actor.name} bathes in the Sacred Spring! Restored ${h} HP and gained 2 regen stacks!`;
      break;
    }
    case "cursed_blade": {
      const d = dealDamage(room, actor, target, 36, "cursed blade");
      actor.lastCardDmg = Math.max(0, d);
      addLog(room, `🩸 CURSED BLADE — ${actor.lastCardDmg} damage!`);
      narration = `${actor.name} unleashes the Cursed Blade — ${actor.lastCardDmg} devastating damage!`;
      break;
    }
    case "blood_pact": {
      actor.hp = Math.max(0, actor.hp - 10);
      if (actor.hp <= 0) { addLog(room, `🩸 BLOOD PACT — ${actor.name} bled out!`); endGame(room, targetToken); broadcast(room); return; }
      const d = dealDamage(room, actor, target, 32, "blood pact");
      actor.lastCardDmg = Math.max(0, d);
      addLog(room, `🩸 BLOOD PACT — sacrifice 10, deal ${actor.lastCardDmg}!`);
      narration = `${actor.name} seals a Blood Pact! Sacrifices 10 HP to unleash ${actor.lastCardDmg} dark damage!`;
      break;
    }
    case "soul_drain": {
      const stacks = target.regenStacks;
      if (stacks === 0) { addLog(room, `🌙 SOUL DRAIN — ${target.name} has no regen!`); narration = `${actor.name} reaches for ${target.name}'s life force... nothing to drain!`; }
      else {
        target.regenStacks = 0;
        const dmg = stacks * 8;
        const d = dealDamage(room, actor, target, dmg, "soul drain");
        actor.lastCardDmg = Math.max(0, d);
        const h = applyHeal(room, actor, dmg);
        addLog(room, `🌙 SOUL DRAIN — drained ${stacks} regen! ${actor.lastCardDmg} DMG + ${h} HP stolen!`);
        narration = `${actor.name} rips ${stacks} regen stack(s) from ${target.name}'s soul! ${actor.lastCardDmg} damage and ${h} HP stolen!`;
      }
      break;
    }
    case "cursed_heal": {
      const h1 = applyHeal(room, actor, 42); const h2 = applyHeal(room, target, 20);
      addLog(room, `💜 CURSED HEAL — +${h1} HP... but ${target.name} heals ${h2} too!`);
      narration = `${actor.name} drinks a cursed potion, healing ${h1} HP! The corruption spreads — ${target.name} also heals ${h2} HP!`;
      break;
    }
    case "betrayal": {
      const d = dealDamage(room, actor, target, 28, "betrayal");
      actor.lastCardDmg = Math.max(0, d);
      actor.hp = Math.max(0, actor.hp - 10);
      const rareCards: CardId[] = ["gamble", "divine_shield", "double_strike", "vampire_bite", "reflect", "chain_stun"];
      const gift = rareCards[Math.floor(Math.random() * rareCards.length)];
      target.hand.push(gift);
      addLog(room, `🗡 BETRAYAL — ${actor.lastCardDmg} to foe, 10 self-dmg, gave ${CARD_NAMES[gift]} to ${target.name}!`);
      narration = `${actor.name} betrays all logic! ${actor.lastCardDmg} damage, 10 self-damage, and gifts ${CARD_NAMES[gift]} to ${target.name}. Chaos!`;
      if (actor.hp <= 0) { endGame(room, targetToken); broadcast(room); return; }
      break;
    }
    case "plague": {
      actor.plagueStacks = Math.min(actor.plagueStacks + 3, 6);
      target.plagueStacks = Math.min(target.plagueStacks + 3, 6);
      addLog(room, `🦠 PLAGUE — both players infected! 8 damage/turn for 3 turns!`);
      narration = `${actor.name} releases the PLAGUE! Both players are infected — 8 damage per turn for 3 turns each!`;
      break;
    }
    case "sacrifice": {
      actor.hp = Math.max(0, actor.hp - 20);
      if (actor.hp <= 0) { addLog(room, `💀 SACRIFICE — ${actor.name} perished!`); endGame(room, targetToken); broadcast(room); return; }
      const drawn: CardId[] = [];
      for (let i = 0; i < 4; i++) drawn.push(drawOne([...actor.hand as CardId[], ...drawn]));
      actor.hand.push(...drawn);
      addLog(room, `💀 SACRIFICE — lose 20 HP, draw 4 cards!`);
      narration = `${actor.name} offers their life force! Loses 20 HP but draws 4 new cards!`;
      break;
    }
    case "hand_swap": {
      const myH = [...actor.hand]; const thH = [...target.hand];
      actor.hand = thH; target.hand = myH;
      addLog(room, `🔀 HAND SWAP — ${actor.name} swapped hands with ${target.name}!`);
      narration = `${actor.name} rips the cards from ${target.name}'s grip! HANDS SWAPPED!`;
      break;
    }
    case "cursed_mirror": {
      const effects: string[] = [];
      if (target.shield)               { actor.shield = true; effects.push("Shield"); }
      if (target.reflectActive)        { actor.reflectActive = true; effects.push("Reflect"); }
      if (target.counterStanceActive)  { actor.counterStanceActive = true; effects.push("Counter Stance"); }
      if (target.manaSurgeActive)      { actor.manaSurgeActive = true; effects.push("Mana Surge"); }
      if (target.warCryBonus > 0)      { actor.warCryBonus = Math.max(actor.warCryBonus, target.warCryBonus); effects.push(`War Cry+${target.warCryBonus}`); }
      if (target.regenStacks > 0)      { actor.regenStacks = Math.max(actor.regenStacks, target.regenStacks); effects.push(`Regen×${target.regenStacks}`); }
      if (target.darkMatterStacks > 0) { actor.darkMatterStacks = Math.max(actor.darkMatterStacks, target.darkMatterStacks); effects.push(`Dark Matter×${target.darkMatterStacks}`); }
      if (target.poisoned > 0)         { actor.poisoned = Math.max(actor.poisoned, target.poisoned); effects.push(`Poison`); }
      if (target.plagueStacks > 0)     { actor.plagueStacks = Math.max(actor.plagueStacks, target.plagueStacks); effects.push(`Plague`); }
      if (effects.length === 0) { addLog(room, `🪟 CURSED MIRROR — nothing to copy!`); narration = `${actor.name} holds up the Cursed Mirror... ${target.name} has nothing to copy!`; }
      else { addLog(room, `🪟 CURSED MIRROR — copied: ${effects.join(", ")}!`); narration = `${actor.name} gazes into the Cursed Mirror! Copied: ${effects.join(", ")}!`; }
      break;
    }
    case "curse_tax": {
      if (target.hand.length === 0) { addLog(room, `💸 CURSE TAX — nothing to destroy!`); narration = `${actor.name} reaches for the Curse Tax... ${target.name} has nothing!`; }
      else {
        const ridx = Math.floor(Math.random() * target.hand.length);
        const destroyed = target.hand.splice(ridx, 1)[0] as CardId;
        const rarity = CARD_RARITIES[destroyed] ?? "common";
        const h = applyHeal(room, actor, RARITY_HEAL[rarity] ?? 5);
        addLog(room, `💸 CURSE TAX — destroyed ${CARD_NAMES[destroyed]} (${rarity}), healed ${h} HP!`);
        narration = `${actor.name} collects the Curse Tax! Destroys ${target.name}'s ${CARD_NAMES[destroyed]} and siphons ${h} HP!`;
      }
      break;
    }
    case "blood_transfusion": {
      const steal = Math.min(30, target.hp);
      target.hp = Math.max(0, target.hp - steal);
      const h = applyHeal(room, actor, steal);
      addLog(room, `🩺 BLOOD TRANSFUSION — stole ${steal} HP! Gained ${h} HP.`);
      narration = `${actor.name} performs a dark BLOOD TRANSFUSION! Rips ${steal} HP from ${target.name}'s veins and absorbs ${h} HP!`;
      if (target.hp <= 0) { endGame(room, actorToken); broadcast(room); return; }
      break;
    }
    case "freeze": {
      const d = dealDamage(room, actor, target, 28, "freeze");
      actor.lastCardDmg = Math.max(0, d);
      target.healBlocked = 3;
      addLog(room, `❄ FREEZE — ${actor.lastCardDmg} damage + healing BLOCKED for 3 turns!`);
      narration = `${actor.name} encases ${target.name} in cosmic ice — ${actor.lastCardDmg} damage and their healing is FROZEN for 3 turns!`;
      break;
    }
    case "divine_retribution": {
      let total = 0;
      const d1 = dealDamage(room, actor, target, 20, "first smite");
      if (d1 > 0) {
        total += d1; addLog(room, `⚖ DIVINE RETRIBUTION — First smite: ${d1}!`);
        const d2 = dealDamage(room, actor, target, 20, "second smite");
        if (d2 > 0) { total += d2; const s = applyStun(room, actor, target, 1); addLog(room, `⚖ Second smite: ${d2}!${s ? " + STUN!" : " (stun on CD)"}`); narration = `${actor.name} calls down DIVINE RETRIBUTION! Two holy smites for ${total} total!${s ? " Second blow STUNS!" : ""}`; }
        else { addLog(room, `⚖ Second smite blocked!`); narration = `${actor.name} calls down DIVINE RETRIBUTION! First smite: ${d1}, second blocked!`; }
      } else { addLog(room, `⚖ DIVINE RETRIBUTION — blocked!`); narration = `${actor.name} calls down DIVINE RETRIBUTION — shut down!`; }
      actor.lastCardDmg = total;
      break;
    }
    case "titans_wrath": {
      const diff = Math.abs(actor.hp - target.hp);
      const d = dealDamage(room, actor, target, Math.min(Math.max(8, diff), 60), "titan's wrath");
      actor.lastCardDmg = Math.max(0, d);
      addLog(room, `🔱 TITAN'S WRATH — ${actor.lastCardDmg} damage (HP diff: ${diff})!`);
      narration = `${actor.name} channels TITAN'S WRATH! Deals ${actor.lastCardDmg} damage — the greater the HP gap, the harder the strike!`;
      break;
    }
    case "last_stand": {
      if (actor.hp <= 40) { const d = dealDamage(room, actor, target, 55, "last stand"); actor.lastCardDmg = Math.max(0, d); actor.shield = true; addLog(room, `🛡 LAST STAND — ${actor.lastCardDmg} MASSIVE damage + shield!`); narration = `${actor.name} is on the brink! LAST STAND — ${actor.lastCardDmg} MASSIVE damage AND a shield!`; }
      else { const d = dealDamage(room, actor, target, 5, "last stand"); actor.lastCardDmg = Math.max(0, d); addLog(room, `🛡 Last Stand... only 5 damage (HP too high)`); narration = `${actor.name} plays Last Stand... HP too high! Only 5 damage.`; }
      break;
    }
    case "lightning_storm": {
      const hits: string[] = []; let stormTotal = 0;
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.70) { const d = dealDamage(room, actor, target, 14, "bolt"); if (d > 0) { stormTotal += d; hits.push(`${d} to ${target.name}`); } else hits.push("blocked!"); }
        else { actor.hp = Math.max(0, actor.hp - 5); hits.push(`5 backfire!`); }
      }
      actor.lastCardDmg = stormTotal;
      addLog(room, `⛈ LIGHTNING STORM: ${hits.join(", ")}`);
      narration = `${actor.name} summons a LIGHTNING STORM! Three chaotic bolts — ${hits.join(", ")}!`;
      if (actor.hp <= 0) { endGame(room, targetToken); broadcast(room); return; }
      break;
    }
    case "meteor": {
      const d = dealDamage(room, actor, target, 48, "meteor", true);
      actor.lastCardDmg = Math.max(0, d); actor.hp = Math.max(0, actor.hp - 18);
      if (d > 0) { addLog(room, `☄ METEOR — ${d} damage (bypasses shields)! 18 recoil.`); narration = `${actor.name} calls down a METEOR! ${d} catastrophic damage — shields useless! 18 recoil SHATTERS ${actor.name}!`; }
      else { addLog(room, `☄ Meteor — 18 self-damage taken.`); narration = `${actor.name} calls down a meteor... absorbed! Still takes 18 recoil.`; }
      if (actor.hp <= 0) { endGame(room, targetToken); broadcast(room); return; }
      break;
    }
    case "overflow": {
      const drawn: CardId[] = [];
      for (let i = 0; i < 5; i++) drawn.push(drawOne([...actor.hand as CardId[], ...drawn]));
      actor.hand.push(...drawn); actor.overflowDiscard = 1; actor.overflowCount = 5;
      addLog(room, `🃏 OVERFLOW — drew 5 cards! Will discard 5 next turn.`);
      narration = `${actor.name} channels cosmic overflow — draws 5 cards! Universe balances — 5 discarded next turn!`;
      break;
    }
    case "echo_strike": {
      if (!actor.lastCard || prevCardDmg <= 0) { addLog(room, `🔁 ECHO STRIKE — no previous damage!`); narration = `${actor.name} tries to echo their last strike... nothing to repeat!`; }
      else {
        const d = dealDamage(room, actor, target, prevCardDmg, "echo strike");
        actor.lastCardDmg = Math.max(0, d);
        addLog(room, `🔁 ECHO STRIKE — echoes ${CARD_NAMES[actor.lastCard]} for ${actor.lastCardDmg} damage!`);
        narration = `${actor.name} channels an ECHO STRIKE! Replays the raw power of ${CARD_NAMES[actor.lastCard!]} for ${actor.lastCardDmg} damage!`;
      }
      break;
    }
    case "celestial_mend": {
      const cleansed: string[] = [];
      if (actor.poisoned > 0) { actor.poisoned = 0; cleansed.push("Poison"); }
      if (actor.plagueStacks > 0) { actor.plagueStacks = 0; cleansed.push("Plague"); }
      if (actor.healBlocked > 0) { actor.healBlocked = 0; cleansed.push("Heal Block"); }
      if (actor.skipTurns > 0) { actor.skipTurns = 0; cleansed.push("Stun"); }
      if (actor.neutronStarTicks > 0) { actor.neutronStarTicks = 0; cleansed.push("Neutron Star"); }
      const h = applyHeal(room, actor, 70);
      addLog(room, `✨ CELESTIAL MEND — +${h} HP!${cleansed.length ? " Cleansed: " + cleansed.join(", ") + "!" : ""}`);
      narration = cleansed.length ? `${actor.name} calls upon celestial power! Healed ${h} HP and purged ${cleansed.join(", ")}!` : `${actor.name} is bathed in celestial light — healed ${h} HP!`;
      break;
    }
    case "soul_swap": {
      const myHp = actor.hp; const thHp = target.hp;
      actor.hp = Math.min(actor.maxHp, thHp); target.hp = Math.min(target.maxHp, myHp);
      addLog(room, `👁 SOUL SWAP — HP swapped! ${actor.name}: ${actor.hp}, ${target.name}: ${target.hp}`);
      narration = `${actor.name} rips the souls from their bodies — HP SWAPPED!`;
      break;
    }
    case "armageddon": {
      actor.shield = false; target.shield = false;
      actor.hp = Math.max(0, actor.hp - 38); target.hp = Math.max(0, target.hp - 38);
      addLog(room, `💥 ARMAGEDDON — both take 38 damage! No shields!`);
      narration = `${actor.name} triggers ARMAGEDDON! BOTH players take 38 damage! Shields are useless!`;
      if (checkDeath(room, actorToken, targetToken)) { broadcast(room); return; }
      break;
    }
    case "void_rift": {
      actor.hand = drawHand(3); target.hand = drawHand(3);
      addLog(room, `🌀 VOID RIFT — all hands destroyed! Both redraw 3 cards!`);
      narration = `${actor.name} tears open a VOID RIFT! Both hands consumed — each player redraws 3 fresh cards!`;
      break;
    }
    case "judgement": {
      if (target.hp <= 30) { endGame(room, actorToken); addLog(room, `⚖ JUDGEMENT — ${target.name} had ≤30 HP. INSTANT WIN!`); narration = `${actor.name} passes JUDGEMENT! ${target.name} had only ${target.hp} HP — INSTANTLY DEFEATED!`; broadcast(room); return; }
      else { const d = dealDamage(room, actor, target, 5, "judgement"); actor.lastCardDmg = Math.max(0, d); addLog(room, `⚖ Judgement... only 5 damage (${target.name} has ${target.hp} HP > 30)`); narration = `${actor.name} tries Judgement... ${target.name} has ${target.hp} HP — too healthy! Only 5 damage.`; }
      break;
    }
    case "time_warp": {
      actor.extraTurn = true; actor.extraTurnDebt = 2; actor.warpTurnsLeft = 2;
      addLog(room, `⏳ TIME WARP — ${actor.name} gets 2 extra turns! Debt: skip 2 later.`);
      narration = `${actor.name} warps time! 2 extra turns NOW... but will owe 2 skipped turns afterward!`;
      break;
    }
    case "phoenix_ember": {
      if (actor.hp <= 25) {
        const old = actor.hp; actor.hp = Math.min(actor.maxHp, 70); actor.shield = true;
        actor.poisoned = 0; actor.plagueStacks = 0; actor.healBlocked = 0; actor.skipTurns = 0; actor.neutronStarTicks = 0;
        addLog(room, `🔥 PHOENIX EMBER — risen from ${old} HP to ${actor.hp}! Shield + debuffs purged!`);
        narration = `${actor.name} was nearly dead at ${old} HP... the PHOENIX RISES! Restored to ${actor.hp} HP, shield raised, all debuffs purged!`;
      } else { const h = applyHeal(room, actor, 22); addLog(room, `🔥 Phoenix Ember — healed ${h} HP.`); narration = `${actor.name} uses Phoenix Ember... too healthy for resurrection. ${h} HP restored.`; }
      break;
    }
    case "singularity": {
      const avg = Math.floor((actor.hp + target.hp) / 2);
      const ao = actor.hp; const to = target.hp;
      actor.hp = Math.min(actor.maxHp, avg); target.hp = Math.min(target.maxHp, avg);
      addLog(room, `🕳 SINGULARITY — HP equalized to ${avg}!`);
      narration = ao > to ? `${actor.name} collapses space-time into a SINGULARITY! HP equalized at ${avg} — brutal for ${actor.name}!` : `${actor.name} collapses the singularity... equalized at ${avg} HP.`;
      break;
    }
    case "dark_matter": {
      actor.darkMatterStacks = 3;
      addLog(room, `🫧 DARK MATTER — ${actor.name} protected! Next 3 attacks deal 0!`);
      narration = `${actor.name} wraps themselves in DARK MATTER! The next 3 attacks will be completely nullified!`;
      break;
    }
    case "event_horizon": {
      actor.eventHorizonActive = true;
      addLog(room, `🌑 EVENT HORIZON — ${actor.name} ready! Next attack collapses back!`);
      narration = `${actor.name} bends space! The next attack aimed at them will collapse inward — hitting the attacker instead!`;
      break;
    }
    case "neutron_star": {
      const d = dealDamage(room, actor, target, 18, "neutron star");
      actor.lastCardDmg = Math.max(0, d); target.neutronStarTicks = 3;
      addLog(room, `⭐ NEUTRON STAR — ${actor.lastCardDmg} now + 12/turn for 3 turns!`);
      narration = `${actor.name} launches a NEUTRON STAR! ${actor.lastCardDmg} immediate damage + 12 radiation each of ${target.name}'s next 3 turns!`;
      break;
    }
    case "void_pulse": {
      let ec = 0;
      if (target.poisoned > 0) ec++; if (target.plagueStacks > 0) ec++; if (target.skipTurns > 0) ec++;
      if (target.neutronStarTicks > 0) ec++; if (target.eventHorizonActive) ec++; if (target.darkMatterStacks > 0) ec++;
      if (target.taunted) ec++; if (target.healBlocked > 0) ec++;
      const vpD = Math.max(10, ec * 8);
      const d = dealDamage(room, actor, target, vpD, "void pulse");
      actor.lastCardDmg = Math.max(0, d);
      addLog(room, `🔵 VOID PULSE — ${ec} effect(s) × 8 = ${actor.lastCardDmg} damage!`);
      narration = ec >= 3 ? `${actor.name} fires a VOID PULSE! ${target.name} had ${ec} debuffs — ${actor.lastCardDmg} CRUSHING damage!` : `${actor.name} fires a Void Pulse for ${actor.lastCardDmg} damage. Stack more debuffs for maximum pain!`;
      break;
    }
  }

  room.lastNarration = narration;
  if (checkDeath(room, actorToken, targetToken)) { broadcast(room); return; }
  replenishCard(actor);

  if (actor.extraTurn) {
    actor.extraTurn = false;
    if (actor.warpTurnsLeft > 0) {
      actor.warpTurnsLeft--;
      if (actor.warpTurnsLeft > 0) actor.extraTurn = true;
      addLog(room, `⏳ ${actor.name} takes an extra TIME WARP turn! (${actor.warpTurnsLeft} left)`);
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
      player.socketId = socket.id; player.connected = true;
      socket.join(roomId); addLog(room, `${player.name} reconnected!`); broadcast(room); return;
    }

    if (tokens.length >= 2) { socket.emit("roomFull"); return; }

    const player: Player = {
      socketId: socket.id, sessionToken,
      name: preferredName.slice(0, 16),
      hp: 100, maxHp: 100,
      shield: false, reflectActive: false, counterStanceActive: false,
      manaSurgeActive: false, warCryBonus: 0,
      poisoned: 0, regenStacks: 0, plagueStacks: 0,
      skipTurns: 0, taunted: false, extraTurn: false, extraTurnDebt: 0, warpTurnsLeft: 0,
      stunsSuffered: 0, stunCooldown: 0, stunFlagForChain: false,
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
      room.turnStartTime = Date.now();
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

  socket.on("drawCard", () => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token) continue;
      if (room.gameOver || room.turn !== token) return;
      const player = room.players[token];
      const oppToken = getOpponentToken(room, token);
      if (player.hand.length >= 8) {
        addLog(room, `🃏 ${player.name}'s hand is full — turn passed!`);
        room.lastNarration = `${player.name} tries to draw but their hand is full! Turn wasted.`;
      } else {
        const drawn = drawOne(player.hand as CardId[]);
        player.hand.push(drawn);
        addLog(room, `🃏 ${player.name} draws ${CARD_NAMES[drawn]} and passes their turn!`);
        room.lastNarration = `${player.name} draws ${CARD_NAMES[drawn]} instead of acting — turn passes!`;
      }
      if (oppToken) startTurn(room, oppToken);
      broadcast(room);
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
      if (oppToken) endGame(room, oppToken); else room.gameOver = true;
      broadcast(room); return;
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
          p.skipTurns = 0; p.taunted = false; p.extraTurn = false; p.extraTurnDebt = 0; p.warpTurnsLeft = 0;
          p.stunsSuffered = 0; p.stunCooldown = 0; p.stunFlagForChain = false;
          p.darkMatterStacks = 0; p.eventHorizonActive = false; p.neutronStarTicks = 0;
          p.healBlocked = 0; p.overflowDiscard = 0; p.overflowCount = 0;
          p.lastCard = null; p.lastCardDmg = 0;
          p.hand = drawHand(5); p.rematchReady = false;
        });
        room.gameOver = false; room.winnerId = null; room.isDraw = false;
        room.log = []; room.lastNarration = "";
        room.turn = tokens[Math.floor(Math.random() * 2)];
        room.turnStartTime = Date.now();
        addLog(room, "★ REMATCH — FIGHT!");
      }
      broadcast(room); return;
    }
  });

  socket.on("getLeaderboard", async () => { socket.emit("leaderboard", await getLeaderboard()); });

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
      broadcast(room); return;
    }
  });
});

initDB().then(() => {
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  httpServer.listen(PORT, () => console.log(`✅ Server running on :${PORT}`));
}).catch(err => { console.error("DB init failed:", err); process.exit(1); });