import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { CARD_DEFS, RARITY_COLORS, RARITY_LABELS, type CardId, type Rarity, type CardDef } from "./cardDefs";
import { toggleSound, isSoundOn, playTick, playCardPlay, playModalOpen, playModalClose, playVictory, playDefeat, playWhoosh } from "./audio";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerState {
  socketId: string;
  sessionToken: string;
  name: string;
  hp: number;
  maxHp: number;
  shield: boolean;
  reflectActive: boolean;
  poisoned: number;
  regenStacks: number;
  skipTurns: number;
  skipNextTurn: boolean;
  taunted: boolean;
  extraTurn: boolean;
  extraTurnDebt: number;
  counterStanceActive: boolean;
  manaSurgeActive: boolean;
  plagueStacks: number;
  stunsSuffered: number;
  stunCooldown: number;
  darkMatterStacks: number;
  eventHorizonActive: boolean;
  neutronStarTicks: number;
  healBlocked: number;
  overflowDiscard: number;
  overflowCount: number;
  lastCard: CardId | null;
  hand: (CardId | "???")[];
  rematchReady: boolean;
  connected: boolean;
}

interface GameState {
  players: Record<string, PlayerState>;
  myToken: string;
  turn: string | null;
  log: string[];
  gameOver: boolean;
  winnerId: string | null;
  roomId: string;
  lastNarration: string;
}

interface LeaderboardEntry {
  sessionToken: string;
  name: string;
  wins: number;
  losses: number;
}

// ─── Session helpers ──────────────────────────────────────────────────────────
function getOrCreateSession(): string {
  let token = localStorage.getItem("kramkard_session");
  if (!token) { token = crypto.randomUUID(); localStorage.setItem("kramkard_session", token); }
  return token;
}
function getRoomIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("room");
}
function createRoomCode(): string {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const url = new URL(window.location.href);
  url.searchParams.set("room", code);
  window.history.replaceState({}, "", url.toString());
  return code;
}
function joinRoomCode(code: string): string {
  const upper = code.trim().toUpperCase();
  const url = new URL(window.location.href);
  url.searchParams.set("room", upper);
  window.history.replaceState({}, "", url.toString());
  return upper;
}

// ─── Mobile detection hook ────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── Starfield ────────────────────────────────────────────────────────────────
function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.25 + 0.04,
      flicker: Math.random() * Math.PI * 2,
    }));
    const pixels = Array.from({ length: 25 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      size: Math.floor(Math.random() * 3) + 1,
      color: ["#a55eea", "#45aaf2", "#fc5c65", "#f9ca24"][Math.floor(Math.random() * 4)],
      speed: Math.random() * 0.12 + 0.02,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.flicker += 0.018;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(s.flicker) * 0.3})`;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.ceil(s.r), Math.ceil(s.r));
        s.y += s.speed;
        if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
      });
      pixels.forEach(p => {
        ctx.fillStyle = p.color + "88";
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size * 2, p.size * 2);
        p.y += p.speed;
        if (p.y > canvas.height) { p.y = 0; p.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />;
}

// ─── RARITY order for compendium ─────────────────────────────────
const RARITY_ORDER = ["common","uncommon","rare","cursed","corrupted","legendary","mythic","void"] as const;

// ─── Lobby ────────────────────────────────────────────────────────────────────
function Lobby({ onEnter, leaderboard, fetchLeaderboard }: { onEnter: (code: string) => void; leaderboard: LeaderboardEntry[]; fetchLeaderboard: () => void; }) {
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"main" | "join" | "created">("main");
  const [error, setError] = useState("");
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"play" | "scores" | "cards">("play"); 
  const [rarityFilter, setRarityFilter] = useState<string>("all");       
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null); 
  const isMobile = useIsMobile();                                        

  function handleCreate() { const code = createRoomCode(); setCreatedCode(code); setMode("created"); }
  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setError("INVALID CODE"); return; }
    onEnter(joinRoomCode(code));
  }
  function handleCopyCode() {
    const url = `${window.location.origin}${window.location.pathname}?room=${createdCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const cornerStyle = (v: string, h: string): React.CSSProperties => ({
    position: "absolute", [v]: -3, [h]: -3, width: 10, height: 10,
    background: "#f9ca24", boxShadow: "0 0 8px #f9ca24, 0 0 16px #f9ca2466",
  });

  // Filtered cards for compendium
  const allCardIds = Object.keys(CARD_DEFS) as CardId[];
  const filteredCards = rarityFilter === "all"
    ? allCardIds
    : allCardIds.filter(id => CARD_DEFS[id].rarity === rarityFilter);

  const selectedDef = selectedCard ? CARD_DEFS[selectedCard] : null;

return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Press Start 2P', monospace", padding: isMobile ? 10 : 20, overflowY:"auto" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:1, background:"repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)" }} />

      <div style={{ position:"relative", zIndex:2, background:"linear-gradient(160deg,#07070f 0%,#0b0b18 60%,#080812 100%)", border:"2px solid #f9ca24", width:"100%", maxWidth: isMobile ? "100%" : 660, boxShadow:"0 0 0 1px #f9ca2422,0 0 40px #f9ca2418,inset 0 0 60px #00000066", overflow:"hidden", marginTop: isMobile ? 40 : 0 }}>
        <div style={{ position:"absolute", top:-3, left:-3, width:10, height:10, background:"#f9ca24", boxShadow:"0 0 8px #f9ca24" }} />
        <div style={{ position:"absolute", top:-3, right:-3, width:10, height:10, background:"#f9ca24", boxShadow:"0 0 8px #f9ca24" }} />
        <div style={{ position:"absolute", bottom:-3, left:-3, width:10, height:10, background:"#f9ca24", boxShadow:"0 0 8px #f9ca24" }} />
        <div style={{ position:"absolute", bottom:-3, right:-3, width:10, height:10, background:"#f9ca24", boxShadow:"0 0 8px #f9ca24" }} />
        <div style={{ height:3, background:"linear-gradient(90deg,transparent,#f9ca24,#a55eea,#45aaf2,transparent)" }} />

        {/* Header */}
        <div style={{ textAlign:"center", padding: isMobile ? "20px 20px 14px" : "28px 40px 18px" }}>
          <div style={{ fontSize:8, color:"#a55eea", letterSpacing:5, marginBottom:8, animation:"blink 2s step-end infinite" }}>★ COSMIC ARENA ★</div>
          <div style={{ fontSize: isMobile ? 28 : 36, color:"#f9ca24", letterSpacing:6, textShadow:"0 0 12px #f9ca24aa,0 0 30px #f9ca2444", marginBottom:6 }}>KRAM KARD</div>
          <div style={{ display:"flex", justifyContent:"center", gap:3, marginBottom:4 }}>
            {["#f9ca24","#fc5c65","#26de81","#45aaf2","#a55eea","#45aaf2","#26de81","#fc5c65","#f9ca24"].map((c,i)=>(
              <div key={i} style={{ width:4, height:4, background:c, opacity:0.6 }}/>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex", borderTop:"1px solid #1a1a2e", borderBottom:"1px solid #1a1a2e" }}>
          {(["play","scores","cards"] as const).map(t => {
            const labels = { play:"⚔ PLAY", scores:"★ SCORES", cards:"📖 CARDS" };
            const colors = { play:"#f9ca24", scores:"#a55eea", cards:"#45aaf2" };
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex:1, background:active?`${colors[t]}11`:"transparent", border:"none", borderBottom:active?`2px solid ${colors[t]}`:"2px solid transparent", color:active?colors[t]:"#333", padding: isMobile ? "10px 4px" : "12px 8px", fontSize: isMobile ? 5 : 6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1, transition:"all 0.15s", marginBottom:-1 }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* PLAY TAB */}
        {tab === "play" && (
          <div style={{ padding: isMobile ? "20px 16px 28px" : "28px 40px 36px", display:"flex", flexDirection:"column", alignItems:"center" }}>
            {mode === "main" && (<>
              <div style={{ fontSize:6, color:"#444", letterSpacing:3, marginBottom:20 }}>— SELECT MODE —</div>
              <button onClick={handleCreate} onMouseEnter={()=>setHoveredBtn("create")} onMouseLeave={()=>setHoveredBtn(null)}
                style={{ width:"100%", background:hoveredBtn==="create"?"linear-gradient(135deg,#f9ca2418,#f9ca2408)":"transparent", border:`2px solid ${hoveredBtn==="create"?"#f9ca24":"#f9ca2477"}`, color:"#f9ca24", padding:"16px 0", fontSize:10, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:2, marginBottom:18, transition:"all 0.12s", boxShadow:hoveredBtn==="create"?"0 0 16px #f9ca2433,inset 0 0 20px #f9ca2408":"none" }}>
                <span style={{ marginRight:8, fontSize:10 }}>✦</span>CREATE ROOM
              </button>
              <button onClick={()=>{setMode("join");setError("");}} onMouseEnter={()=>setHoveredBtn("join")} onMouseLeave={()=>setHoveredBtn(null)}
                style={{ width:"100%", background:hoveredBtn==="join"?"linear-gradient(135deg,#45aaf218,#45aaf208)":"transparent", border:`2px solid ${hoveredBtn==="join"?"#45aaf2":"#45aaf277"}`, color:"#45aaf2", padding:"16px 0", fontSize:8, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:2, transition:"all 0.12s", boxShadow:hoveredBtn==="join"?"0 0 16px #45aaf233,inset 0 0 20px #45aaf208":"none" }}>
                <span style={{ marginRight:8 }}>▶</span>JOIN ROOM
              </button>
            </>)}

            {mode === "created" && (<>
              <div style={{ fontSize:6, color:"#26de81", letterSpacing:3, marginBottom:20, textAlign:"center" }}>✓ ROOM CREATED!</div>
              <div style={{ width:"100%", background:"#050510", border:"2px solid #f9ca24", boxShadow:"0 0 24px #f9ca2433", padding:"18px 0", textAlign:"center", marginBottom:12 }}>
                <div style={{ fontSize:6, color:"#666", letterSpacing:2, marginBottom:8 }}>ROOM CODE</div>
                <div style={{ fontSize: isMobile ? 24 : 30, color:"#f9ca24", letterSpacing:10, textShadow:"0 0 14px #f9ca24bb,0 0 30px #f9ca2444" }}>{createdCode}</div>
              </div>
              <button onClick={handleCopyCode} style={{ width:"100%", background:copied?"#26de8118":"transparent", border:`1px solid ${copied?"#26de81":"#45aaf255"}`, color:copied?"#26de81":"#45aaf2", padding:"10px 0", fontSize:6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1, marginBottom:18, transition:"all 0.15s" }}>
                {copied?"✓ LINK COPIED!":"⎘  COPY INVITE LINK"}
              </button>
              <div style={{ fontSize:6, color:"#444", lineHeight:2.4, textAlign:"center", marginBottom:20 }}>Share the code or link<br/>with your friend, then<br/>click below to wait for them.</div>
              <button onClick={()=>onEnter(createdCode)} onMouseEnter={()=>setHoveredBtn("go")} onMouseLeave={()=>setHoveredBtn(null)}
                style={{ width:"100%", background:hoveredBtn==="go"?"#f9ca2418":"transparent", border:`2px solid ${hoveredBtn==="go"?"#f9ca24":"#f9ca2477"}`, color:"#f9ca24", padding:"14px 0", fontSize:8, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:2, transition:"all 0.12s", boxShadow:hoveredBtn==="go"?"0 0 16px #f9ca2433":"none" }}>
                ENTER ROOM ▶
              </button>
            </>)}

            {mode === "join" && (<>
              <div style={{ fontSize:6, color:"#45aaf2", letterSpacing:3, marginBottom:20, textAlign:"center" }}>— ENTER ROOM CODE —</div>
              <div style={{ position:"relative", width:"100%", marginBottom:8 }}>
                <input value={joinCode} onChange={e=>{setJoinCode(e.target.value.slice(0,6));setError("");}}
                  onKeyDown={e=>e.key==="Enter"&&handleJoin()} autoFocus maxLength={6} placeholder="X7K2PQ"
                  style={{ display:"block", width:"100%", boxSizing:"border-box", background:"#050510", border:`2px solid ${error?"#fc5c65":"#45aaf255"}`, color:"#fff", padding:"14px 16px", fontSize:18, fontFamily:"'Press Start 2P',monospace", outline:"none", textTransform:"uppercase", letterSpacing:8, textAlign:"center", caretColor:"#45aaf2" }}/>
              </div>
              {error?<div style={{ fontSize:6, color:"#fc5c65", marginBottom:16, letterSpacing:1 }}>{error}</div>:<div style={{ height:22, marginBottom:16 }}/>}
              <div style={{ display:"flex", gap:12, width:"100%" }}>
                <button onClick={()=>{setMode("main");setJoinCode("");setError("");}} style={{ flex:1, background:"transparent", border:"1px solid #333", color:"#555", padding:"12px 0", fontSize:6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>◀ BACK</button>
                <button onClick={handleJoin} onMouseEnter={()=>setHoveredBtn("enter")} onMouseLeave={()=>setHoveredBtn(null)}
                  style={{ flex:2, background:hoveredBtn==="enter"?"#45aaf218":"transparent", border:`2px solid ${hoveredBtn==="enter"?"#45aaf2":"#45aaf277"}`, color:"#45aaf2", padding:"12px 0", fontSize:7, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:2, transition:"all 0.12s" }}>ENTER ▶</button>
              </div>
            </>)}
          </div>
        )}

        {/* SCORES TAB */}
        {tab === "scores" && (
          <div style={{ padding: isMobile ? "16px 12px 24px" : "20px 28px 28px", minHeight:200 }}>
            <div style={{ fontSize:6, color:"#a55eea", letterSpacing:3, marginBottom:16, textAlign:"center" }}>— TOP WARRIORS —</div>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign:"center", fontSize:6, color:"#333", padding:"30px 0", animation:"blink 1s step-end infinite" }}>▓ LOADING... ▓</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <div style={{ display:"flex", padding:"6px 8px", borderBottom:"1px solid #1a1a2e", marginBottom:4 }}>
                  <span style={{ fontSize:7, color:"#333", width:24 }}>#</span>
                  <span style={{ fontSize:7, color:"#333", flex:1 }}>NAME</span>
                  <span style={{ fontSize:7, color:"#333", width:40, textAlign:"right" }}>W</span>
                  <span style={{ fontSize:7, color:"#333", width:40, textAlign:"right" }}>L</span>
                  <span style={{ fontSize:7, color:"#333", width:48, textAlign:"right" }}>RATE</span>
                </div>
                {leaderboard.map((e, i) => {
                  const total = e.wins + e.losses;
                  const rate = total > 0 ? Math.round((e.wins / total) * 100) : 0;
                  const rankColor = i === 0 ? "#f9ca24" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#444";
                  const medals = ["👑","🥈","🥉"];
                  return (
                    <div key={e.sessionToken} style={{ display:"flex", alignItems:"center", padding:"8px", background:i%2===0?"#ffffff04":"transparent", borderLeft:`2px solid ${rankColor}22` }}>
                      <span style={{ fontSize:i<3?9:6, width:24, color:rankColor }}>{i<3?medals[i]:i+1}</span>
                      <span style={{ fontSize:8, flex:1, color:i<3?"#ddd":"#777", letterSpacing:0.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.name.toUpperCase()}</span>
                      <span style={{ fontSize:6, width:50, textAlign:"right", color:"#26de81" }}>{e.wins}</span>
                      <span style={{ fontSize:6, width:50, textAlign:"right", color:"#fc5c65" }}>{e.losses}</span>
                      <span style={{ fontSize:6, width:56, textAlign:"right", color:rate>=60?"#f9ca24":rate>=40?"#aaa":"#555" }}>{rate}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={fetchLeaderboard} style={{ marginTop:16, width:"100%", background:"transparent", border:"1px solid #a55eea44", color:"#444", padding:"8px", fontSize:6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>↺ REFRESH</button>
          </div>
        )}

        {/* CARDS TAB */}
        {tab === "cards" && (
          <div style={{ padding: isMobile ? "12px 10px 20px" : "16px 20px 24px", maxHeight: isMobile ? "85vh" : "70vh", overflowY: "auto" }}>
            <div style={{ fontSize:8, color:"#45aaf2", letterSpacing:3, marginBottom:12, textAlign:"center" }}>— CARD COMPENDIUM —</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, justifyContent:"center", marginBottom:14 }}>
              {(["all", ...RARITY_ORDER] as const).map(r => {
                const color = r === "all" ? "#888" : RARITY_COLORS[r as Rarity];
                const active = rarityFilter === r;
                return (
                  <button key={r} onClick={()=>setRarityFilter(r)}
                    style={{ background:active?`${color}22`:"transparent", border:`1px solid ${active?color:color+"44"}`, color:active?color:color+"88", padding: isMobile ? "4px 7px" : "4px 10px", fontSize: isMobile ? 6 : 7, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:0.5, transition:"all 0.12s" }}>
                    {r === "all" ? "ALL" : RARITY_LABELS[r as Rarity]}
                  </button>
                );
              })}
            </div>
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: isMobile ? 8 : 10, maxHeight: isMobile ? "38vh" : "42vh", overflowY:"auto", paddingRight:4 }}>
              {(rarityFilter === "all" ? Object.keys(CARD_DEFS) as CardId[] : (Object.keys(CARD_DEFS) as CardId[]).filter(id => CARD_DEFS[id].rarity === rarityFilter)).map(id => {
                const def = CARD_DEFS[id];
                const isSelected = selectedCard === id;
                return (
                  <button key={id} onClick={()=>setSelectedCard(isSelected?null:id)}
                    style={{ background:isSelected?`${def.color}18`:def.bgColor, border:`1.5px solid ${isSelected?def.color:def.color+"55"}`, padding: isMobile ? "8px 4px" : "10px 6px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.12s", boxShadow:isSelected?`0 0 10px ${def.glowColor}55`:"none", fontFamily:"'Press Start 2P',monospace" }}>
                    <span style={{ fontSize: isMobile ? 24 : 26, filter:`drop-shadow(0 0 4px ${def.glowColor})` }}>{def.icon}</span>
                    <span style={{ fontSize: isMobile ? 6 : 6 , color:def.color, lineHeight:1.6, textAlign:"center", letterSpacing:0.3 }}>{def.name}</span>
                    <span style={{ fontSize: isMobile ? 5 : 5, color:RARITY_COLORS[def.rarity], letterSpacing:0.5 }}>{RARITY_LABELS[def.rarity]}</span>
                  </button>
                );
              })}
            </div>
            {selectedCard && CARD_DEFS[selectedCard] && (
              <div style={{ marginTop:12, background:"#050510", border:`2px solid ${CARD_DEFS[selectedCard].color}`, padding: isMobile ? "12px" : "16px", position:"relative", maxHeight: isMobile ? "30vh" : "auto", overflowY: isMobile ? "auto" : "visible" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:RARITY_COLORS[CARD_DEFS[selectedCard].rarity], boxShadow:`0 0 6px ${RARITY_COLORS[CARD_DEFS[selectedCard].rarity]}` }}/>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <span style={{ fontSize: isMobile ? 24 : 28, filter:`drop-shadow(0 0 6px ${CARD_DEFS[selectedCard].glowColor})` }}>{CARD_DEFS[selectedCard].icon}</span>
                  <div>
                    <div style={{ fontSize: isMobile ? 7 : 8, color:CARD_DEFS[selectedCard].color, letterSpacing:1, marginBottom:4 }}>{CARD_DEFS[selectedCard].name}</div>
                    <span style={{ fontSize: isMobile ? 7 : 9, color:RARITY_COLORS[CARD_DEFS[selectedCard].rarity], border:`1px solid ${RARITY_COLORS[CARD_DEFS[selectedCard].rarity]}44`, padding:"2px 6px" }}>
                      {RARITY_LABELS[CARD_DEFS[selectedCard].rarity]}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: isMobile ? 6 : 7, color:"#ccc", lineHeight:2.2, letterSpacing:0.3 }}>{CARD_DEFS[selectedCard].description}</div>
                <button onClick={()=>setSelectedCard(null)} style={{ position:"absolute", top:8, right:8, background:"transparent", border:"none", color:"#555", fontSize:10, cursor:"pointer", fontFamily:"'Press Start 2P',monospace" }}>✕</button>
              </div>
            )}
          </div>
        )}

        <div style={{ height:2, background:"linear-gradient(90deg,transparent,#45aaf233,#a55eea33,#f9ca2433,transparent)" }}/>
      </div>
      <div style={{ marginTop:12, fontSize:5, color:"#1e1e2e", letterSpacing:2, zIndex:2 }}>★ KRAM KARD v1.4 ★</div>
    </div>
  );
}

// ─── HP Bar ───────────────────────────────────────────────────────────────────
function HPBar({ hp, maxHp, compact }: { hp: number; maxHp: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = pct > 50 ? "#26de81" : pct > 25 ? "#f9ca24" : "#fc5c65";
  const segments = compact ? 16 : 20;
  return (
    <div style={{ display: "flex", gap: compact ? 1 : 2, alignItems: "center" }}>
      {Array.from({ length: segments }).map((_, i) => {
        const filled = i < Math.round((pct / 100) * segments);
        return <div key={i} style={{ width: compact ? 12 : 8, height: compact ? 14 : 12, background: filled ? color : "#111", border: `1px solid ${filled ? color : "#222"}`, boxShadow: filled ? `0 0 3px ${color}88` : "none" }} />;
      })}
      <span style={{ marginLeft: 4, fontSize: compact ? 8 : 10, color: "#ccc" }}>{hp}</span>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize:6, color, border:`1px solid ${color}`, padding:"2px 5px", letterSpacing:1 }}>{label}</span>;
}

// ─── Battle card ──────────────────────────────────────────────────────────────
function BattleCard({ player, isActive, isMine, compact }: { player: PlayerState; isActive: boolean; isMine: boolean; compact?: boolean }) {
  const borderColor = isActive ? "#f9ca24" : isMine ? "#45aaf2" : "#a55eea";
  return (
    <div style={{ position:"relative", background:"linear-gradient(135deg,#0a0a16 0%,#080810 100%)", border:`2px solid ${borderColor}`, padding: compact ? "10px 12px" : "14px 18px", minWidth: compact ? 0 : 240, width: compact ? "100%" : undefined, fontFamily:"'Press Start 2P',monospace", boxShadow:isActive?`0 0 0 1px ${borderColor}44,0 0 20px ${borderColor}33`:`0 0 0 1px ${borderColor}22`, transform:isActive&&!compact?"scale(1.02)":"scale(1)", transition:"all 0.2s ease", opacity:player.connected?1:0.5, boxSizing:"border-box" }}>
      {[["-2px","-2px","top","left"],["-2px","-2px","top","right"],["-2px","-2px","bottom","left"],["-2px","-2px","bottom","right"]].map(([,,v,h],i) => (
        <div key={i} style={{ position:"absolute",[v]:-2,[h]:-2, width:6, height:6, background:borderColor, boxShadow:`0 0 5px ${borderColor}` }}/>
      ))}
      {isActive&&<div style={{ position:"absolute", top:-16, left:"50%", transform:"translateX(-50%)", fontSize:7, color:"#f9ca24", animation:"blink 0.8s step-end infinite", whiteSpace:"nowrap" }}>▼ TURN ▼</div>}
      {!player.connected&&<div style={{ position:"absolute", top:-16, left:"50%", transform:"translateX(-50%)", fontSize:6, color:"#fc5c65", animation:"blink 1s step-end infinite", whiteSpace:"nowrap" }}>⚠ DISCONNECTED</div>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: compact ? 6 : 10 }}>
        <span style={{ fontSize:7, color:isMine?"#45aaf2":"#a55eea", letterSpacing:1 }}>{isMine?"► YOU":"► FOE"}</span>
        <span style={{ fontSize: compact ? 7 : 8, color:"#fff" }}>{player.name.toUpperCase()}</span>
      </div>
      <div style={{ marginBottom: compact ? 5 : 8 }}>
        <div style={{ fontSize:6, color:"#666", marginBottom:3, letterSpacing:1 }}>HP</div>
        <HPBar hp={player.hp} maxHp={player.maxHp} compact={compact}/>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap: compact ? 4 : 6, marginTop: compact ? 5 : 8 }}>
        {player.shield&&<StatusBadge label="SHIELD" color="#45aaf2"/>}
        {player.reflectActive&&<StatusBadge label="REFLECT" color="#a55eea"/>}
        {player.poisoned>0&&<StatusBadge label={`PSN-${player.poisoned}`} color="#78e08f"/>}
        {(player.skipTurns??0)>0&&<StatusBadge label={`FROZEN×${player.skipTurns}`} color="#74b9ff"/>}
        {player.taunted&&<StatusBadge label="TAUNTED" color="#fd9644"/>}
        {player.regenStacks>0&&<StatusBadge label={`REGEN×${player.regenStacks}`} color="#26de81"/>}
        {player.extraTurn&&<StatusBadge label="EXTRA TURN" color="#f9ca24"/>}
        {(player.extraTurnDebt??0)>0&&<StatusBadge label={`WARP DEBT:${player.extraTurnDebt}`} color="#ff6fd8"/>}
        {player.counterStanceActive&&<StatusBadge label="COUNTER" color="#45aaf2"/>}
        {player.manaSurgeActive&&<StatusBadge label="SURGE×2" color="#f9ca24"/>}
        {player.plagueStacks>0&&<StatusBadge label={`PLAGUE×${player.plagueStacks}`} color="#c44dff"/>}
        {(player.stunCooldown??0)>0&&<StatusBadge label={`STUN CD:${player.stunCooldown}`} color="#ff9f43"/>}
        {(player.darkMatterStacks??0)>0&&<StatusBadge label={`DARK×${player.darkMatterStacks}`} color="#00ffcc"/>}
        {player.eventHorizonActive&&<StatusBadge label="E.HORIZON" color="#00ffcc"/>}
        {(player.neutronStarTicks??0)>0&&<StatusBadge label={`N.STAR×${player.neutronStarTicks}`} color="#00ffcc"/>}
        {/* Freeze heal block — now shows as HEAL FROZEN, distinct from stun freeze */}
        {(player.healBlocked??0)>0&&<StatusBadge label={`HEAL❄:${player.healBlocked}`} color="#74b9ff"/>}
        {(player.overflowDiscard??0)>0&&<StatusBadge label={`OVERFLOW↓${player.overflowCount}`} color="#f9ca24"/>}
      </div>
    </div>
  );
}

// ─── Hand card ────────────────────────────────────────────────────────────────
function HandCard({ cardId, index, total, onClick, disabled, mobile }: {
  cardId: CardId | "???"; index: number; total: number; onClick: () => void; disabled: boolean; mobile?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isHidden = cardId === "???";
  const def = isHidden ? null : CARD_DEFS[cardId as CardId];
  const mid = (total - 1) / 2;
  const rotate = mobile ? 0 : (index - mid) * 3.5;
  const translateY = mobile ? 0 : Math.abs(index - mid) * 3;

  const baseW = mobile ? 90 : 138;
  const hovW = mobile ? 110 : 165;
  const baseH = mobile ? 160 : 205;
  const hovH = mobile ? 190 : 240;

  return (
    <div
      onClick={disabled || isHidden ? undefined : onClick}
      onMouseEnter={() => { if (!disabled && !isHidden) { playTick(); setHovered(true); } }}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: disabled || isHidden ? "default" : "pointer",
        position: "relative",
        width: hovered ? hovW : baseW,
        minHeight: hovered ? hovH : baseH,
        background: isHidden ? "#0a0a14" : def!.bgColor,
        border: `2px solid ${isHidden ? "#1a1a2e" : hovered ? def!.color : def!.color + "55"}`,
        fontFamily: "'Press Start 2P', monospace",
        transform: hovered && !mobile
          ? "translateY(-40px) rotate(0deg) scale(1.1)"
          : `translateY(${translateY}px) rotate(${rotate}deg)`,
        transition: "all 0.15s ease",
        opacity: disabled ? 0.45 : 1,
        boxShadow: hovered && def
          ? `0 0 0 2px ${def.color}, 0 0 28px ${def.glowColor}88, 0 0 56px ${def.glowColor}33`
          : "none",
        overflow: "hidden",
        flexShrink: 0,
        zIndex: hovered ? 10 : 1,
      }}
    >
      {isHidden ? (
        <div style={{ height:"100%", minHeight:baseH, background:"repeating-linear-gradient(45deg,#0d0d1a 0px,#0d0d1a 4px,#111128 4px,#111128 8px)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:32, height:32, border:"1px solid #222", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#222" }}>?</div>
        </div>
      ) : def ? (
        <>
          <div style={{ height:3, background:RARITY_COLORS[def.rarity], boxShadow:`0 0 4px ${RARITY_COLORS[def.rarity]}` }}/>
          <div style={{ height: hovered ? (mobile ? 55 : 95) : (mobile ? 44 : 78), display:"flex", alignItems:"center", justifyContent:"center", fontSize: hovered ? (mobile?26:38) : (mobile?20:30), background:`radial-gradient(circle,${def.color}22 0%,transparent 70%)`, borderBottom:`1px solid ${def.color}22`, transition:"all 0.15s" }}>
            <span style={{ filter:`drop-shadow(0 0 6px ${def.glowColor})` }}>{def.icon}</span>
          </div>
          <div style={{ padding:"6px 6px 2px", textAlign:"center" }}>
            <div style={{ fontSize: mobile ? 5 : (hovered?7:6), color:def.color, letterSpacing:0.5, lineHeight:1.6 }}>{def.name}</div>
          </div>
          <div style={{ textAlign:"center", padding:"2px 0" }}>
            <span style={{ fontSize: mobile ? 4 : 5, color:RARITY_COLORS[def.rarity], letterSpacing:1 }}>{RARITY_LABELS[def.rarity]}</span>
          </div>
          <div style={{ padding: mobile ? "4px 6px 8px" : (hovered?"9px 10px 14px":"5px 8px 8px"), textAlign:"center", flex: 1 }}>
            <div style={{ fontSize: mobile ? 5 : (hovered?6:5), color: mobile ? "#aaa" : (hovered?"#bbb":"#666"), lineHeight:2 }}>{def.description}</div>
          </div>  
        </>
      ) : null}
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
function LeaderboardPanel({ entries, myToken, onClose }: { entries: LeaderboardEntry[]; myToken: string; onClose: () => void }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#080810", border:"2px solid #f9ca24", padding:"20px 24px", minWidth:300, maxWidth:"90vw", maxHeight:"80vh", overflowY:"auto", fontFamily:"'Press Start 2P',monospace", position:"relative" }}>
        <div style={{ fontSize:9, color:"#f9ca24", letterSpacing:2, marginBottom:16, textAlign:"center" }}>★ LEADERBOARD ★</div>
        {entries.length===0&&<div style={{ fontSize:7, color:"#555", textAlign:"center" }}>No records yet.</div>}
        {entries.map((e,i) => (
          <div key={e.sessionToken} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #1a1a2e", color:e.sessionToken===myToken?"#f9ca24":"#aaa" }}>
            <span style={{ fontSize:7, minWidth:20, color:i===0?"#f9ca24":i===1?"#aaa":i===2?"#cd7f32":"#555" }}>{i+1}.</span>
            <span style={{ fontSize:7, flex:1, marginLeft:8 }}>{e.name.toUpperCase()}</span>
            <span style={{ fontSize:6, color:"#26de81", marginRight:10 }}>{e.wins}W</span>
            <span style={{ fontSize:6, color:"#fc5c65" }}>{e.losses}L</span>
          </div>
        ))}
        <button onClick={onClose} style={{ marginTop:16, width:"100%", padding:"8px", fontSize:7, background:"transparent", border:"1px solid #f9ca24", color:"#f9ca24", fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>CLOSE</button>
      </div>
    </div>
  );
}

// ─── Name modal ───────────────────────────────────────────────────────────────
function NameModal({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Press Start 2P',monospace" }}>
      <div style={{ background:"#080810", border:"2px solid #45aaf2", padding:"28px 32px", textAlign:"center", maxWidth:"90vw" }}>
        <div style={{ fontSize:8, color:"#45aaf2", marginBottom:20, letterSpacing:2 }}>ENTER YOUR NAME</div>
        <input value={val} onChange={e=>setVal(e.target.value.slice(0,16))} onKeyDown={e=>e.key==="Enter"&&val.trim()&&onSubmit(val.trim())} autoFocus maxLength={16}
          style={{ background:"#0d0d1a", border:"1px solid #45aaf2", color:"#fff", padding:"8px 12px", fontSize:10, fontFamily:"'Press Start 2P',monospace", width:220, maxWidth:"100%", outline:"none", marginBottom:16, display:"block" }} placeholder="WARRIOR"/>
        <button onClick={()=>val.trim()&&onSubmit(val.trim())} style={{ background:"#45aaf2", border:"none", color:"#000", padding:"8px 20px", fontSize:8, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>ENTER ARENA</button>
      </div>
    </div>
  );
}

// ─── Share link ───────────────────────────────────────────────────────────────
function ShareLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ textAlign:"center", fontFamily:"'Press Start 2P',monospace" }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:6, color:"#555", marginBottom:6, letterSpacing:1 }}>ROOM CODE</div>
        <div style={{ fontSize:24, color:"#f9ca24", letterSpacing:8, textShadow:"0 0 12px #f9ca24aa" }}>{roomId}</div>
      </div>
      <div style={{ fontSize:6, color:"#444", marginBottom:8, letterSpacing:1 }}>OR SHARE LINK:</div>
      <div style={{ display:"flex", gap:8, justifyContent:"center", alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ fontSize:6, color:"#45aaf2", background:"#050510", border:"1px solid #1a1a2e", padding:"6px 10px", maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{url}</div>
        <button onClick={copy} style={{ background:"transparent", border:"1px solid #45aaf2", color:copied?"#26de81":"#45aaf2", padding:"6px 10px", fontSize:6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1, whiteSpace:"nowrap" }}>{copied?"COPIED!":"COPY"}</button>
      </div>
    </div>
  );
}

// ─── Inactivity warning ───────────────────────────────────────────────────────
function InactivityWarning({ secondsLeft, onStayIn, onLeave }: { secondsLeft: number; onStayIn: () => void; onLeave: () => void }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Press Start 2P',monospace" }}>
      <div style={{ background:"#080810", border:"2px solid #fc5c65", padding:"28px 32px", textAlign:"center", maxWidth:320 }}>
        <div style={{ fontSize:8, color:"#fc5c65", letterSpacing:2, marginBottom:12, animation:"blink 0.8s step-end infinite" }}>⚠ GAME STALLED ⚠</div>
        <div style={{ fontSize:6, color:"#aaa", lineHeight:2, marginBottom:20 }}>No activity detected.<br/>Auto-aborting in {secondsLeft}s...</div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onStayIn} style={{ background:"transparent", border:"1px solid #26de81", color:"#26de81", padding:"8px 14px", fontSize:6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>STAY IN</button>
          <button onClick={onLeave} style={{ background:"transparent", border:"1px solid #fc5c65", color:"#fc5c65", padding:"8px 14px", fontSize:6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>ABORT</button>
        </div>
      </div>
    </div>
  );
}

// ─── Narration panel ─────────────────────────────────────────────────────────
function NarrationPanel({ text, inline }: { text: string; inline?: boolean }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!text) return;
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 28);
    return () => clearInterval(interval);
  }, [text]);
  if (!text) return null;

  if (inline) {
    return (
      <div style={{ width:"100%", background:"#060610", border:"2px solid #1a1a2e", borderTop:"2px solid #f9ca24", fontFamily:"'Press Start 2P',monospace", marginBottom:8 }}>
        <div style={{ padding:"6px 9px", borderBottom:"1px solid #1a1a2e", fontSize:6, color:"#f9ca24", letterSpacing:2, background:"#0a0a18", display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ animation:"blink 2s step-end infinite" }}>▐</span> LAST MOVE
        </div>
        <div style={{ padding:"8px 10px 10px" }}>
          <div style={{ fontSize:6, color:"#e0e0e0", lineHeight:2.2, letterSpacing:0.3, minHeight:30 }}>
            {displayed}<span style={{ animation:"blink 0.6s step-end infinite", color:"#f9ca24" }}>_</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:"fixed", left:14, top:70, width:210, background:"#060610", border:"2px solid #1a1a2e", borderTop:"2px solid #f9ca24", fontFamily:"'Press Start 2P',monospace", zIndex:10 }}>
      <div style={{ padding:"7px 9px", borderBottom:"1px solid #1a1a2e", fontSize:6, color:"#f9ca24", letterSpacing:2, background:"#0a0a18", display:"flex", alignItems:"center", gap:5 }}>
        <span style={{ animation:"blink 2s step-end infinite" }}>▐</span> LAST MOVE
      </div>
      <div style={{ padding:"12px 10px 14px" }}>
        <div style={{ fontSize:7, color:"#e0e0e0", lineHeight:2.2, letterSpacing:0.3, minHeight:60 }}>
          {displayed}<span style={{ animation:"blink 0.6s step-end infinite", color:"#f9ca24" }}>_</span>
        </div>
      </div>
      <div style={{ padding:"3px 9px 7px", display:"flex", gap:3 }}>
        {["#f9ca24","#fc5c65","#26de81","#45aaf2","#a55eea"].map((c,i) => (
          <div key={i} style={{ width:5, height:5, background:c, opacity:0.5 }}/>
        ))}
      </div>
    </div>
  );
}

// ─── Mobile Battle Log Drawer ─────────────────────────────────────────────────
function MobileLogDrawer({ log }: { log: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 12, right: 12, zIndex: 30,
          background: "#0a0a18", border: "2px solid #a55eea",
          color: "#a55eea", fontFamily: "'Press Start 2P',monospace",
          fontSize: 7, padding: "7px 11px", cursor: "pointer",
          boxShadow: "0 0 12px #a55eea44",
          letterSpacing: 1,
        }}
      >
        {open ? "▼ LOG" : "▲ LOG"}
      </button>
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 29,
        background: "#060610",
        borderTop: "2px solid #a55eea",
        maxHeight: open ? "40vh" : 0,
        overflow: "hidden",
        transition: "max-height 0.3s ease",
        fontFamily: "'Press Start 2P',monospace",
      }}>
        <div style={{ padding:"7px 10px", borderBottom:"1px solid #1a1a2e", fontSize:8, color:"#a55eea", letterSpacing:2, background:"#0a0a18", display:"flex", justifyContent:"space-between" }}>
          <span>▐ BATTLE LOG</span>
          <button onClick={() => setOpen(false)} style={{ background:"transparent", border:"none", color:"#555", fontSize:7, cursor:"pointer", fontFamily:"'Press Start 2P',monospace" }}>✕</button>
        </div>
        <div style={{ overflowY:"auto", maxHeight:"calc(40vh - 30px)", padding:"6px 10px" }}>
          <ul style={{ listStyle:"none", padding:0, margin:0 }}>
            {log.map((entry, i) => (
              <li key={i} style={{ fontSize:6, color:i===0?"#f9ca24":"#555", lineHeight:2, borderBottom:"1px solid #0d0d1a", paddingBottom:5, marginBottom:5, letterSpacing:0.3 }}>{entry}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

// ─── Socket ───────────────────────────────────────────────────────────────────
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";
const socket: Socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: false,
});

const INACTIVITY_MS = 3 * 60 * 1000;
const WARNING_COUNTDOWN_S = 15;

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [gameState, setGameState]             = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard]         = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showNameModal, setShowNameModal]     = useState(false);
  const [nameSet, setNameSet]                 = useState(false);
  const [roomFull, setRoomFull]               = useState(false);
  const [soundEnabled, setSoundEnabled]       = useState(false);
  const [lobbyLeaderboard, setLobbyLeaderboard] = useState<LeaderboardEntry[]>([]);

  function fetchLobbyLeaderboard() {
    const s = io(SERVER_URL, { transports: ["websocket", "polling"], autoConnect: true });
    s.on("leaderboard", (data: LeaderboardEntry[]) => {
      setLobbyLeaderboard(data);
      s.disconnect();
    });
    s.emit("getLeaderboard");
  }
  const [roomId, setRoomId]                   = useState<string | null>(getRoomIdFromUrl);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdown, setWarningCountdown]           = useState(WARNING_COUNTDOWN_S);

  const isMobile = useIsMobile();

  const inactivityTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionToken      = useRef(getOrCreateSession());
  const prevGameOver      = useRef(false);

  const myToken              = gameState?.myToken;
  const myPlayer             = myToken ? gameState?.players[myToken] : null;
  const opponentToken        = myToken ? Object.keys(gameState?.players ?? {}).find(t => t !== myToken) : null;
  const opponentPlayer       = opponentToken ? gameState?.players[opponentToken] : null;
  const isMyTurn             = gameState?.turn === myToken;
  const playerCount          = Object.keys(gameState?.players ?? {}).length;
  const isGameOver           = gameState?.gameOver ?? false;
  const winnerId             = gameState?.winnerId;
  const winnerName           = winnerId ? gameState?.players[winnerId]?.name : null;
  const iWon                 = winnerId === myToken;
  const myRematchReady       = myPlayer?.rematchReady ?? false;
  const opponentRematchReady = opponentPlayer?.rematchReady ?? false;
  const lastNarration        = gameState?.lastNarration ?? "";

  const clearInactivityTimers = () => {
    if (inactivityTimer.current)   clearTimeout(inactivityTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };
  const startInactivityTimer = () => {
    clearInactivityTimers();
    setShowInactivityWarning(false);
    inactivityTimer.current = setTimeout(() => {
      setWarningCountdown(WARNING_COUNTDOWN_S);
      setShowInactivityWarning(true);
      let remaining = WARNING_COUNTDOWN_S;
      countdownInterval.current = setInterval(() => {
        remaining -= 1;
        setWarningCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownInterval.current!);
          socket.emit("forfeit");
          setTimeout(() => { window.location.href = window.location.origin; }, 300);
        }
      }, 1000);
    }, INACTIVITY_MS);
  };

  const handleStayIn = () => { clearInactivityTimers(); setShowInactivityWarning(false); startInactivityTimer(); };
  const handleInactivityLeave = () => {
    clearInactivityTimers(); setShowInactivityWarning(false);
    socket.emit("forfeit");
    setTimeout(() => { window.location.href = window.location.origin; }, 300);
  };

  useEffect(() => {
    if (!gameState || gameState.gameOver || Object.keys(gameState.players).length < 2) {
      clearInactivityTimers(); setShowInactivityWarning(false); return;
    }
    startInactivityTimer();
    return clearInactivityTimers;
  }, [gameState?.log]); // eslint-disable-line

  useEffect(() => {
    if (isGameOver && !prevGameOver.current) {
      if (iWon) playVictory(); else playDefeat();
    }
    prevGameOver.current = isGameOver;
  }, [isGameOver, iWon]);

  useEffect(() => {
    if (!roomId) return;
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    socket.on("stateUpdate", (s: GameState) => setGameState(s));
    socket.on("roomFull", () => setRoomFull(true));
    socket.on("leaderboard", (data: LeaderboardEntry[]) => setLeaderboard(data));
    socket.on("connect", () => {
      const name = localStorage.getItem("kramkard_name");
      if (name) {
        socket.emit("joinRoom", { roomId, sessionToken: sessionToken.current, preferredName: name });
        setNameSet(true);
      }
    });
    const storedName = localStorage.getItem("kramkard_name");
    if (!storedName) { setShowNameModal(true); playModalOpen(); }
    socket.connect();
    return () => {
      socket.off("stateUpdate"); socket.off("roomFull");
      socket.off("leaderboard"); socket.off("connect");
      clearInactivityTimers();
    };
  }, [roomId]); // eslint-disable-line

  function doJoin(name: string) {
    localStorage.setItem("kramkard_name", name);
    socket.emit("joinRoom", { roomId, sessionToken: sessionToken.current, preferredName: name });
    setNameSet(true);
  }
  function handleNameSubmit(name: string) { playModalClose(); setShowNameModal(false); doJoin(name); socket.emit("setName", name); }
  function handleSoundToggle() { setSoundEnabled(toggleSound()); }
  const playCard        = (cardId: CardId) => { playCardPlay(); socket.emit("playCard", cardId); };
  const requestRematch  = ()               => { playWhoosh(); socket.emit("rematch"); };
  const openLeaderboard = () => { playModalOpen(); socket.emit("getLeaderboard"); setShowLeaderboard(true); };
  const goHome = () => { window.location.href = window.location.origin + window.location.pathname.replace(/\/+$/, ""); };
  const handleLeave = () => {
    if (isGameOver || playerCount < 2) { goHome(); return; }
    if (window.confirm("Forfeit the match? Your opponent will be declared the winner.")) {
      socket.emit("forfeit"); setTimeout(goHome, 300);
    }
  };

  if (!roomId) {
    return (
      <div style={{ background:"#05050f", minHeight:"100vh", position:"fixed", inset:0, overflow:"hidden" }}>
        <style>{`html,body,#root{background:#05050f!important;min-height:100vh;margin:0;padding:0;}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}*{box-sizing:border-box;}`}</style>
        <Starfield />
        <Lobby
          onEnter={(code) => setRoomId(code)}
          leaderboard={lobbyLeaderboard}
          fetchLeaderboard={fetchLobbyLeaderboard}
        />
      </div>
    );
  }

  if (roomFull) {
    return (
      <div style={{ background:"#05050f", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Press Start 2P',monospace", color:"#fc5c65", fontSize:10, textAlign:"center" }}>
        ROOM IS FULL.<br/><br/><span style={{ fontSize:7, color:"#555" }}>Ask your friend for a different room link.</span>
      </div>
    );
  }

  return (
    <div style={{ background:"#05050f", minHeight:"100vh", color:"#e0e0e0", fontFamily:"'Press Start 2P',monospace", overflowX:"hidden", position:"relative", paddingBottom: isMobile ? 60 : 0 }}>
      <style>{`
        html,body,#root{background:#05050f!important;min-height:100vh;margin:0;padding:0;}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{color:#f9ca24;text-shadow:0 0 8px #f9ca24}50%{color:#fff;text-shadow:0 0 20px #f9ca24}}
        @keyframes pixelIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
      `}</style>

      <Starfield />
      <div style={{ position:"fixed", inset:0, zIndex:1, pointerEvents:"none", background:"repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px)" }}/>

      {showNameModal   && <NameModal onSubmit={handleNameSubmit}/>}
      {showLeaderboard && <LeaderboardPanel entries={leaderboard} myToken={myToken??""} onClose={() => { playModalClose(); setShowLeaderboard(false); }}/>}
      {showInactivityWarning && <InactivityWarning secondsLeft={warningCountdown} onStayIn={handleStayIn} onLeave={handleInactivityLeave}/>}

      <button onClick={handleSoundToggle} title={soundEnabled?"Sound ON":"Sound OFF"}
        style={{ position:"fixed", top:14, left:14, zIndex:20, background:"transparent", border:`1px solid ${soundEnabled?"#f9ca24":"#333"}`, color:soundEnabled?"#f9ca24":"#444", padding:"5px 9px", fontSize:11, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", boxShadow:soundEnabled?"0 0 6px #f9ca2444":"none", transition:"all 0.15s" }}>
        {soundEnabled?"🔊":"🔇"}
      </button>

      {!isMobile && playerCount === 2 && <NarrationPanel text={lastNarration}/>}
      {!isMobile && (
        <div style={{ position:"fixed", right:14, top:70, width:240, maxHeight:"75vh", background:"#060610", border:"2px solid #1a1a2e", borderTop:"2px solid #a55eea", fontFamily:"'Press Start 2P',monospace", zIndex:10, overflowY:"auto" }}>
          <div style={{ padding:"7px 9px", borderBottom:"1px solid #1a1a2e", fontSize:6, color:"#a55eea", letterSpacing:2, background:"#0a0a18", display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ animation:"blink 2s step-end infinite" }}>▐</span> BATTLE LOG
          </div>
          <ul style={{ listStyle:"none", padding:"7px 9px", margin:0 }}>
            {(gameState?.log??[]).map((entry,i) => (
              <li key={i} style={{ fontSize:6, color:i===0?"#f9ca24":"#555", lineHeight:2, borderBottom:"1px solid #0d0d1a", paddingBottom:6, marginBottom:6, letterSpacing:0.3 }}>{entry}</li>
            ))}
          </ul>
        </div>
      )}

      {isMobile && <MobileLogDrawer log={gameState?.log ?? []}/>}

      <div style={{ position:"relative", zIndex:2, maxWidth: isMobile ? "100%" : 900, margin:"0 auto", padding: isMobile ? "12px 10px" : "16px 14px", minHeight:"100vh", display:"flex", flexDirection:"column", gap: isMobile ? 8 : 10 }}>

        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:6, color:"#a55eea", letterSpacing:4, marginBottom:4, animation:"blink 2s step-end infinite" }}>★ COSMIC ARENA ★</div>
          <h1 style={{ fontSize: isMobile ? 14 : 18, color:"#f9ca24", margin:0, letterSpacing:3, textShadow:"0 0 8px #f9ca24aa" }}>KRAM KARD</h1>
        </div>

        <div style={{ display:"flex", justifyContent:"center", gap: isMobile ? 6 : 10 }}>
          <button onClick={openLeaderboard} style={{ background:"transparent", border:"1px solid #a55eea", color:"#a55eea", padding: isMobile ? "5px 10px" : "5px 14px", fontSize: isMobile ? 5 : 6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>★ SCORES</button>
          <button onClick={handleLeave} style={{ background:"transparent", border:"1px solid #fc5c65", color:"#fc5c65", padding: isMobile ? "5px 10px" : "5px 14px", fontSize: isMobile ? 5 : 6, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>
            {isGameOver?"✕ EXIT":playerCount<2?"✕ LEAVE":"✕ FORFEIT"}
          </button>
        </div>

        <div style={{ textAlign:"center", fontSize: isMobile ? 6 : 7, color:isMyTurn?"#f9ca24":"#444", letterSpacing:2, minHeight:16, transition:"color .3s", textShadow:isMyTurn?"0 0 6px #f9ca24":"none", animation:isMyTurn?"blink 1.2s step-end infinite":"none" }}>
          {!isGameOver&&(playerCount===2?(isMyTurn?"► YOUR TURN — PICK A CARD ◄":"-- OPPONENT'S TURN --"):"")}
        </div>

        {isMobile && playerCount === 2 && lastNarration && <NarrationPanel text={lastNarration} inline/>}

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: isMobile ? 6 : 10 }}>
          {opponentPlayer && (
            <div style={{ animation:"pixelIn 0.3s ease", width: isMobile ? "100%" : undefined }}>
              <BattleCard player={opponentPlayer} isActive={!isMyTurn&&!isGameOver} isMine={false} compact={isMobile}/>
            </div>
          )}
          {!isMobile && opponentPlayer && (
            <div style={{ display:"flex", gap:5, alignItems:"flex-end" }}>
              {opponentPlayer.hand.map((_,i) => (
                <div key={i} style={{ width:24, height:36, transform:`rotate(${(i-Math.floor(opponentPlayer.hand.length/2))*4}deg)`, background:"repeating-linear-gradient(45deg,#0d0d1a 0,#0d0d1a 3px,#111128 3px,#111128 6px)", border:"1px solid #1a1a2e" }}/>
              ))}
            </div>
          )}
          {isMobile && opponentPlayer && (
            <div style={{ fontSize:6, color:"#555", letterSpacing:1 }}>FOE: {opponentPlayer.hand.length} CARDS</div>
          )}
        </div>

        {playerCount===2&&<div style={{ textAlign:"center", fontSize: isMobile ? 6 : 7, color:"#222", letterSpacing:5 }}>──── VS ────</div>}

        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: isMobile ? 8 : 14 }}>
          {myPlayer && (
            <div style={{ animation:"pixelIn 0.3s ease", width: isMobile ? "100%" : undefined }}>
              <BattleCard player={myPlayer} isActive={isMyTurn&&!isGameOver} isMine={true} compact={isMobile}/>
            </div>
          )}
          {myPlayer && (
            <div style={{
              display:"flex",
              gap: isMobile ? 4 : 6,
              alignItems: isMobile ? "center" : "flex-end",
              justifyContent:"center",
              flexWrap: isMobile ? "wrap" : "nowrap",
              paddingTop: isMobile ? 4 : 8,
              minHeight: isMobile ? 140 : 230,
              width:"100%",
            }}>
              {myPlayer.hand.map((cardId,i) => (
                <HandCard
                  key={`${cardId}-${i}`}
                  cardId={cardId}
                  index={i}
                  total={myPlayer.hand.length}
                  onClick={() => cardId!=="???"&&playCard(cardId as CardId)}
                  disabled={!isMyTurn||isGameOver}
                  mobile={isMobile}
                />
              ))}
            </div>
          )}
        </div>

        {playerCount<2&&nameSet&&(
          <div style={{ display:"flex", flexDirection:"column", gap:16, alignItems:"center", marginTop:16 }}>
            <div style={{ fontSize:7, color:"#444", letterSpacing:2, animation:"blink 1s step-end infinite" }}>▓ WAITING FOR PLAYER 2 ▓</div>
            <ShareLink roomId={roomId}/>
          </div>
        )}

        {isGameOver&&winnerName&&(
          <div style={{ textAlign:"center", marginTop:16, animation:"slideUp 0.4s ease", display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
            <div style={{ fontSize: isMobile ? 9 : 10, letterSpacing:2, animation:"pulse 1.2s ease-in-out infinite" }}>{iWon?"★ VICTORY! ★":"✕ DEFEAT ✕"}</div>
            <div style={{ fontSize:7, color:iWon?"#f9ca24":"#fc5c65" }}>{winnerName.toUpperCase()} WINS!</div>
            {playerCount===2&&(
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
                <button onClick={requestRematch} disabled={myRematchReady}
                  style={{ background:myRematchReady?"#1a1a0a":"transparent", border:`1px solid ${myRematchReady?"#555":"#f9ca24"}`, color:myRematchReady?"#555":"#f9ca24", padding:"8px 18px", fontSize:7, fontFamily:"'Press Start 2P',monospace", cursor:myRematchReady?"default":"pointer", letterSpacing:1 }}>
                  {myRematchReady?"READY ✓":"REMATCH?"}
                </button>
                <button onClick={() => { window.location.href=window.location.origin; }}
                  style={{ background:"transparent", border:"1px solid #fc5c65", color:"#fc5c65", padding:"8px 18px", fontSize:7, fontFamily:"'Press Start 2P',monospace", cursor:"pointer", letterSpacing:1 }}>
                  ✕ LEAVE
                </button>
              </div>
            )}
            {opponentRematchReady&&!myRematchReady&&<div style={{ fontSize:6, color:"#26de81" }}>FOE READY!</div>}
            {myRematchReady&&!opponentRematchReady&&<div style={{ fontSize:6, color:"#555", animation:"blink 1s step-end infinite" }}>WAITING FOR OPPONENT...</div>}
          </div>
        )}
      </div>
    </div>
  );
}