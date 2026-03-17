import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, BarChart3, CheckCircle2, Crown, Droplets,
  Eye, Hammer, Leaf, Scale, ScrollText, ShieldCheck,
  Sparkles as SparklesIcon, Trees, Users,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────
const PLAYER_SPEED = 5.5;
const RUN_MULTIPLIER = 1.5;
const INTERACT_DISTANCE = 5.6;
const COLLECT_DISTANCE = 2.5;
const WORLD_RADIUS = 22;
const START_PLAYER_POS = [0, 0.7, 14];
const TRASH_TIME = 90;

const TRASH_POSITIONS = [
  { id: 0, pos: [-6.5, 0.5, 3.8] },
  { id: 1, pos: [-13, 0.5, 1.5] },
  { id: 2, pos: [2.2, 0.5, -2.5] },
  { id: 3, pos: [4.5, 0.5, 6.5] },
  { id: 4, pos: [8.5, 0.5, -5.5] },
  { id: 5, pos: [-3.2, 0.5, -7.5] },
  { id: 6, pos: [14, 0.5, 0.5] },
  { id: 7, pos: [6.5, 0.5, 3.5] },
  { id: 8, pos: [-9, 0.5, -3.5] },
  { id: 9, pos: [11.5, 0.5, -11] },
  { id: 10, pos: [3.5, 0.5, -13] },
  { id: 11, pos: [-5, 0.5, 9.5] },
];

const LEVEL_INFO = {
  1: { title: "Clean the Forest", desc: "Collect all debris before time runs out", color: "#6ee7ff" },
  2: { title: "Hear the Communities", desc: "Walk to each station — questions appear automatically", color: "#ffca76" },
  3: { title: "Face the Council", desc: "Reach the Hollow Council for the governance debrief", color: "#b89cff" },
};

const QUICK_QUESTIONS = {
  river: {
    npc: "Ripple · River Watch", color: "#6ee7ff", icon: Droplets,
    question: "Flood risk is at 68%. Workers say leadership has called it 'normal' for 3 seasons. What should happen first?",
    key: "river_q",
    options: [
      ["Act now — people feel the risk regardless of what reports say", { environment: 5, alignment: 3 }],
      ["Publish the real data so communities can decide together", { governance: 3, environment: 2 }],
      ["Follow the council's assessment — they see the full picture", { alignment: -2 }],
    ],
  },
  otter: {
    npc: "Pip · Otter Guild", color: "#7bf1b5", icon: Leaf,
    question: "What actually convinces you that leadership cares about a problem — not just says it does?",
    key: "otter_q",
    options: [
      ["Visible day-to-day changes, not speeches or announcements", { environment: 4, alignment: 3 }],
      ["A public commitment with a measurable, trackable goal", { governance: 2, alignment: 1 }],
      ["Detailed strategy documents showing they've thought it through", { alignment: -2 }],
    ],
  },
  meadow: {
    npc: "Fern · Meadow Accord", color: "#ffca76", icon: Users,
    question: "Three groups need support. You only have enough for two. What guides the choice?",
    key: "meadow_q",
    options: [
      ["Whoever's been carrying the heaviest load quietly", { social: 5, alignment: 2 }],
      ["Split evenly — equal treatment means treating everyone the same", { social: 2 }],
      ["Let the groups negotiate their own agreement", { governance: 2, social: -1 }],
    ],
  },
  deer: {
    npc: "Elder Moss · Deer Circle", color: "#c8f27e", icon: Trees,
    question: "One team is clearly carrying more than their share. No one official has said anything. What do you do?",
    key: "deer_q",
    options: [
      ["Raise it now — silence makes the imbalance harder to fix", { social: 4, governance: 2 }],
      ["Wait for the right moment — timing affects how it lands", { social: -1 }],
      ["Leave it for leadership to notice and address in time", { alignment: -3 }],
    ],
  },
  archive: {
    npc: "Scholar Bark · Archive Tree", color: "#8fd4ff", icon: ScrollText,
    question: "When honest feedback reaches leadership, what usually happens to it?",
    key: "archive_q",
    options: [
      ["It genuinely shapes decisions — you can trace it back", { governance: 4, alignment: 3 }],
      ["It gets acknowledged, then quietly set aside", { alignment: -2 }],
      ["Depends entirely on who's speaking and who's listening", { governance: 1 }],
    ],
  },
};

const LEVEL2_REQUIRED = ["river", "otter", "meadow", "deer"];

const characterProfiles = {
  beaver: { name: "Brindle the Beaver", title: "Builder of Balance", icon: Hammer, description: "Hands-on and practical. Better at environmental action and visible repair.", bonus: { environment: 4, alignment: 1 }, accent: "emerald" },
  fox: { name: "Sable the Fox", title: "Mediator of the Glades", icon: Scale, description: "Diplomatic and strategic. Better at negotiation and social framing.", bonus: { social: 4, alignment: 1 }, accent: "amber" },
  owl: { name: "Aster the Owl", title: "Watcher of the Council", icon: Eye, description: "Reflective and investigative. Better at governance and uncovering truth.", bonus: { governance: 4, alignment: 1 }, accent: "violet" },
};

const questNodes = [
  { id: "river", label: "Overflowing River", chapter: "Environment", pos: [-10, 0.65, 6], color: "#6ee7ff", icon: Droplets, levels: [2] },
  { id: "otter", label: "Otter Guild", chapter: "Environment", pos: [-4, 0.65, 2.8], color: "#7bf1b5", icon: Leaf, levels: [2] },
  { id: "meadow", label: "Meadow Accord", chapter: "Social", pos: [5.8, 0.65, -4.5], color: "#ffca76", icon: Users, levels: [2] },
  { id: "deer", label: "Deer Circle", chapter: "Social", pos: [11.6, 0.65, -8.5], color: "#c8f27e", icon: Trees, levels: [2] },
  { id: "council", label: "Hollow Council", chapter: "Governance", pos: [11, 0.65, 8], color: "#b89cff", icon: ShieldCheck, levels: [3] },
  { id: "archive", label: "Archive Tree", chapter: "Governance", pos: [16.3, 0.65, 3.8], color: "#8fd4ff", icon: ScrollText, levels: [2, 3] },
];

const initialState = {
  phase: "intro",
  playerName: "",
  selectedCharacter: null,
  level: 1,
  levelDone: { 1: false, 2: false, 3: false },
  showLevelComplete: false,
  metrics: { environment: 52, social: 51, governance: 49, alignment: 46 },
  answers: {},
  voiceSaved: {},
  activeNode: null,
  visited: {},
  trashCollected: [],
  trashTimerLeft: TRASH_TIME,
  trashTimerActive: false,
  evidenceFound: { hiddenLedger: false, missingMinutes: false, brokenSeal: false },
  policyChoice: null,
  log: [],
};

// ── Utility ────────────────────────────────────────────────────────────────
function cx(...classes) { return classes.filter(Boolean).join(" "); }
function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }
function applyEffects(metrics, effects) {
  const next = { ...metrics };
  Object.entries(effects || {}).forEach(([k, d]) => { next[k] = clamp((next[k] ?? 0) + d, 0, 100); });
  return next;
}
function formatPolicy(p) {
  return { "transparency-charter": "Transparency Charter", "guardian-panel": "Citizen Guardian Panel", "elite-taskforce": "Elite Taskforce" }[p] || "None";
}
function getNearestNodeInfo(position) {
  let nearestId = null, nearestDist = Infinity;
  questNodes.forEach((n) => {
    const dx = n.pos[0] - position[0], dz = n.pos[2] - position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) { nearestDist = dist; nearestId = n.id; }
  });
  return { nearestId, nearestDist };
}

function colorBand(accent) { return { emerald: "from-emerald-500/40 to-cyan-400/20", amber: "from-amber-500/40 to-rose-400/20", violet: "from-violet-500/40 to-sky-400/20" }[accent] || "from-emerald-500/40 to-cyan-400/20"; }
function toneBar(tone) { return { emerald: "from-emerald-300 to-lime-300", amber: "from-amber-300 to-orange-300", violet: "from-violet-300 to-fuchsia-300", sky: "from-sky-300 to-cyan-300" }[tone] || "from-emerald-300 to-lime-300"; }
function accentBtn(accent) { return { emerald: "bg-emerald-500 text-slate-950 hover:bg-emerald-400", amber: "bg-amber-400 text-slate-950 hover:bg-amber-300", violet: "bg-violet-500 text-white hover:bg-violet-400" }[accent] || "bg-white text-slate-950 hover:bg-white/90"; }
function accentBorder(accent) { return { emerald: "border-emerald-400/40", amber: "border-amber-400/40", violet: "border-violet-400/40" }[accent] || "border-white/10"; }
function accentGlow(accent) { return { emerald: "shadow-[0_0_32px_rgba(52,211,153,0.12)]", amber: "shadow-[0_0_32px_rgba(251,191,36,0.12)]", violet: "shadow-[0_0_32px_rgba(167,139,250,0.12)]" }[accent] || ""; }

// ── Mini component library ─────────────────────────────────────────────────
function Badge({ className = "", children }) { return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", className)}>{children}</span>; }
function Button({ className = "", variant, children, ...props }) {
  const base = variant === "outline" ? "inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50" : "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50";
  return <button className={cx(base, className)} {...props}>{children}</button>;
}
function Card({ className = "", children }) { return <div className={cx("rounded-3xl border border-white/10", className)}>{children}</div>; }
function CardHeader({ className = "", children }) { return <div className={cx("p-6 pb-3", className)}>{children}</div>; }
function CardTitle({ className = "", children }) { return <h3 className={cx("text-xl font-semibold", className)}>{children}</h3>; }
function CardDescription({ className = "", children }) { return <p className={cx("mt-1 text-sm", className)}>{children}</p>; }
function CardContent({ className = "", children }) { return <div className={cx("p-6 pt-0", className)}>{children}</div>; }
function Input({ className = "", ...props }) { return <input className={cx("w-full rounded-xl border px-3 py-2 text-sm outline-none", className)} {...props} />; }
function Textarea({ className = "", ...props }) { return <textarea className={cx("w-full rounded-xl border px-3 py-2 text-sm outline-none", className)} {...props} />; }

// ── Self-checks ────────────────────────────────────────────────────────────
const SELF_CHECKS = [
  { name: "clamp works", pass: clamp(140, 0, 100) === 100 && clamp(-4, 0, 100) === 0 },
  { name: "applyEffects works", pass: applyEffects({ environment: 50 }, { environment: 10 }).environment === 60 },
  { name: "formatPolicy works", pass: formatPolicy("guardian-panel") === "Citizen Guardian Panel" },
  { name: "nearest-node resolves", pass: typeof getNearestNodeInfo([0, 0, 14]).nearestId === "string" },
];

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  const [game, setGame] = useState(initialState);
  const [playerPos, setPlayerPos] = useState([...START_PLAYER_POS]);
  const [nearestNodeId, setNearestNodeId] = useState(null);
  const [freeCamera, setFreeCamera] = useState(false);

  const selectedProfile = game.selectedCharacter ? characterProfiles[game.selectedCharacter] : null;
  const evidenceCount = Object.values(game.evidenceFound).filter(Boolean).length;

  const forestStatus = useMemo(() => {
    const { environment, social, governance, alignment } = game.metrics;
    const avg = Math.round((environment + social + governance + alignment) / 4);
    if (avg >= 80) return { label: "Thriving Canopy", desc: "Employees and leaders appear closely aligned.", tone: "text-emerald-300" };
    if (avg >= 65) return { label: "Recovering Forest", desc: "Stabilising, but tensions still need attention.", tone: "text-lime-300" };
    if (avg >= 50) return { label: "Fragile Balance", desc: "Progress exists, though confidence remains uneven.", tone: "text-amber-300" };
    return { label: "Forest in Fog", desc: "Signals suggest meaningful gaps between experience and leadership intent.", tone: "text-rose-300" };
  }, [game.metrics]);

  // Timer countdown for level 1
  useEffect(() => {
    if (!game.trashTimerActive || game.trashTimerLeft <= 0) return undefined;
    const t = setInterval(() => {
      setGame((prev) => {
        if (!prev.trashTimerActive) return prev;
        if (prev.trashTimerLeft <= 1) {
          const collected = prev.trashCollected.length;
          const bonus = collected >= 10 ? 8 : collected >= 6 ? 4 : 1;
          return { ...prev, trashTimerLeft: 0, trashTimerActive: false, metrics: applyEffects(prev.metrics, { environment: bonus }), levelDone: { ...prev.levelDone, 1: true }, showLevelComplete: true };
        }
        return { ...prev, trashTimerLeft: prev.trashTimerLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [game.trashTimerActive]);

  // Start timer when entering play phase
  useEffect(() => {
    if (game.phase === "play" && game.level === 1 && !game.trashTimerActive && !game.levelDone[1]) {
      setTimeout(() => setGame((prev) => ({ ...prev, trashTimerActive: true })), 800);
    }
  }, [game.phase]);

  // Level 2 completion
  const level2Complete = useMemo(() => LEVEL2_REQUIRED.every((id) => QUICK_QUESTIONS[id].key in game.answers), [game.answers]);
  useEffect(() => {
    if (game.level === 2 && level2Complete && !game.levelDone[2]) {
      setGame((prev) => ({ ...prev, levelDone: { ...prev.levelDone, 2: true }, showLevelComplete: true, metrics: applyEffects(prev.metrics, { social: 5, alignment: 2 }) }));
    }
  }, [game.level, level2Complete]);

  // Level 3: auto-open council when nearby
  useEffect(() => {
    if (game.level === 3 && nearestNodeId === "council" && !game.activeNode && !game.levelDone[3]) {
      setGame((prev) => ({ ...prev, activeNode: "council", visited: { ...prev.visited, council: true } }));
    }
  }, [nearestNodeId, game.level, game.activeNode, game.levelDone]);

  // Level 3 completion: when policy chosen
  useEffect(() => {
    if (game.level === 3 && game.policyChoice && !game.levelDone[3]) {
      setGame((prev) => ({ ...prev, levelDone: { ...prev.levelDone, 3: true }, showLevelComplete: true, metrics: applyEffects(prev.metrics, { governance: 5, alignment: 3 }) }));
    }
  }, [game.policyChoice, game.level]);

  // Camera toggle
  useEffect(() => {
    if (game.phase !== "play") return undefined;
    function onKeyDown(e) { if (e.key.toLowerCase() === "c") setFreeCamera((v) => !v); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.phase]);

  const collectTrash = (id) => {
    setGame((prev) => {
      if (prev.trashCollected.includes(id)) return prev;
      const next = [...prev.trashCollected, id];
      const allDone = next.length >= TRASH_POSITIONS.length;
      return {
        ...prev, trashCollected: next,
        log: [...prev.log, { type: "trash", id }],
        ...(allDone ? { trashTimerActive: false, levelDone: { ...prev.levelDone, 1: true }, showLevelComplete: true, metrics: applyEffects(prev.metrics, { environment: 8, alignment: 2 }) } : {}),
      };
    });
  };

  const saveAnswer = (key, value, effects = {}) => {
    setGame((prev) => ({ ...prev, answers: { ...prev.answers, [key]: value }, metrics: applyEffects(prev.metrics, effects), log: [...prev.log, { type: "answer", key, value }] }));
  };

  const saveVoice = (key, text) => {
    setGame((prev) => ({ ...prev, voiceSaved: { ...prev.voiceSaved, [key]: text?.trim() || "[recorded]" } }));
  };

  const findEvidence = (key, effects) => {
    setGame((prev) => {
      if (prev.evidenceFound[key]) return prev;
      return { ...prev, evidenceFound: { ...prev.evidenceFound, [key]: true }, metrics: applyEffects(prev.metrics, effects) };
    });
  };

  const choosePolicy = (choice, effects) => {
    setGame((prev) => ({ ...prev, policyChoice: choice, metrics: applyEffects(prev.metrics, effects) }));
  };

  const chooseCharacter = (id) => {
    if (!characterProfiles[id]) return;
    setGame((prev) => ({ ...prev, selectedCharacter: id, phase: "play", metrics: applyEffects(prev.metrics, characterProfiles[id].bonus) }));
  };

  const advanceLevel = () => {
    setGame((prev) => {
      const next = prev.level + 1;
      if (next > 3) return { ...prev, showLevelComplete: false, phase: "summary" };
      return { ...prev, showLevelComplete: false, level: next, activeNode: null };
    });
  };

  const resetGame = () => { setGame(initialState); setPlayerPos([...START_PLAYER_POS]); setNearestNodeId(null); setFreeCamera(false); };

  const answeredNodeKeys = Object.keys(game.answers);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#06110d_0%,#0a1614_38%,#10141f_100%)] text-white">
      <div className="relative min-h-screen w-full">

        {game.phase === "play" && (
          <div className="absolute inset-0 z-0">
            <Canvas shadows camera={{ position: [0, 8, 18], fov: 50 }} dpr={[1, 1.5]}>
              <Suspense fallback={null}>
                <color attach="background" args={["#09120d"]} />
                <fog attach="fog" args={["#09120d", 18, 70]} />
                <ambientLight intensity={1.15} />
                <hemisphereLight intensity={0.9} groundColor="#0d2518" color="#c6ffd8" />
                <directionalLight castShadow position={[10, 18, 8]} intensity={1.35} color="#fff7dd" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
                <pointLight position={[-10, 5, 5]} intensity={1.2} color="#6ee7ff" distance={18} />
                <pointLight position={[11, 5, 7]} intensity={0.95} color="#b89cff" distance={16} />
                <ForestWorld
                  playerPos={playerPos} setPlayerPos={setPlayerPos}
                  nearestNodeId={nearestNodeId} setNearestNodeId={setNearestNodeId}
                  freeCamera={freeCamera} character={game.selectedCharacter}
                  level={game.level} trashCollected={game.trashCollected}
                  onCollect={collectTrash} answeredNodeKeys={answeredNodeKeys}
                />
              </Suspense>
            </Canvas>
          </div>
        )}

        <div className="relative z-10 h-full w-full p-5 lg:p-6 pointer-events-none">
          {game.phase !== "play" && <HeaderBar selectedProfile={selectedProfile} phase={game.phase} />}

          <AnimatePresence mode="wait">
            {game.phase === "intro" && (
              <motion.div key="intro" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="pointer-events-auto mx-auto mt-8 max-w-5xl">
                <IntroScreen game={game} setGame={setGame} />
              </motion.div>
            )}
            {game.phase === "character" && (
              <motion.div key="character" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="pointer-events-auto mx-auto mt-8 max-w-5xl">
                <CharacterSelect playerName={game.playerName} chooseCharacter={chooseCharacter} />
              </motion.div>
            )}
            {game.phase === "play" && (
              <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-20 flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <TopLeftHud selectedProfile={selectedProfile} freeCamera={freeCamera} level={game.level} />
                  <div className="ml-auto"><TopRightHud metrics={game.metrics} level={game.level} levelDone={game.levelDone} /></div>
                </div>
                <div className="flex-1 flex items-end justify-center pb-4">
                  <AnimatePresence mode="wait">
                    {game.level === 2 && nearestNodeId && QUICK_QUESTIONS[nearestNodeId] && (
                      <QuickQuestPopup key={nearestNodeId} nodeId={nearestNodeId} game={game} saveAnswer={saveAnswer} />
                    )}
                    {game.level === 3 && nearestNodeId === "council" && !game.activeNode && (
                      <motion.div key="council-hint" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-violet-400/20 bg-black/60 px-4 py-2.5 backdrop-blur-xl">
                        <ShieldCheck className="h-4 w-4 text-violet-300" />
                        <span className="text-sm font-medium text-white">Entering the Hollow Council…</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-end gap-3">
                  <ObjectiveHud game={game} evidenceCount={evidenceCount} />
                  <div className="ml-auto"><ControlStrip /></div>
                </div>
              </motion.div>
            )}
            {game.phase === "summary" && (
              <motion.div key="summary" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="pointer-events-auto mx-auto mt-4 max-w-6xl">
                <SummaryScreen game={game} selectedProfile={selectedProfile} forestStatus={forestStatus} evidenceCount={evidenceCount} restart={resetGame} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {game.phase === "play" && game.activeNode === "council" && (
            <CouncilModal game={game} closeModal={() => setGame((prev) => ({ ...prev, activeNode: null }))}
              saveAnswer={saveAnswer} saveVoice={saveVoice} findEvidence={findEvidence} choosePolicy={choosePolicy} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {game.phase === "play" && game.showLevelComplete && (
            <LevelCompleteOverlay level={game.level} onContinue={advanceLevel} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────
function HeaderBar({ selectedProfile }) {
  return (
    <div className="pointer-events-none flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200/80 backdrop-blur-xl">
          <SparklesIcon className="h-3.5 w-3.5" /> Guardians of Verdantia
        </div>
        <h1 className="text-3xl font-semibold tracking-tight lg:text-5xl">A real forest you can walk through</h1>
      </div>
      {selectedProfile && (
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white/70 backdrop-blur-xl">
          Playing as <span className="text-white font-medium">{selectedProfile.name}</span>
        </div>
      )}
    </div>
  );
}

// ── Intro ─────────────────────────────────────────────────────────────────
function IntroScreen({ game, setGame }) {
  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <div className="text-center max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-300/90">
          <SparklesIcon className="h-3 w-3" /> Guardians of Verdantia
        </div>
        <h2 className="text-4xl font-semibold tracking-tight lg:text-6xl leading-tight">The forest needs<br />a guardian.</h2>
        <p className="mt-4 text-base leading-7 text-white/65 max-w-xl mx-auto">Walk through Verdantia across 3 levels — collect debris, hear the communities, and face the council.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 w-full max-w-2xl">
        {[
          { icon: Droplets, colorClass: "cyan", level: "Level 1", title: "Clean the Forest", desc: "Collect all debris before the timer runs out" },
          { icon: Users, colorClass: "amber", level: "Level 2", title: "Hear the Communities", desc: "Walk to stations — questions appear automatically" },
          { icon: ShieldCheck, colorClass: "violet", level: "Level 3", title: "Face the Council", desc: "Complete the governance debrief" },
        ].map(({ icon: Icon, level, title, desc }) => (
          <div key={level} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <Icon className="h-6 w-6 text-white/60 mx-auto mb-2" />
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">{level}</div>
            <div className="font-medium text-white text-sm">{title}</div>
            <div className="mt-1 text-xs text-white/45">{desc}</div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">
        <Card className="border-white/10 bg-black/40 text-white backdrop-blur-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400/60 via-cyan-400/40 to-violet-400/60" />
          <CardContent className="p-6">
            <label className="mb-2 block text-sm font-medium text-white/80">Name your guardian</label>
            <Input value={game.playerName} onChange={(e) => setGame((prev) => ({ ...prev, playerName: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && setGame((prev) => ({ ...prev, phase: "character" }))}
              placeholder="e.g. Irene of Mossglade" className="border-white/10 bg-white/8 text-white placeholder:text-white/30" />
            <Button onClick={() => setGame((prev) => ({ ...prev, phase: "character" }))} className="mt-4 w-full rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-medium py-2.5 h-auto">
              Enter the forest <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="mt-3 text-center text-xs text-white/35">WASD to move · Shift to run · C for camera</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Character select ──────────────────────────────────────────────────────
function CharacterSelect({ playerName, chooseCharacter }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <div className="text-center max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-violet-300/90">Choose your guardian</div>
        <h2 className="text-3xl font-semibold lg:text-5xl tracking-tight">{playerName ? `${playerName}, who` : "Who"} will you become?</h2>
        <p className="mt-3 text-white/60 max-w-lg mx-auto">Your guardian shapes which paths open and how the forest speaks to you.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3 w-full max-w-4xl">
        {Object.entries(characterProfiles).map(([id, profile]) => {
          const Icon = profile.icon;
          const isHovered = hovered === id;
          return (
            <motion.div key={id} whileHover={{ y: -6, scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}
              onHoverStart={() => setHovered(id)} onHoverEnd={() => setHovered(null)}>
              <Card className={cx("h-full overflow-hidden text-white backdrop-blur-xl transition-all duration-300 border bg-black/40", isHovered ? accentBorder(profile.accent) : "border-white/10", isHovered ? accentGlow(profile.accent) : "")}>
                <div className={cx("h-1.5 bg-gradient-to-r", colorBand(profile.accent))} />
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Icon className="h-6 w-6 text-emerald-200" /></div>
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                  <CardDescription className="text-white/55 text-xs font-medium uppercase tracking-wide mt-0.5">{profile.title}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="mb-4 text-sm leading-6 text-white/70">{profile.description}</p>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {Object.entries(profile.bonus).map(([stat, val]) => (
                      <span key={stat} className={cx("rounded-full px-2.5 py-1 text-xs font-medium border bg-white/5 text-white/80", accentBorder(profile.accent))}>+{val} {stat}</span>
                    ))}
                  </div>
                  <Button onClick={() => chooseCharacter(id)} className={cx("w-full rounded-xl font-medium py-2.5 h-auto", accentBtn(profile.accent))}>Play as {profile.name.split(" ")[0]}</Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── HUD ───────────────────────────────────────────────────────────────────
function TopLeftHud({ selectedProfile, freeCamera, level }) {
  const info = LEVEL_INFO[level];
  const dotColor = selectedProfile ? { emerald: "bg-emerald-400", amber: "bg-amber-400", violet: "bg-violet-400" }[selectedProfile.accent] || "bg-white/40" : "bg-white/20";
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] px-3 py-2 text-xs flex items-center gap-2.5 max-w-[260px]">
      <div className={cx("h-2 w-2 rounded-full shrink-0", dotColor)} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-white/90 truncate">{selectedProfile?.name || "no guardian"}</span>
        <span className="text-white/45">Level {level} · {info.title} · {freeCamera ? "free cam" : "follow"}</span>
      </div>
    </div>
  );
}

function TopRightHud({ metrics, level, levelDone }) {
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] px-3 py-2.5 space-y-1.5 w-[200px]">
      <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-2 flex items-center justify-between">
        <span>ESG signals</span>
        <span className="text-white/30">{Object.values(levelDone).filter(Boolean).length}/3 done</span>
      </div>
      <MetricBar label="Environment" value={metrics.environment} tone="emerald" />
      <MetricBar label="Social" value={metrics.social} tone="amber" />
      <MetricBar label="Governance" value={metrics.governance} tone="violet" />
      <MetricBar label="Alignment" value={metrics.alignment} tone="sky" />
    </div>
  );
}

function ObjectiveHud({ game, evidenceCount }) {
  const { level } = game;
  const info = LEVEL_INFO[level];

  if (level === 1) {
    const collected = game.trashCollected.length;
    const total = TRASH_POSITIONS.length;
    const pct = Math.round((collected / total) * 100);
    const t = game.trashTimerLeft;
    const mins = Math.floor(t / 60);
    const secs = t % 60;
    const urgent = t < 20 && t > 0;
    return (
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] px-4 py-3 w-[230px]">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-cyan-400 shrink-0" />
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">Level 1 · {info.title}</span>
        </div>
        <div className={cx("text-3xl font-bold tabular-nums mb-1 transition-colors", urgent ? "text-rose-400" : t === 0 ? "text-white/30" : "text-cyan-300")}>
          {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`}
        </div>
        <div className="text-xs text-white/60 mb-2.5">{collected}/{total} pieces collected</div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div className="h-1.5 rounded-full bg-cyan-400" animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
        </div>
        <div className="mt-2 text-[10px] text-white/28">Walk over glowing piles to collect</div>
      </div>
    );
  }

  if (level === 2) {
    return (
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] px-4 py-3 w-[240px]">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">Level 2 · {info.title}</span>
        </div>
        <div className="space-y-1.5 text-xs">
          {LEVEL2_REQUIRED.map((id) => {
            const node = questNodes.find((n) => n.id === id);
            const done = QUICK_QUESTIONS[id].key in game.answers;
            return (
              <div key={id} className="flex items-center gap-2">
                {done ? <CheckCircle2 className="h-3 w-3 text-emerald-300 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-white/25 shrink-0" />}
                <span className={done ? "text-white/70" : "text-white/45"}>{node?.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-white/28">Walk close — questions appear automatically</div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] px-4 py-3 w-[220px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">Level 3 · {info.title}</span>
      </div>
      <div className="text-sm text-white/70 leading-relaxed mb-2">{info.desc}</div>
      {evidenceCount > 0 && <div className="text-xs text-violet-300 mb-1">Evidence: {evidenceCount}/3</div>}
      {game.policyChoice && <div className="flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="h-3 w-3" /><span>Policy chosen</span></div>}
    </div>
  );
}

function ControlStrip() {
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/55 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)]">
      <span className="font-semibold text-white">WASD</span> move · <span className="font-semibold text-white">Shift</span> run · <span className="font-semibold text-white">C</span> camera
    </div>
  );
}

function MetricBar({ label, value, tone }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-white/60"><span>{label}</span><span>{value}</span></div>
      <div className="h-1.5 rounded-full bg-white/10">
        <div className={cx("h-1.5 rounded-full bg-gradient-to-r", toneBar(tone))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// ── Quick quest popup (level 2 auto) ─────────────────────────────────────
function QuickQuestPopup({ nodeId, game, saveAnswer }) {
  const data = QUICK_QUESTIONS[nodeId];
  if (!data) return null;
  const answered = data.key in game.answers;
  const Icon = data.icon;
  return (
    <motion.div key={nodeId} initial={{ opacity: 0, y: 50, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className="pointer-events-auto w-full max-w-lg mx-auto">
      <div className="rounded-2xl border border-white/12 bg-black/80 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/8 flex items-center gap-3" style={{ background: data.color + "10" }}>
          <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: data.color + "22", border: `1px solid ${data.color}44` }}>
            <Icon className="h-3.5 w-3.5" style={{ color: data.color }} />
          </div>
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{data.npc}</span>
          {answered && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /><span>Signal recorded</span>
            </div>
          )}
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-white/90 leading-relaxed mb-4 font-medium">{data.question}</p>
          {answered ? (
            <div className="text-xs text-white/35 italic">You said: "{game.answers[data.key]}"</div>
          ) : (
            <div className="space-y-2">
              {data.options.map(([label, effects], i) => (
                <motion.button key={i} whileHover={{ x: 4, transition: { duration: 0.1 } }}
                  onClick={() => saveAnswer(data.key, label, effects)}
                  className="w-full text-left text-sm rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/75 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all cursor-pointer">
                  {label}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Level complete overlay ────────────────────────────────────────────────
function LevelCompleteOverlay({ level, onContinue }) {
  const info = LEVEL_INFO[level];
  const nextInfo = LEVEL_INFO[level + 1];
  useEffect(() => {
    const t = setTimeout(onContinue, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm cursor-pointer"
      onClick={onContinue}>
      <motion.div initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: -16 }} className="text-center px-8 py-10 max-w-sm">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
          className="mx-auto mb-5 h-16 w-16 rounded-full flex items-center justify-center"
          style={{ background: info.color + "22", border: `2px solid ${info.color}55` }}>
          <CheckCircle2 className="h-8 w-8" style={{ color: info.color }} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: info.color }}>Level {level} complete</div>
          <div className="text-2xl font-semibold text-white mb-1">{info.title}</div>
          {nextInfo ? (
            <div className="mt-4 space-y-1">
              <div className="text-xs text-white/40">Up next</div>
              <div className="text-sm text-white/70 font-medium">{nextInfo.title}</div>
              <div className="text-xs text-white/40">{nextInfo.desc}</div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-white/55">Verdantia is restored. Viewing your summary…</div>
          )}
          <div className="mt-5 text-[10px] text-white/22">Click anywhere to continue</div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ── 3D World ──────────────────────────────────────────────────────────────
function ForestWorld({ playerPos, setPlayerPos, nearestNodeId, setNearestNodeId, freeCamera, character, level, trashCollected, onCollect, answeredNodeKeys }) {
  const keysRef = useRef({});
  const playerPosRef = useRef(playerPos);
  const nearestNodeRef = useRef(null);
  const collectedRef = useRef(trashCollected);
  const cameraTarget = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  useEffect(() => { nearestNodeRef.current = nearestNodeId; }, [nearestNodeId]);
  useEffect(() => { collectedRef.current = trashCollected; }, [trashCollected]);

  useEffect(() => {
    function down(e) { keysRef.current[e.key.toLowerCase()] = true; }
    function up(e) { keysRef.current[e.key.toLowerCase()] = false; }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    const current = playerPosRef.current;
    const move = new THREE.Vector3();
    if (keys.w || keys.arrowup) move.z -= 1;
    if (keys.s || keys.arrowdown) move.z += 1;
    if (keys.a || keys.arrowleft) move.x -= 1;
    if (keys.d || keys.arrowright) move.x += 1;

    let nextX = current[0], nextY = current[1], nextZ = current[2];
    if (move.lengthSq() > 0) {
      move.normalize();
      const speed = PLAYER_SPEED * (keys.shift ? RUN_MULTIPLIER : 1);
      nextX = clamp(current[0] + move.x * speed * delta, -WORLD_RADIUS, WORLD_RADIUS);
      nextZ = clamp(current[2] + move.z * speed * delta, -WORLD_RADIUS, WORLD_RADIUS);
      if (nextX !== current[0] || nextZ !== current[2]) {
        const next = [nextX, nextY, nextZ];
        playerPosRef.current = next;
        setPlayerPos(next);
      }
    }

    // Auto-collect trash (level 1)
    if (level === 1) {
      TRASH_POSITIONS.forEach((item) => {
        if (collectedRef.current.includes(item.id)) return;
        const dx = item.pos[0] - nextX, dz = item.pos[2] - nextZ;
        if (Math.sqrt(dx * dx + dz * dz) < COLLECT_DISTANCE) onCollect(item.id);
      });
    }

    // Nearest quest node (levels 2+)
    if (level >= 2) {
      const relevantIds = new Set(questNodes.filter((n) => n.levels.includes(level)).map((n) => n.id));
      const { nearestId, nearestDist } = getNearestNodeInfo([nextX, nextY, nextZ]);
      const next = relevantIds.has(nearestId) && nearestDist <= INTERACT_DISTANCE ? nearestId : null;
      if (nearestNodeRef.current !== next) { nearestNodeRef.current = next; setNearestNodeId(next); }
    } else {
      if (nearestNodeRef.current !== null) { nearestNodeRef.current = null; setNearestNodeId(null); }
    }

    if (!freeCamera) {
      const desired = new THREE.Vector3(nextX, nextY + 8.5, nextZ + 11.5);
      camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
      cameraTarget.current.set(nextX, nextY + 1.2, nextZ);
      camera.lookAt(cameraTarget.current);
    }
  });

  return (
    <>
      <OrbitControls enabled={freeCamera} enablePan={false} maxPolarAngle={Math.PI / 2.05} minDistance={8} maxDistance={28} target={[0, 1, 0]} />
      <Ground />
      <River />
      <CouncilPlatform />
      <ForestTrees />
      <Lanterns />
      {level >= 2 && <QuestMarkers nearestNodeId={nearestNodeId} level={level} answeredNodeKeys={answeredNodeKeys} />}
      {level === 1 && TRASH_POSITIONS.map((item) => (
        <TrashItem key={item.id} position={item.pos} collected={trashCollected.includes(item.id)} />
      ))}
      <PlayerAvatar position={playerPos} character={character} />
    </>
  );
}

// ── Trash item (3D) ───────────────────────────────────────────────────────
function TrashItem({ position, collected }) {
  if (collected) return null;
  return (
    <group position={position}>
      <Float speed={1.8} floatIntensity={0.35} rotationIntensity={0.2}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.18, 0.32]} />
          <meshStandardMaterial color="#7a6a50" roughness={0.95} />
        </mesh>
        <mesh castShadow position={[0.14, 0.07, 0.1]} rotation={[0.4, 0.5, 0.2]}>
          <boxGeometry args={[0.18, 0.09, 0.22]} />
          <meshStandardMaterial color="#8f7e65" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.02, 14]} />
          <meshBasicMaterial color="#ffd588" transparent opacity={0.45} />
        </mesh>
      </Float>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.5, 0.7, 18]} />
        <meshBasicMaterial color="#ffd588" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ── Ground, River, CouncilPlatform, Trees, Lanterns ──────────────────────
function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[34, 64]} />
        <meshStandardMaterial color="#16301f" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <ringGeometry args={[18, 30, 48]} />
        <meshStandardMaterial color="#0f2317" roughness={1} />
      </mesh>
      {[...Array(30)].map((_, i) => (
        <mesh key={i} position={[Math.sin(i * 2.8) * (12 + (i % 8)), 0.05, Math.cos(i * 3.2) * (10 + ((i * 3) % 7))]} rotation={[-Math.PI / 2, 0, (i % 10) * 0.22]} receiveShadow>
          <circleGeometry args={[0.55 + (i % 3) * 0.16, 10]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#22492c" : "#295534"} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function River() {
  return (
    <group position={[-12, 0.02, 7]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh receiveShadow>
        <planeGeometry args={[12, 7]} />
        <meshStandardMaterial color="#45b4d8" emissive="#1b6f90" emissiveIntensity={0.45} transparent opacity={0.9} roughness={0.18} metalness={0.05} />
      </mesh>
    </group>
  );
}

function CouncilPlatform() {
  return (
    <group position={[11, 0, 8]}>
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[3.2, 3.8, 1, 6]} />
        <meshStandardMaterial color="#4b3a59" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.5, 0]}>
        <coneGeometry args={[1.6, 2.1, 6]} />
        <meshStandardMaterial color="#5e5072" roughness={0.9} />
      </mesh>
    </group>
  );
}

function ForestTrees() {
  const trees = useMemo(() => {
    const result = [];
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const radius = 12 + (i % 8) * 1.6 + ((i * 17) % 10) * 0.35;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      result.push({ x, z, scale: 0.9 + (i % 5) * 0.14, hue: i % 3, glow: i % 7 === 0 });
    }
    return result;
  }, []);
  return (
    <group>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]} scale={tree.scale}>
          <mesh castShadow receiveShadow position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.22, 0.32, 2.4, 8]} />
            <meshStandardMaterial color="#5c4227" roughness={1} />
          </mesh>
          <mesh castShadow position={[0, 2.6, 0]}>
            <coneGeometry args={[1.6, 3.2, 10]} />
            <meshStandardMaterial color={tree.hue === 0 ? "#214b2d" : tree.hue === 1 ? "#295534" : "#355f3c"} roughness={1} />
          </mesh>
          <mesh castShadow position={[0, 3.5, 0]}>
            <coneGeometry args={[1.25, 2.5, 10]} />
            <meshStandardMaterial color={tree.hue === 0 ? "#2b5e39" : tree.hue === 1 ? "#3d7246" : "#3b6b42"} roughness={1} />
          </mesh>
          {tree.glow && (
            <Float floatIntensity={1.1} speed={1.05} rotationIntensity={0.2}>
              <mesh position={[0.7, 2.1, 0.4]}>
                <sphereGeometry args={[0.08, 10, 10]} />
                <meshStandardMaterial emissive="#9fe8ff" color="#9fe8ff" emissiveIntensity={2.1} />
              </mesh>
            </Float>
          )}
        </group>
      ))}
    </group>
  );
}

function Lanterns() {
  const points = [[-8, 0.2, 1], [-1, 0.2, -2], [6, 0.2, 1], [12, 0.2, -2]];
  return (
    <group>
      {points.map((p, i) => (
        <group key={i} position={p}>
          <mesh castShadow position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 2.2, 8]} />
            <meshStandardMaterial color="#604b34" />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshStandardMaterial color="#ffd88f" emissive="#ffd88f" emissiveIntensity={1.2} />
          </mesh>
          <pointLight intensity={0.55} distance={6} color="#ffd88f" position={[0, 2.2, 0]} />
        </group>
      ))}
    </group>
  );
}

function QuestMarkers({ nearestNodeId, level, answeredNodeKeys }) {
  const visible = questNodes.filter((n) => n.levels.includes(level));
  return (
    <group>
      {visible.map((node) => (
        <QuestMarker key={node.id} node={node} highlighted={nearestNodeId === node.id} answered={answeredNodeKeys.includes(node.id + "_q")} />
      ))}
    </group>
  );
}

function QuestMarker({ node, highlighted, answered }) {
  const color = answered ? "#34d399" : node.color;
  const emissive = answered ? 0.5 : highlighted ? 2.1 : 1.1;
  return (
    <group position={node.pos}>
      <Float speed={1.45} rotationIntensity={0.22} floatIntensity={0.55}>
        <mesh castShadow>
          <sphereGeometry args={[highlighted ? 0.82 : 0.68, 20, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} roughness={0.2} metalness={0.05} />
        </mesh>
      </Float>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.15, 1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={highlighted ? 0.55 : 0.28} />
      </mesh>
      <SimpleWorldLabel label={node.label} position={[0, 1.55, 0]} />
    </group>
  );
}

function SimpleWorldLabel({ label, position }) {
  const width = Math.max(2.2, Math.min(4.8, label.length * 0.14 + 1.2));
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[width, 0.5, 0.14]} />
        <meshBasicMaterial color="#111827" transparent opacity={0.82} />
      </mesh>
      <Text position={[0, 0, 0.08]} fontSize={0.18} color="#e5f6ee" anchorX="center" anchorY="middle" maxWidth={width - 0.3}>{label}</Text>
    </group>
  );
}

// ── Character models ──────────────────────────────────────────────────────
function BeaverModel() {
  return (
    <group>
      <mesh castShadow position={[0, 0.92, 0]}><cylinderGeometry args={[0.52, 0.62, 1.4, 14]} /><meshStandardMaterial color="#7a5230" roughness={0.85} /></mesh>
      <mesh position={[0, 0.92, 0.52]}><cylinderGeometry args={[0.28, 0.34, 1.3, 10]} /><meshStandardMaterial color="#c9986a" roughness={0.9} /></mesh>
      <mesh castShadow position={[0, 1.98, 0]}><sphereGeometry args={[0.46, 18, 18]} /><meshStandardMaterial color="#7a5230" roughness={0.85} /></mesh>
      <mesh castShadow position={[0, 1.86, 0.38]}><boxGeometry args={[0.38, 0.22, 0.22]} /><meshStandardMaterial color="#c9986a" roughness={0.9} /></mesh>
      <mesh position={[0.09, 1.77, 0.54]}><boxGeometry args={[0.11, 0.17, 0.07]} /><meshStandardMaterial color="#fffff0" roughness={0.3} /></mesh>
      <mesh position={[-0.09, 1.77, 0.54]}><boxGeometry args={[0.11, 0.17, 0.07]} /><meshStandardMaterial color="#fffff0" roughness={0.3} /></mesh>
      <mesh position={[0, 1.94, 0.53]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#1a0d00" /></mesh>
      <mesh castShadow position={[0.33, 2.36, -0.06]}><sphereGeometry args={[0.13, 10, 10]} /><meshStandardMaterial color="#5a3a1a" roughness={0.85} /></mesh>
      <mesh castShadow position={[-0.33, 2.36, -0.06]}><sphereGeometry args={[0.13, 10, 10]} /><meshStandardMaterial color="#5a3a1a" roughness={0.85} /></mesh>
      <mesh castShadow position={[0, 0.28, -0.7]} rotation={[0.35, 0, 0]}><boxGeometry args={[0.72, 0.13, 1.05]} /><meshStandardMaterial color="#4a2e10" roughness={0.95} /></mesh>
      <mesh castShadow position={[0.6, 1.1, 0.18]} rotation={[0.4, 0, 0.5]}><cylinderGeometry args={[0.1, 0.12, 0.5, 8]} /><meshStandardMaterial color="#7a5230" roughness={0.85} /></mesh>
      <mesh castShadow position={[-0.6, 1.1, 0.18]} rotation={[0.4, 0, -0.5]}><cylinderGeometry args={[0.1, 0.12, 0.5, 8]} /><meshStandardMaterial color="#7a5230" roughness={0.85} /></mesh>
    </group>
  );
}

function FoxModel() {
  return (
    <group>
      <mesh castShadow position={[0, 0.96, 0]}><cylinderGeometry args={[0.38, 0.44, 1.45, 12]} /><meshStandardMaterial color="#c8621a" roughness={0.8} /></mesh>
      <mesh position={[0, 0.96, 0.35]}><cylinderGeometry args={[0.18, 0.22, 1.3, 10]} /><meshStandardMaterial color="#f5e8d0" roughness={0.85} /></mesh>
      <mesh castShadow position={[0, 2.02, 0]}><sphereGeometry args={[0.4, 18, 18]} /><meshStandardMaterial color="#c8621a" roughness={0.8} /></mesh>
      <mesh castShadow position={[0, 1.88, 0.48]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.17, 0.42, 10]} /><meshStandardMaterial color="#e8d8bc" roughness={0.85} /></mesh>
      <mesh position={[0, 1.9, 0.72]}><sphereGeometry args={[0.065, 8, 8]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh castShadow position={[0.3, 2.46, -0.08]} rotation={[0.15, 0.25, 0.15]}><coneGeometry args={[0.16, 0.44, 8]} /><meshStandardMaterial color="#c8621a" roughness={0.8} /></mesh>
      <mesh castShadow position={[-0.3, 2.46, -0.08]} rotation={[0.15, -0.25, -0.15]}><coneGeometry args={[0.16, 0.44, 8]} /><meshStandardMaterial color="#c8621a" roughness={0.8} /></mesh>
      <mesh position={[0.3, 2.52, -0.04]} rotation={[0.15, 0.25, 0.15]}><coneGeometry args={[0.08, 0.28, 8]} /><meshStandardMaterial color="#e07060" roughness={0.9} /></mesh>
      <mesh position={[-0.3, 2.52, -0.04]} rotation={[0.15, -0.25, -0.15]}><coneGeometry args={[0.08, 0.28, 8]} /><meshStandardMaterial color="#e07060" roughness={0.9} /></mesh>
      <mesh castShadow position={[0.1, 0.65, -0.7]} rotation={[-0.7, 0.2, 0]}><cylinderGeometry args={[0.26, 0.12, 1.0, 10]} /><meshStandardMaterial color="#c8621a" roughness={0.9} /></mesh>
      <mesh castShadow position={[0.15, 1.18, -1.0]} rotation={[-0.2, 0.2, 0]}><sphereGeometry args={[0.28, 10, 10]} /><meshStandardMaterial color="#f5f0e8" roughness={0.9} /></mesh>
      <mesh castShadow position={[0.22, 0.22, 0.12]}><cylinderGeometry args={[0.1, 0.1, 0.45, 8]} /><meshStandardMaterial color="#a84e14" roughness={0.85} /></mesh>
      <mesh castShadow position={[-0.22, 0.22, 0.12]}><cylinderGeometry args={[0.1, 0.1, 0.45, 8]} /><meshStandardMaterial color="#a84e14" roughness={0.85} /></mesh>
    </group>
  );
}

function OwlModel() {
  return (
    <group>
      <mesh castShadow position={[0, 0.92, 0]}><sphereGeometry args={[0.55, 16, 16]} /><meshStandardMaterial color="#6b5fa0" roughness={0.85} /></mesh>
      <mesh position={[0, 0.85, 0.5]}><sphereGeometry args={[0.3, 12, 12]} /><meshStandardMaterial color="#d4c8f0" roughness={0.85} /></mesh>
      <mesh castShadow position={[0, 1.98, 0]}><sphereGeometry args={[0.52, 20, 20]} /><meshStandardMaterial color="#6b5fa0" roughness={0.85} /></mesh>
      <mesh position={[0, 1.92, 0.42]}><sphereGeometry args={[0.35, 14, 14]} /><meshStandardMaterial color="#bbaee8" roughness={0.9} /></mesh>
      <mesh position={[0.18, 2.04, 0.56]}><sphereGeometry args={[0.13, 12, 12]} /><meshStandardMaterial color="#f5c842" emissive="#f5c842" emissiveIntensity={0.4} /></mesh>
      <mesh position={[-0.18, 2.04, 0.56]}><sphereGeometry args={[0.13, 12, 12]} /><meshStandardMaterial color="#f5c842" emissive="#f5c842" emissiveIntensity={0.4} /></mesh>
      <mesh position={[0.18, 2.04, 0.67]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
      <mesh position={[-0.18, 2.04, 0.67]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
      <mesh position={[0, 1.88, 0.68]} rotation={[0.5, 0, 0]}><coneGeometry args={[0.07, 0.22, 8]} /><meshStandardMaterial color="#d4a840" roughness={0.5} /></mesh>
      <mesh castShadow position={[0.32, 2.52, -0.08]} rotation={[0.1, 0.2, 0.22]}><coneGeometry args={[0.1, 0.35, 7]} /><meshStandardMaterial color="#4a3870" roughness={0.85} /></mesh>
      <mesh castShadow position={[-0.32, 2.52, -0.08]} rotation={[0.1, -0.2, -0.22]}><coneGeometry args={[0.1, 0.35, 7]} /><meshStandardMaterial color="#4a3870" roughness={0.85} /></mesh>
      <mesh castShadow position={[0.6, 0.9, -0.1]} rotation={[0.2, 0, 0.55]}><boxGeometry args={[0.5, 0.9, 0.12]} /><meshStandardMaterial color="#524480" roughness={0.9} /></mesh>
      <mesh castShadow position={[-0.6, 0.9, -0.1]} rotation={[0.2, 0, -0.55]}><boxGeometry args={[0.5, 0.9, 0.12]} /><meshStandardMaterial color="#524480" roughness={0.9} /></mesh>
      <mesh castShadow position={[0.22, 0.2, 0.1]}><cylinderGeometry args={[0.1, 0.08, 0.38, 8]} /><meshStandardMaterial color="#4a3870" roughness={0.85} /></mesh>
      <mesh castShadow position={[-0.22, 0.2, 0.1]}><cylinderGeometry args={[0.1, 0.08, 0.38, 8]} /><meshStandardMaterial color="#4a3870" roughness={0.85} /></mesh>
    </group>
  );
}

function PlayerAvatar({ position, character }) {
  return (
    <group position={position}>
      <Float floatIntensity={0.14} speed={1.5} rotationIntensity={0.06}>
        {character === "beaver" && <BeaverModel />}
        {character === "fox" && <FoxModel />}
        {character === "owl" && <OwlModel />}
        {!character && <BeaverModel />}
      </Float>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.85, 1.15, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

// ── Council modal (level 3) ───────────────────────────────────────────────
function CouncilModal({ game, closeModal, saveAnswer, saveVoice, findEvidence, choosePolicy }) {
  const evidenceCount = Object.values(game.evidenceFound).filter(Boolean).length;
  const NPC = { name: "The Archivist · Hollow Council", icon: ShieldCheck, color: "#b89cff" };
  const [iStep, setIStep] = useState(0);
  const [iAnswers, setIAnswers] = useState(["", "", ""]);
  const [iDone, setIDone] = useState([false, false, false]);
  const [thinking, setThinking] = useState(false);

  const interviewQs = [
    "When did you last feel like leadership genuinely delivered on something it promised — not just announced, but actually followed through?",
    "Three different reports. Three different conclusions. Nobody agrees what they mean. What does that tell you about how decisions actually get made?",
    "If you could send one anonymous message to the people at the top — something they genuinely had to act on — what would it say?",
  ];

  const advanceInterview = (idx) => {
    const val = iAnswers[idx].trim();
    if (!val || thinking) return;
    const newDone = [...iDone]; newDone[idx] = true; setIDone(newDone);
    saveVoice(`council_q${idx + 1}`, val);
    saveAnswer(`council_q${idx + 1}_interview`, val, { governance: 2, alignment: 1 });
    setThinking(true);
    setTimeout(() => { setThinking(false); setIStep(idx + 2); }, 750);
  };

  const allInterviewDone = iDone.every(Boolean);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,11,0.98),rgba(12,14,22,0.98))] p-6 text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)]">

        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <Badge className="mb-2 bg-violet-500/20 text-violet-100">Governance · Level 3</Badge>
            <h3 className="text-2xl font-semibold">Hollow Council</h3>
            <p className="mt-1 text-white/60 text-sm">You've reached the heart of Verdantia's governance.</p>
          </div>
          <Button variant="outline" onClick={closeModal} className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 shrink-0">close</Button>
        </div>

        <NpcSpeech name={NPC.name} icon={NPC.icon} color={NPC.color}>
          Come in quietly. There are records here the council hasn't shared. Before we look at what I found — I need your perspective first.
        </NpcSpeech>

        <div className="mt-5 rounded-2xl overflow-hidden border" style={{ borderColor: NPC.color + "22" }}>
          <div className="px-5 py-3.5 flex items-center gap-3 border-b" style={{ background: NPC.color + "08", borderColor: NPC.color + "18" }}>
            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: NPC.color }} />
            <span className="text-xs font-medium text-white/65">Governance debrief — 3 questions</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => <div key={i} className="h-1 w-8 rounded-full transition-all duration-500" style={{ background: iDone[i] ? NPC.color : NPC.color + "28" }} />)}
              </div>
              <span className="text-[10px] text-white/30 font-medium">{iDone.filter(Boolean).length}/3</span>
            </div>
          </div>

          {iStep === 0 ? (
            <div className="p-6">
              <p className="text-sm text-white/60 mb-5 leading-relaxed">Three questions. Anonymous. No right answers — only honest ones.</p>
              <button onClick={() => setIStep(1)} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-950 transition-all hover:opacity-90" style={{ background: NPC.color }}>
                Start the debrief →
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {[0, 1, 2].map((idx) => {
                if (idx + 1 > iStep) return null;
                const isDone = iDone[idx];
                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: isDone ? NPC.color + "30" : NPC.color + "14", color: NPC.color, border: `1px solid ${NPC.color}${isDone ? "55" : "30"}` }}>
                        {isDone ? "✓" : idx + 1}
                      </div>
                      <p className="text-sm text-white/88 leading-relaxed pt-0.5">{interviewQs[idx]}</p>
                    </div>
                    {isDone ? (
                      <div className="ml-8 text-xs text-white/28 italic px-3 py-2.5 rounded-xl bg-white/3 border border-white/8 leading-relaxed">"{iAnswers[idx]}"</div>
                    ) : (
                      <div className="ml-8 space-y-2.5">
                        <Textarea value={iAnswers[idx]}
                          onChange={(e) => { const next = [...iAnswers]; next[idx] = e.target.value; setIAnswers(next); }}
                          placeholder="Type your honest answer…"
                          className="min-h-[80px] border-white/8 bg-white/4 text-white placeholder:text-white/18 text-sm resize-none leading-relaxed"
                          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) advanceInterview(idx); }} />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/20">{iAnswers[idx].length > 0 ? `${iAnswers[idx].length} chars` : "⌘↵ to continue"}</span>
                          <button onClick={() => advanceInterview(idx)} disabled={!iAnswers[idx].trim() || thinking}
                            className="rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
                            style={{ background: NPC.color }}>
                            {idx === 2 ? "Complete →" : "Next →"}
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
              {thinking && <div className="flex gap-1.5 items-center py-1 ml-8">{[0,1,2].map(i=><span key={i} className="h-1.5 w-1.5 rounded-full bg-white/22 animate-bounce" style={{animationDelay:`${i*150}ms`}}/>)}</div>}
              {allInterviewDone && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="ml-8 flex items-center gap-2 text-xs text-emerald-300 pt-0.5"><CheckCircle2 className="h-3.5 w-3.5"/><span>All responses recorded anonymously</span></motion.div>}
            </div>
          )}
        </div>

        {allInterviewDone && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
            <div className="text-xs text-white/40 uppercase tracking-wide font-medium flex items-center gap-2">
              <Eye className="h-3 w-3" /> Examine the records — {evidenceCount}/3 found
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <EvidenceTile title="Hidden Ledger" text="Repairs promised but never resourced." found={game.evidenceFound.hiddenLedger} onFind={() => findEvidence("hiddenLedger", { governance: 5, alignment: 3 })} />
              <EvidenceTile title="Missing Minutes" text="Council debates never shared with the forest." found={game.evidenceFound.missingMinutes} onFind={() => findEvidence("missingMinutes", { governance: 4, alignment: 2 })} />
              <EvidenceTile title="Broken Seal" text="A public decree quietly altered after the ceremony." found={game.evidenceFound.brokenSeal} onFind={() => findEvidence("brokenSeal", { governance: 6, social: 2 })} />
            </div>
            <DialogueQuestion npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
              question="A young hare asks: what actually makes a leader credible — not in theory, but to you personally?"
              current={game.answers.gov_credibility} onSelect={saveAnswer}
              options={[
                ["gov_credibility", "Consistent follow-through that people can actually observe", { governance: 4, alignment: 4 }],
                ["gov_credibility", "A strong long-term vision, even when day-to-day is messy", { governance: 2 }],
                ["gov_credibility", "Symbolic wins — visible moments that signal the direction", { alignment: -2 }],
              ]} />
          </motion.div>
        )}

        {allInterviewDone && evidenceCount >= 1 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
            <div className="text-xs text-white/40 uppercase tracking-wide font-medium">How should the council respond?</div>
            <div className="grid gap-4 md:grid-cols-3">
              <PolicyCard active={game.policyChoice === "transparency-charter"} title="Transparency Charter" text="Publish all decisions and progress to the entire forest." impact="strongest trust boost" onClick={() => choosePolicy("transparency-charter", { governance: 8, alignment: 7 })} />
              <PolicyCard active={game.policyChoice === "guardian-panel"} title="Citizen Guardian Panel" text="Bring rotating representatives into council decisions." impact="boosts inclusion" onClick={() => choosePolicy("guardian-panel", { governance: 6, social: 5, alignment: 5 })} />
              <PolicyCard active={game.policyChoice === "elite-taskforce"} title="Elite Taskforce" text="Keep decisions with expert advisors to move faster." impact="efficient — but exclusive" onClick={() => choosePolicy("elite-taskforce", { governance: 2, social: -3, alignment: -4 })} />
            </div>
            {game.policyChoice && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-xs text-white/35 italic text-center pt-1">You may close this panel and return to the forest.</motion.div>}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Dialogue components ───────────────────────────────────────────────────
function NpcSpeech({ name, icon: Icon, color, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-start">
      <div className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center border" style={{ background: color + "20", borderColor: color + "50" }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-white/35 mb-1.5 uppercase tracking-wide font-medium">{name}</div>
        <div className="rounded-2xl rounded-tl-sm bg-white/8 border border-white/10 px-4 py-3 text-sm text-white/85 leading-relaxed">{children}</div>
      </div>
    </motion.div>
  );
}

function DialogueQuestion({ npcName, npcIcon, npcColor, question, options, current, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const selected = options.find(([, label]) => current === label);
  return (
    <div className="space-y-3">
      <NpcSpeech name={npcName} icon={npcIcon} color={npcColor}>{question}</NpcSpeech>
      <div className="pl-12 space-y-2">
        {options.map(([key, label, effects], i) => {
          const isSelected = selected && selected[1] === label;
          const isOther = selected && !isSelected;
          const impactEntries = Object.entries(effects || {}).filter(([, v]) => v !== 0).slice(0, 2);
          return (
            <motion.button key={i} whileHover={!selected ? { x: 4, transition: { duration: 0.12 } } : {}}
              onHoverStart={() => !selected && setHovered(i)} onHoverEnd={() => setHovered(null)}
              onClick={() => !selected && onSelect(key, label, effects)}
              className={cx("w-full text-left rounded-2xl px-4 py-3.5 text-sm transition-all border",
                isSelected ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                  : isOther ? "border-white/5 text-white/20 cursor-default"
                  : "border-white/10 bg-white/5 text-white/75 hover:bg-white/8 hover:border-white/20 hover:text-white cursor-pointer")}>
              <div className="flex items-center justify-between gap-3 min-w-0">
                <span className="leading-snug">{label}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  {!selected && hovered === i && impactEntries.map(([k, v]) => (
                    <span key={k} className={cx("text-[10px] font-bold rounded-full px-1.5 py-0.5 border", v > 0 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" : "bg-rose-500/15 text-rose-300 border-rose-500/20")}>
                      {v > 0 ? "+" : ""}{v} {k.slice(0, 3)}
                    </span>
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      {selected && <motion.div initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="pl-12 text-xs text-white/35 italic">You chose: "{selected[1]}"</motion.div>}
    </div>
  );
}

function EvidenceTile({ title, text, found, onFind }) {
  return (
    <button type="button" onClick={onFind} className={cx("rounded-2xl border p-4 text-left transition w-full", found ? "border-violet-300 bg-violet-400/15" : "border-white/10 bg-black/20 hover:bg-white/8 cursor-pointer")}>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium text-sm">{title}</div>
        {found ? <CheckCircle2 className="h-4 w-4 text-violet-200" /> : <Eye className="h-4 w-4 text-white/40" />}
      </div>
      <div className="text-xs text-white/55 leading-relaxed">{text}</div>
    </button>
  );
}

function PolicyCard({ title, text, impact, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cx("rounded-2xl border p-4 text-left transition w-full", active ? "border-emerald-300 bg-emerald-400/15" : "border-white/10 bg-black/20 hover:bg-white/8 cursor-pointer")}>
      <div className="font-medium text-sm mb-1.5">{title}</div>
      <div className="text-xs text-white/55 leading-relaxed mb-3">{text}</div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/70">{impact}</div>
    </button>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────
function SummaryScreen({ game, selectedProfile, forestStatus, evidenceCount, restart }) {
  const metrics = [
    { label: "Environmental balance", value: game.metrics.environment, icon: Leaf },
    { label: "Social harmony", value: game.metrics.social, icon: Users },
    { label: "Governance trust", value: game.metrics.governance, icon: ShieldCheck },
    { label: "Alignment", value: game.metrics.alignment, icon: Crown },
  ];
  const communityAnswers = LEVEL2_REQUIRED.filter((id) => QUICK_QUESTIONS[id].key in game.answers).length;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
          <CardHeader>
            <Badge className="mb-2 w-fit bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/20">forest restoration summary</Badge>
            <CardTitle className="text-3xl">{forestStatus.label}</CardTitle>
            <CardDescription className={cx("text-base", forestStatus.tone)}>{forestStatus.desc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Your playthrough</CardTitle>
            <CardDescription className="text-white/65">What you accomplished across 3 levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/75">
            <StatusRow label="Guardian" value={selectedProfile?.name || "None"} />
            <StatusRow label="Levels completed" value={`${Object.values(game.levelDone).filter(Boolean).length}/3`} />
            <StatusRow label="Trash collected" value={`${game.trashCollected.length}/${TRASH_POSITIONS.length}`} />
            <StatusRow label="Communities heard" value={`${communityAnswers}/4`} />
            <StatusRow label="Council clues" value={`${evidenceCount}/3 found`} />
            <StatusRow label="Policy chosen" value={formatPolicy(game.policyChoice)} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-300" /> Simulated ESG signal output</CardTitle>
          <CardDescription className="text-white/65">How leadership might interpret this run</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <InsightPill title="Environmental signal" text={game.metrics.environment >= 70 ? "Environmental action appears visible, practical, and believable." : "Environmental effort may exist but doesn't yet feel consistently tangible to employees."} />
          <InsightPill title="Social signal" text={game.metrics.social >= 70 ? "The forest feels fairly heard and represented across groups." : "Gaps in fairness, representation, or psychological safety are likely."} />
          <InsightPill title="Governance signal" text={game.metrics.governance >= 70 ? "Leadership appears credible, transparent, and accountable." : "Employees may perceive weak follow-through or low institutional trust."} />
          <InsightPill title="Alignment signal" text={game.metrics.alignment >= 70 ? "Management vision and lived experience appear relatively aligned." : "The strongest signal is a mismatch between what leaders say and what people feel daily."} />
        </CardContent>
      </Card>

      {Object.keys(game.voiceSaved).length > 0 && (
        <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Collected voice signals</CardTitle>
            <CardDescription className="text-white/65">Anonymous responses from the governance debrief</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-white/70">
              {Object.entries(game.voiceSaved).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="text-[10px] text-white/35 uppercase tracking-wide mb-1">{key.replace(/_/g, " ")}</div>
                  <div className="leading-relaxed">{String(value)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
        <CardHeader><CardTitle>Prototype checks</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-white/75">
          {SELF_CHECKS.map((t) => <StatusRow key={t.name} label={t.name} value={t.pass ? "pass" : "fail"} />)}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={restart} className="rounded-xl bg-white text-slate-950 hover:bg-white/90">Play again</Button>
        <Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10">Export mocked report</Button>
      </div>
    </div>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-white/60">{label}</span>
      <span className="text-right font-medium text-white/90">{value}</span>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><Icon className="h-5 w-5 text-emerald-200" /></div>
        <Badge className="bg-white/10 text-white hover:bg-white/10">{value}/100</Badge>
      </div>
      <div className="text-sm text-white/60">{label}</div>
      <div className="mt-3 h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gradient-to-r from-emerald-300 via-lime-300 to-sky-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function InsightPill({ title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-1 font-medium text-white text-sm">{title}</div>
      <div className="text-xs text-white/70 leading-relaxed">{text}</div>
    </div>
  );
}

export default App;
