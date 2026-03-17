import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Crown,
  Droplets,
  Eye,
  Hammer,
  Leaf,
  Mic,
  Scale,
  ScrollText,
  ShieldCheck,
  Sparkles as SparklesIcon,
  Trees,
  Users,
} from "lucide-react";


const PLAYER_SPEED = 5.5;
const RUN_MULTIPLIER = 1.5;
const INTERACT_DISTANCE = 5.6;
const WORLD_RADIUS = 22;
const START_PLAYER_POS = [0, 0.7, 14];

const characterProfiles = {
  beaver: {
    name: "Brindle the Beaver",
    title: "Builder of Balance",
    icon: Hammer,
    description: "Hands-on and practical. More building, environmental action, and visible repair.",
    bonus: { environment: 4, alignment: 1 },
    accent: "emerald",
  },
  fox: {
    name: "Sable the Fox",
    title: "Mediator of the Glades",
    icon: Scale,
    description: "Diplomatic and strategic. More negotiation energy and social framing.",
    bonus: { social: 4, alignment: 1 },
    accent: "amber",
  },
  owl: {
    name: "Aster the Owl",
    title: "Watcher of the Council",
    icon: Eye,
    description: "Reflective and investigative. More clues, governance focus, and reflective prompts.",
    bonus: { governance: 4, alignment: 1 },
    accent: "violet",
  },
};

const questNodes = [
  {
    id: "river",
    label: "Overflowing River",
    chapter: "Environment",
    type: "quest",
    pos: [-10, 0.65, 6],
    color: "#6ee7ff",
    icon: Droplets,
    description: "The river has burst beyond its banks, and workers near the water say the risk feels more urgent than the council admits.",
  },
  {
    id: "otter",
    label: "Otter Engineer",
    chapter: "Environment",
    type: "npc",
    pos: [-4, 0.65, 2.8],
    color: "#7bf1b5",
    icon: Leaf,
    description: "An otter engineer wants practical repairs, visible progress, and honest environmental reporting.",
  },
  {
    id: "meadow",
    label: "Meadow Accord",
    chapter: "Social",
    type: "quest",
    pos: [5.8, 0.65, -4.5],
    color: "#ffca76",
    icon: Users,
    description: "Three groups are competing for support, space, and representation. Harmony depends on what you prioritize.",
  },
  {
    id: "deer",
    label: "Deer Circle",
    chapter: "Social",
    type: "npc",
    pos: [11.6, 0.65, -8.5],
    color: "#c8f27e",
    icon: Trees,
    description: "The deer want fairness, belonging, and proof that not all burden will land on the same groups.",
  },
  {
    id: "council",
    label: "Hollow Council",
    chapter: "Governance",
    type: "quest",
    pos: [11, 0.65, 8],
    color: "#b89cff",
    icon: ShieldCheck,
    description: "In the council hollow, polished promises hide inconsistent decisions, missing reports, and weak accountability.",
  },
  {
    id: "archive",
    label: "Archive Tree",
    chapter: "Governance",
    type: "npc",
    pos: [16.3, 0.65, 3.8],
    color: "#8fd4ff",
    icon: ScrollText,
    description: "The archive tree contains clues about what leaders say, what they document, and what they leave out.",
  },
];

const initialState = {
  phase: "intro",
  playerName: "",
  selectedCharacter: null,
  metrics: {
    environment: 52,
    social: 51,
    governance: 49,
    alignment: 46,
  },
  answers: {},
  voiceSaved: {},
  voiceDraft: "",
  activeNode: null,
  visited: {},
  damSlots: [false, false, false, false, false],
  riverRisk: 68,
  socialResources: 9,
  trust: {
    otters: 48,
    deer: 42,
    badgers: 38,
  },
  evidenceFound: {
    hiddenLedger: false,
    missingMinutes: false,
    brokenSeal: false,
  },
  policyChoice: null,
  log: [],
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}
function Badge({ className = "", children }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", className)}>{children}</span>;
}

function Button({ className = "", variant, children, ...props }) {
  const base =
    variant === "outline"
      ? "inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
      : "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50";
  return (
    <button className={cx(base, className)} {...props}>
      {children}
    </button>
  );
}

function Card({ className = "", children }) {
  return <div className={cx("rounded-3xl border border-white/10", className)}>{children}</div>;
}

function CardHeader({ className = "", children }) {
  return <div className={cx("p-6 pb-3", className)}>{children}</div>;
}

function CardTitle({ className = "", children }) {
  return <h3 className={cx("text-xl font-semibold", className)}>{children}</h3>;
}

function CardDescription({ className = "", children }) {
  return <p className={cx("mt-1 text-sm", className)}>{children}</p>;
}

function CardContent({ className = "", children }) {
  return <div className={cx("p-6 pt-0", className)}>{children}</div>;
}

function Input({ className = "", ...props }) {
  return <input className={cx("w-full rounded-xl border px-3 py-2 text-sm outline-none", className)} {...props} />;
}

function Textarea({ className = "", ...props }) {
  return <textarea className={cx("w-full rounded-xl border px-3 py-2 text-sm outline-none", className)} {...props} />;
}

function Progress({ value = 0, className = "" }) {
  return (
    <div className={cx("w-full overflow-hidden rounded-full", className)}>
      <div className="h-full rounded-full bg-white" style={{ width: `${value}%` }} />
    </div>
  );
}

function Slider({ value = [50], min = 0, max = 100, step = 1, onValueChange }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      className="w-full"
    />
  );
}
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function applyEffects(metrics, effects) {
  const next = { ...metrics };
  Object.entries(effects || {}).forEach(([key, delta]) => {
    next[key] = clamp((next[key] ?? 0) + delta, 0, 100);
  });
  return next;
}

function formatPolicy(policy) {
  return {
    "transparency-charter": "Transparency Charter",
    "guardian-panel": "Citizen Guardian Panel",
    "elite-taskforce": "Elite Taskforce",
  }[policy] || "None";
}

function colorBand(accent) {
  return {
    emerald: "from-emerald-500/40 to-cyan-400/20",
    amber: "from-amber-500/40 to-rose-400/20",
    violet: "from-violet-500/40 to-sky-400/20",
  }[accent] || "from-emerald-500/40 to-cyan-400/20";
}

function badgeTone(chapter) {
  return {
    Environment: "bg-cyan-500/20 text-cyan-100",
    Social: "bg-amber-500/20 text-amber-100",
    Governance: "bg-violet-500/20 text-violet-100",
  }[chapter] || "bg-white/10 text-white";
}

function toneBar(tone) {
  return {
    emerald: "from-emerald-300 to-lime-300",
    amber: "from-amber-300 to-orange-300",
    violet: "from-violet-300 to-fuchsia-300",
    sky: "from-sky-300 to-cyan-300",
  }[tone] || "from-emerald-300 to-lime-300";
}

function accentBtn(accent) {
  return {
    emerald: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
    amber: "bg-amber-400 text-slate-950 hover:bg-amber-300",
    violet: "bg-violet-500 text-white hover:bg-violet-400",
  }[accent] || "bg-white text-slate-950 hover:bg-white/90";
}

function accentBorder(accent) {
  return {
    emerald: "border-emerald-400/40",
    amber: "border-amber-400/40",
    violet: "border-violet-400/40",
  }[accent] || "border-white/10";
}

function accentGlow(accent) {
  return {
    emerald: "shadow-[0_0_32px_rgba(52,211,153,0.12)]",
    amber: "shadow-[0_0_32px_rgba(251,191,36,0.12)]",
    violet: "shadow-[0_0_32px_rgba(167,139,250,0.12)]",
  }[accent] || "";
}

function getNearestNodeInfo(position) {
  let nearestId = null;
  let nearestDist = Infinity;
  questNodes.forEach((node) => {
    const dx = node.pos[0] - position[0];
    const dz = node.pos[2] - position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = node.id;
    }
  });
  return { nearestId, nearestDist };
}

function runSelfChecks() {
  const tests = [];
  tests.push({
    name: "clamp keeps values within bounds",
    pass: clamp(140, 0, 100) === 100 && clamp(-4, 0, 100) === 0 && clamp(55, 0, 100) === 55,
  });
  tests.push({
    name: "applyEffects updates metrics safely",
    pass:
      applyEffects({ environment: 50, social: 10 }, { environment: 10, alignment: 5 }).environment === 60 &&
      applyEffects({ environment: 50, social: 10 }, { environment: 10, alignment: 5 }).alignment === 5,
  });
  tests.push({
    name: "formatPolicy maps known keys",
    pass: formatPolicy("guardian-panel") === "Citizen Guardian Panel" && formatPolicy("x") === "None",
  });
  tests.push({
    name: "nearest-node utility resolves a node",
    pass: typeof getNearestNodeInfo([0, 0, 14]).nearestId === "string",
  });
  return tests;
}

const SELF_CHECKS = runSelfChecks();

function App() {
  const [game, setGame] = useState(initialState);
  const [playerPos, setPlayerPos] = useState([...START_PLAYER_POS]);
  const [nearestNodeId, setNearestNodeId] = useState(null);
  const [freeCamera, setFreeCamera] = useState(false);

  const selectedProfile = game.selectedCharacter ? characterProfiles[game.selectedCharacter] : null;
  const currentNode = questNodes.find((n) => n.id === game.activeNode) || null;
  const totalDamBuilt = game.damSlots.filter(Boolean).length;
  const evidenceCount = Object.values(game.evidenceFound).filter(Boolean).length;
  const avgTrust = Math.round((game.trust.otters + game.trust.deer + game.trust.badgers) / 3);

  const completion = useMemo(() => {
    const flags = [
      totalDamBuilt >= 3,
      avgTrust >= 58,
      evidenceCount >= 2,
      Boolean(game.policyChoice),
    ].filter(Boolean).length;
    return Math.round((flags / 4) * 100);
  }, [totalDamBuilt, avgTrust, evidenceCount, game.policyChoice]);

  const forestStatus = useMemo(() => {
    const { environment, social, governance, alignment } = game.metrics;
    const avg = Math.round((environment + social + governance + alignment) / 4);
    if (avg >= 80) return { label: "Thriving Canopy", desc: "Employees and leaders appear closely aligned in restoring Verdantia.", tone: "text-emerald-300" };
    if (avg >= 65) return { label: "Recovering Forest", desc: "The forest is stabilizing, but several tensions still need attention.", tone: "text-lime-300" };
    if (avg >= 50) return { label: "Fragile Balance", desc: "Some progress exists, though confidence and consistency remain uneven.", tone: "text-amber-300" };
    return { label: "Forest in Fog", desc: "Signals suggest meaningful gaps between daily experience and leadership intent.", tone: "text-rose-300" };
  }, [game.metrics]);

  useEffect(() => {
    if (game.phase !== "play" || game.activeNode) return undefined;

    function onKeyDown(e) {
      const key = e.key.toLowerCase();
      if (key === "e" && nearestNodeId) {
        setGame((prev) => ({
          ...prev,
          activeNode: nearestNodeId,
          visited: { ...prev.visited, [nearestNodeId]: true },
        }));
      }
      if (key === "c") {
        setFreeCamera((v) => !v);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.phase, game.activeNode, nearestNodeId]);

  const saveAnswer = (key, value, effects = {}) => {
    setGame((prev) => ({
      ...prev,
      answers: { ...prev.answers, [key]: value },
      metrics: applyEffects(prev.metrics, effects),
      log: [...prev.log, { type: "answer", key, value, effects }],
    }));
  };

  const saveVoice = (key, text) => {
    const value = text?.trim() ? text.trim() : "[mock transcription saved]";
    setGame((prev) => ({
      ...prev,
      voiceSaved: { ...prev.voiceSaved, [key]: value },
      log: [...prev.log, { type: "voice", key, value }],
    }));
  };

  const chooseCharacter = (id) => {
    if (!characterProfiles[id]) return;
    setGame((prev) => ({
      ...prev,
      selectedCharacter: id,
      phase: "play",
      metrics: applyEffects(prev.metrics, characterProfiles[id].bonus),
      log: [...prev.log, { type: "character", value: id }],
    }));
  };

  const placeDamPiece = (index) => {
    setGame((prev) => {
      if (prev.damSlots[index]) return prev;
      const next = [...prev.damSlots];
      next[index] = true;
      return {
        ...prev,
        damSlots: next,
        riverRisk: clamp(prev.riverRisk - 10, 0, 100),
        metrics: {
          ...prev.metrics,
          environment: clamp(prev.metrics.environment + 4, 0, 100),
          alignment: clamp(prev.metrics.alignment + 2, 0, 100),
        },
        log: [...prev.log, { type: "dam", value: index }],
      };
    });
  };

  const allocateResource = (group, amount) => {
    setGame((prev) => {
      if (!(group in prev.trust) || prev.socialResources < amount) return prev;
      const trustBoost = amount === 3 ? 9 : 5;
      return {
        ...prev,
        socialResources: prev.socialResources - amount,
        trust: {
          ...prev.trust,
          [group]: clamp(prev.trust[group] + trustBoost, 0, 100),
        },
        metrics: {
          ...prev.metrics,
          social: clamp(prev.metrics.social + 4, 0, 100),
          alignment: clamp(prev.metrics.alignment + 1, 0, 100),
        },
        log: [...prev.log, { type: "negotiate", group, amount }],
      };
    });
  };

  const findEvidence = (key, effects) => {
    setGame((prev) => {
      if (!(key in prev.evidenceFound) || prev.evidenceFound[key]) return prev;
      return {
        ...prev,
        evidenceFound: { ...prev.evidenceFound, [key]: true },
        metrics: applyEffects(prev.metrics, effects),
        log: [...prev.log, { type: "evidence", value: key }],
      };
    });
  };

  const choosePolicy = (choice, effects) => {
    setGame((prev) => ({
      ...prev,
      policyChoice: choice,
      metrics: applyEffects(prev.metrics, effects),
      log: [...prev.log, { type: "policy", value: choice }],
    }));
  };

  const updateMetrics = (effects = {}) => {
    setGame((prev) => ({ ...prev, metrics: applyEffects(prev.metrics, effects) }));
  };

  const resetGame = () => {
    setGame(initialState);
    setPlayerPos([...START_PLAYER_POS]);
    setNearestNodeId(null);
    setFreeCamera(false);
  };

  const canFinish = totalDamBuilt >= 3 && avgTrust >= 58 && evidenceCount >= 2 && Boolean(game.policyChoice);

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
                  playerPos={playerPos}
                  setPlayerPos={setPlayerPos}
                  nearestNodeId={nearestNodeId}
                  setNearestNodeId={setNearestNodeId}
                  openNode={(id) =>
                    setGame((prev) => ({
                      ...prev,
                      activeNode: id,
                      visited: { ...prev.visited, [id]: true },
                    }))
                  }
                  freeCamera={freeCamera}
                  character={game.selectedCharacter}
                />
              </Suspense>
            </Canvas>
          </div>
        )}

        <div className="relative z-10 h-full w-full p-5 lg:p-6 pointer-events-none">
          <HeaderBar selectedProfile={selectedProfile} completion={completion} phase={game.phase} />

          <AnimatePresence mode="wait">
            {game.phase === "intro" && (
              <motion.div key="intro" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="pointer-events-auto mx-auto mt-8 max-w-6xl">
                <IntroScreen game={game} setGame={setGame} />
              </motion.div>
            )}

            {game.phase === "character" && (
              <motion.div key="character" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="pointer-events-auto mx-auto mt-8 max-w-6xl">
                <CharacterSelect playerName={game.playerName} chooseCharacter={chooseCharacter} />
              </motion.div>
            )}

            {game.phase === "play" && (
              <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-20 flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <TopLeftHud selectedProfile={selectedProfile} nearestNodeId={nearestNodeId} freeCamera={freeCamera} />
                  <div className="ml-auto">
                    <TopRightHud metrics={game.metrics} completion={completion} />
                  </div>
                </div>
                <div className="flex-1 flex items-end justify-center pb-6">
                  <AnimatePresence>
                    {nearestNodeId && <InteractPrompt nearestNodeId={nearestNodeId} />}
                  </AnimatePresence>
                </div>
                <div className="flex items-end gap-3">
                  <BottomLeftHud game={game} totalDamBuilt={totalDamBuilt} avgTrust={avgTrust} evidenceCount={evidenceCount} canFinish={canFinish} onSummary={() => setGame((prev) => ({ ...prev, phase: "summary" }))} />
                  <div className="ml-auto">
                    <ControlStrip nearestNodeId={nearestNodeId} />
                  </div>
                </div>
              </motion.div>
            )}

            {game.phase === "summary" && (
              <motion.div key="summary" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="pointer-events-auto mx-auto mt-4 max-w-6xl">
                <SummaryScreen game={game} selectedProfile={selectedProfile} forestStatus={forestStatus} totalDamBuilt={totalDamBuilt} avgTrust={avgTrust} evidenceCount={evidenceCount} restart={resetGame} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {game.phase === "play" && game.activeNode && currentNode && (
            <NodeModal
              node={currentNode}
              game={game}
              setGame={setGame}
              closeModal={() => setGame((prev) => ({ ...prev, activeNode: null, voiceDraft: "" }))}
              saveAnswer={saveAnswer}
              saveVoice={saveVoice}
              placeDamPiece={placeDamPiece}
              allocateResource={allocateResource}
              findEvidence={findEvidence}
              choosePolicy={choosePolicy}
              updateMetrics={updateMetrics}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HeaderBar({ selectedProfile, completion, phase }) {
  if (phase === "play") return null;
  return (
    <div className="pointer-events-none flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200/80 backdrop-blur-xl">
          <SparklesIcon className="h-3.5 w-3.5" />
          Guardians of Verdantia · 3D Prototype
        </div>
        <h1 className="text-3xl font-semibold tracking-tight lg:text-5xl">A real forest you can walk through</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70 lg:text-base">Walk through Verdantia, repair the river, negotiate with groups, and investigate the council.</p>
      </div>

      <Card className="pointer-events-auto border-white/10 bg-black/35 text-white backdrop-blur-xl lg:w-[360px]">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between text-sm text-white/65">
            <span>Quest progression</span>
            <span>{phase === "summary" ? 100 : completion}%</span>
          </div>
          <Progress value={phase === "summary" ? 100 : completion} className="h-2 bg-white/10" />
          <div className="mt-4 flex items-center justify-between text-xs text-white/60">
            <span>{selectedProfile ? selectedProfile.title : "Choose a guardian"}</span>
            <span>{phase === "summary" ? "Restoration summary" : "Setup"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IntroScreen({ game, setGame }) {
  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <div className="text-center max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-300/90">
          <SparklesIcon className="h-3 w-3" />
          Guardians of Verdantia
        </div>
        <h2 className="text-4xl font-semibold tracking-tight lg:text-6xl leading-tight">The forest needs<br />a guardian.</h2>
        <p className="mt-4 text-base leading-7 text-white/65 max-w-xl mx-auto">Walk through a living 3D world. Repair the river, negotiate with animal groups, uncover council secrets, and shape Verdantia's future.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 w-full max-w-2xl">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-center">
          <Droplets className="h-6 w-6 text-cyan-300 mx-auto mb-2" />
          <div className="font-medium text-white text-sm">Environment</div>
          <div className="mt-1 text-xs text-white/55">Repair the river and build dam supports</div>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-center">
          <Users className="h-6 w-6 text-amber-300 mx-auto mb-2" />
          <div className="font-medium text-white text-sm">Social</div>
          <div className="mt-1 text-xs text-white/55">Balance fairness between animal groups</div>
        </div>
        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4 text-center">
          <ShieldCheck className="h-6 w-6 text-violet-300 mx-auto mb-2" />
          <div className="font-medium text-white text-sm">Governance</div>
          <div className="mt-1 text-xs text-white/55">Investigate the Hollow Council</div>
        </div>
      </div>

      <div className="w-full max-w-md">
        <Card className="border-white/10 bg-black/40 text-white backdrop-blur-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400/60 via-cyan-400/40 to-violet-400/60" />
          <CardContent className="p-6">
            <label className="mb-2 block text-sm font-medium text-white/80">Name your guardian</label>
            <Input
              value={game.playerName}
              onChange={(e) => setGame((prev) => ({ ...prev, playerName: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && setGame((prev) => ({ ...prev, phase: "character" }))}
              placeholder="e.g. Irene of Mossglade"
              className="border-white/10 bg-white/8 text-white placeholder:text-white/30"
            />
            <Button
              onClick={() => setGame((prev) => ({ ...prev, phase: "character" }))}
              className="mt-4 w-full rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-medium py-2.5 h-auto"
            >
              Enter the forest
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="mt-3 text-center text-xs text-white/35">WASD to move · E to interact · Shift to run</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CharacterSelect({ playerName, chooseCharacter }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <div className="text-center max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-violet-300/90">
          Choose your guardian
        </div>
        <h2 className="text-3xl font-semibold lg:text-5xl tracking-tight">
          {playerName ? `${playerName}, who` : "Who"} will you become?
        </h2>
        <p className="mt-3 text-white/60 max-w-lg mx-auto">Your guardian shapes which paths open, how the forest speaks to you, and which skills come naturally.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 w-full max-w-4xl">
        {Object.entries(characterProfiles).map(([id, profile]) => {
          const Icon = profile.icon;
          const isHovered = hovered === id;
          return (
            <motion.div
              key={id}
              whileHover={{ y: -6, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              onHoverStart={() => setHovered(id)}
              onHoverEnd={() => setHovered(null)}
            >
              <Card className={cx(
                "h-full overflow-hidden text-white backdrop-blur-xl transition-all duration-300",
                "border bg-black/40",
                isHovered ? accentBorder(profile.accent) : "border-white/10",
                isHovered ? accentGlow(profile.accent) : ""
              )}>
                <div className={cx("h-1.5 bg-gradient-to-r", colorBand(profile.accent))} />
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <Icon className="h-6 w-6 text-emerald-200" />
                  </div>
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                  <CardDescription className="text-white/55 text-xs font-medium uppercase tracking-wide mt-0.5">{profile.title}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="mb-4 text-sm leading-6 text-white/70">{profile.description}</p>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {Object.entries(profile.bonus).map(([stat, val]) => (
                      <span key={stat} className={cx("rounded-full px-2.5 py-1 text-xs font-medium border bg-white/5 text-white/80", accentBorder(profile.accent))}>
                        +{val} {stat}
                      </span>
                    ))}
                  </div>
                  <Button
                    onClick={() => chooseCharacter(id)}
                    className={cx("w-full rounded-xl font-medium py-2.5 h-auto", accentBtn(profile.accent))}
                  >
                    Play as {profile.name.split(" ")[0]}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function TopLeftHud({ selectedProfile, nearestNodeId, freeCamera }) {
  const nearest = questNodes.find((n) => n.id === nearestNodeId);
  const accentDot = selectedProfile ? {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    violet: "bg-violet-400",
  }[selectedProfile.accent] || "bg-white/40" : "bg-white/20";
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] px-3 py-2 text-xs flex items-center gap-2.5 max-w-[280px]">
      <div className={cx("h-2 w-2 rounded-full shrink-0", accentDot)} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-white/90 truncate">{selectedProfile?.name || "no guardian"}</span>
        <span className="text-white/45">{nearest ? nearest.label : "explore the glade"} · {freeCamera ? "free cam" : "follow"}</span>
      </div>
    </div>
  );
}

function TopRightHud({ metrics, completion }) {
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] px-3 py-2.5 space-y-1.5 w-[200px]">
      <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-2">Alignment · {completion}%</div>
      <MetricBar label="Environment" value={metrics.environment} tone="emerald" />
      <MetricBar label="Social" value={metrics.social} tone="amber" />
      <MetricBar label="Governance" value={metrics.governance} tone="violet" />
      <MetricBar label="Alignment" value={metrics.alignment} tone="sky" />
    </div>
  );
}

function BottomLeftHud({ game, totalDamBuilt, avgTrust, evidenceCount, canFinish, onSummary }) {
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] px-3 py-2.5 max-w-[280px]">
      <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wide mb-2">Quests</div>
      <div className="space-y-1.5 text-xs text-white/70">
        <QuestItem label="Dam supports" done={totalDamBuilt >= 3} detail={`${totalDamBuilt}/5`} />
        <QuestItem label="Meadow harmony" done={avgTrust >= 58} detail={`${avgTrust}/58`} />
        <QuestItem label="Council clues" done={evidenceCount >= 2} detail={`${evidenceCount}/3`} />
        <QuestItem label="Governance response" done={Boolean(game.policyChoice)} detail={game.policyChoice ? formatPolicy(game.policyChoice) : "none"} />
      </div>
      <Button disabled={!canFinish} onClick={onSummary} className="mt-2.5 w-full rounded-xl bg-white text-slate-950 text-xs py-1.5 h-auto hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40">Reveal summary</Button>
    </div>
  );
}

function ControlStrip({ nearestNodeId }) {
  const nearest = questNodes.find((n) => n.id === nearestNodeId);
  return (
    <div className="pointer-events-none flex items-end justify-end">
      <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.32)]">
        {nearest
          ? <span>press <span className="font-semibold text-white">E</span> to enter · <span className="font-semibold text-white">C</span> camera · <span className="font-semibold text-white">Shift</span> run</span>
          : <span><span className="font-semibold text-white">WASD</span> move · <span className="font-semibold text-white">C</span> camera · <span className="font-semibold text-white">Shift</span> run</span>}
      </div>
    </div>
  );
}

function InteractPrompt({ nearestNodeId }) {
  const nearest = questNodes.find((n) => n.id === nearestNodeId);
  if (!nearest) return null;
  const Icon = nearest.icon;
  return (
    <motion.div
      key={nearestNodeId}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/15 bg-black/55 px-4 py-2.5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <Icon className="h-4 w-4 text-white/60" />
        <span className="text-sm font-medium text-white">{nearest.label}</span>
        <span className="rounded-lg bg-white/15 px-2 py-0.5 text-xs font-bold text-white tracking-wide">E</span>
      </div>
    </motion.div>
  );
}

function ForestWorld({ playerPos, setPlayerPos, nearestNodeId, setNearestNodeId, openNode, freeCamera, character }) {
  const keysRef = useRef({});
  const playerPosRef = useRef(playerPos);
  const nearestNodeRef = useRef(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);

  useEffect(() => {
    nearestNodeRef.current = nearestNodeId;
  }, [nearestNodeId]);

  useEffect(() => {
    function down(e) {
      keysRef.current[e.key.toLowerCase()] = true;
    }
    function up(e) {
      keysRef.current[e.key.toLowerCase()] = false;
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    const current = playerPosRef.current;
    const move = new THREE.Vector3();

    if (keys.w || keys.arrowup) move.z -= 1;
    if (keys.s || keys.arrowdown) move.z += 1;
    if (keys.a || keys.arrowleft) move.x -= 1;
    if (keys.d || keys.arrowright) move.x += 1;

    let nextX = current[0];
    let nextY = current[1];
    let nextZ = current[2];

    if (move.lengthSq() > 0) {
      move.normalize();
      const speed = PLAYER_SPEED * (keys.shift ? RUN_MULTIPLIER : 1);
      nextX = clamp(current[0] + move.x * speed * delta, -WORLD_RADIUS, WORLD_RADIUS);
      nextZ = clamp(current[2] + move.z * speed * delta, -WORLD_RADIUS, WORLD_RADIUS);
      const changed = nextX !== current[0] || nextZ !== current[2];
      if (changed) {
        const nextPosition = [nextX, nextY, nextZ];
        playerPosRef.current = nextPosition;
        setPlayerPos(nextPosition);
      }
    }

    const nearestInfo = getNearestNodeInfo([nextX, nextY, nextZ]);
    const nextNearest = nearestInfo.nearestDist <= INTERACT_DISTANCE ? nearestInfo.nearestId : null;
    if (nearestNodeRef.current !== nextNearest) {
      nearestNodeRef.current = nextNearest;
      setNearestNodeId(nextNearest);
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
      <QuestMarkers nearestNodeId={nearestNodeId} onOpen={openNode} />
      <PlayerAvatar position={playerPos} character={character} />
    </>
  );
}

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
      {[...Array(8)].map((_, i) => (
        <mesh key={i} position={[-4 + i * 1.2, 0.01, Math.sin(i) * 1.1]}>
          <boxGeometry args={[0.55, 0.1, 0.25]} />
          <meshStandardMaterial color="#7a5838" />
        </mesh>
      ))}
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
    for (let i = 0; i < 64; i += 1) {
      const angle = (i / 64) * Math.PI * 2;
      const radius = 12 + (i % 8) * 1.6 + ((i * 17) % 10) * 0.35;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
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
  const points = [
    [-8, 0.2, 1],
    [-1, 0.2, -2],
    [6, 0.2, 1],
    [12, 0.2, -2],
  ];
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

function QuestMarkers({ nearestNodeId, onOpen }) {
  return (
    <group>
      {questNodes.map((node) => (
        <QuestMarker key={node.id} node={node} highlighted={nearestNodeId === node.id} onOpen={() => onOpen(node.id)} />
      ))}
    </group>
  );
}

function QuestMarker({ node, highlighted, onOpen }) {
  return (
    <group position={node.pos}>
      <Float speed={1.45} rotationIntensity={0.22} floatIntensity={0.55}>
        <mesh castShadow onClick={onOpen}>
          <sphereGeometry args={[highlighted ? 0.82 : 0.68, 20, 20]} />
          <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={highlighted ? 2.1 : 1.1} roughness={0.2} metalness={0.05} />
        </mesh>
      </Float>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.15, 1.5, 32]} />
        <meshBasicMaterial color={node.color} transparent opacity={highlighted ? 0.55 : 0.28} />
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
      <Text position={[0, 0, 0.08]} fontSize={0.18} color="#e5f6ee" anchorX="center" anchorY="middle" maxWidth={width - 0.3}>
        {label}
      </Text>
    </group>
  );
}

function BeaverModel() {
  return (
    <group>
      {/* chunky body */}
      <mesh castShadow position={[0, 0.92, 0]}>
        <cylinderGeometry args={[0.52, 0.62, 1.4, 14]} />
        <meshStandardMaterial color="#7a5230" roughness={0.85} />
      </mesh>
      {/* belly patch */}
      <mesh position={[0, 0.92, 0.52]}>
        <cylinderGeometry args={[0.28, 0.34, 1.3, 10]} />
        <meshStandardMaterial color="#c9986a" roughness={0.9} />
      </mesh>
      {/* round head */}
      <mesh castShadow position={[0, 1.98, 0]}>
        <sphereGeometry args={[0.46, 18, 18]} />
        <meshStandardMaterial color="#7a5230" roughness={0.85} />
      </mesh>
      {/* wide muzzle */}
      <mesh castShadow position={[0, 1.86, 0.38]}>
        <boxGeometry args={[0.38, 0.22, 0.22]} />
        <meshStandardMaterial color="#c9986a" roughness={0.9} />
      </mesh>
      {/* big front teeth */}
      <mesh position={[0.09, 1.77, 0.54]}>
        <boxGeometry args={[0.11, 0.17, 0.07]} />
        <meshStandardMaterial color="#fffff0" roughness={0.3} />
      </mesh>
      <mesh position={[-0.09, 1.77, 0.54]}>
        <boxGeometry args={[0.11, 0.17, 0.07]} />
        <meshStandardMaterial color="#fffff0" roughness={0.3} />
      </mesh>
      {/* nose */}
      <mesh position={[0, 1.94, 0.53]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#1a0d00" />
      </mesh>
      {/* small round ears */}
      <mesh castShadow position={[0.33, 2.36, -0.06]}>
        <sphereGeometry args={[0.13, 10, 10]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[-0.33, 2.36, -0.06]}>
        <sphereGeometry args={[0.13, 10, 10]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.85} />
      </mesh>
      {/* flat wide paddle tail */}
      <mesh castShadow position={[0, 0.28, -0.7]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.72, 0.13, 1.05]} />
        <meshStandardMaterial color="#4a2e10" roughness={0.95} />
      </mesh>
      {/* tail scale lines */}
      {[-0.28, 0, 0.28].map((z, i) => (
        <mesh key={i} position={[0, 0.36, z - 0.45]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.74, 0.02, 0.04]} />
          <meshStandardMaterial color="#3a2008" />
        </mesh>
      ))}
      {/* small arms */}
      <mesh castShadow position={[0.6, 1.1, 0.18]} rotation={[0.4, 0, 0.5]}>
        <cylinderGeometry args={[0.1, 0.12, 0.5, 8]} />
        <meshStandardMaterial color="#7a5230" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[-0.6, 1.1, 0.18]} rotation={[0.4, 0, -0.5]}>
        <cylinderGeometry args={[0.1, 0.12, 0.5, 8]} />
        <meshStandardMaterial color="#7a5230" roughness={0.85} />
      </mesh>
    </group>
  );
}

function FoxModel() {
  return (
    <group>
      {/* slender body */}
      <mesh castShadow position={[0, 0.96, 0]}>
        <cylinderGeometry args={[0.38, 0.44, 1.45, 12]} />
        <meshStandardMaterial color="#c8621a" roughness={0.8} />
      </mesh>
      {/* chest/belly white patch */}
      <mesh position={[0, 0.96, 0.35]}>
        <cylinderGeometry args={[0.18, 0.22, 1.3, 10]} />
        <meshStandardMaterial color="#f5e8d0" roughness={0.85} />
      </mesh>
      {/* head */}
      <mesh castShadow position={[0, 2.02, 0]}>
        <sphereGeometry args={[0.4, 18, 18]} />
        <meshStandardMaterial color="#c8621a" roughness={0.8} />
      </mesh>
      {/* pointed muzzle */}
      <mesh castShadow position={[0, 1.88, 0.42]}>
        <coneGeometry args={[0.18, 0.46, 10]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#e8d8bc" roughness={0.85} />
      </mesh>
      {/* muzzle cone rotated forward */}
      <mesh castShadow position={[0, 1.88, 0.48]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.17, 0.42, 10]} />
        <meshStandardMaterial color="#e8d8bc" roughness={0.85} />
      </mesh>
      {/* nose */}
      <mesh position={[0, 1.9, 0.72]}>
        <sphereGeometry args={[0.065, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* large pointed ears */}
      <mesh castShadow position={[0.3, 2.46, -0.08]} rotation={[0.15, 0.25, 0.15]}>
        <coneGeometry args={[0.16, 0.44, 8]} />
        <meshStandardMaterial color="#c8621a" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[-0.3, 2.46, -0.08]} rotation={[0.15, -0.25, -0.15]}>
        <coneGeometry args={[0.16, 0.44, 8]} />
        <meshStandardMaterial color="#c8621a" roughness={0.8} />
      </mesh>
      {/* inner ear */}
      <mesh position={[0.3, 2.52, -0.04]} rotation={[0.15, 0.25, 0.15]}>
        <coneGeometry args={[0.08, 0.28, 8]} />
        <meshStandardMaterial color="#e07060" roughness={0.9} />
      </mesh>
      <mesh position={[-0.3, 2.52, -0.04]} rotation={[0.15, -0.25, -0.15]}>
        <coneGeometry args={[0.08, 0.28, 8]} />
        <meshStandardMaterial color="#e07060" roughness={0.9} />
      </mesh>
      {/* bushy tail curving upward */}
      <mesh castShadow position={[0.1, 0.65, -0.7]} rotation={[-0.7, 0.2, 0]}>
        <cylinderGeometry args={[0.26, 0.12, 1.0, 10]} />
        <meshStandardMaterial color="#c8621a" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.15, 1.18, -1.0]} rotation={[-0.2, 0.2, 0]}>
        <sphereGeometry args={[0.28, 10, 10]} />
        <meshStandardMaterial color="#f5f0e8" roughness={0.9} />
      </mesh>
      {/* legs */}
      <mesh castShadow position={[0.22, 0.22, 0.12]}>
        <cylinderGeometry args={[0.1, 0.1, 0.45, 8]} />
        <meshStandardMaterial color="#a84e14" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[-0.22, 0.22, 0.12]}>
        <cylinderGeometry args={[0.1, 0.1, 0.45, 8]} />
        <meshStandardMaterial color="#a84e14" roughness={0.85} />
      </mesh>
    </group>
  );
}

function OwlModel() {
  return (
    <group>
      {/* wide round body */}
      <mesh castShadow position={[0, 0.92, 0]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial color="#6b5fa0" roughness={0.85} />
      </mesh>
      {/* breast/belly streaks */}
      <mesh position={[0, 0.85, 0.5]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color="#d4c8f0" roughness={0.85} />
      </mesh>
      {/* very round large head */}
      <mesh castShadow position={[0, 1.98, 0]}>
        <sphereGeometry args={[0.52, 20, 20]} />
        <meshStandardMaterial color="#6b5fa0" roughness={0.85} />
      </mesh>
      {/* facial disc */}
      <mesh position={[0, 1.92, 0.42]}>
        <sphereGeometry args={[0.35, 14, 14]} />
        <meshStandardMaterial color="#bbaee8" roughness={0.9} />
      </mesh>
      {/* large left eye */}
      <mesh position={[0.18, 2.04, 0.56]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#f5c842" emissive="#f5c842" emissiveIntensity={0.4} />
      </mesh>
      {/* large right eye */}
      <mesh position={[-0.18, 2.04, 0.56]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#f5c842" emissive="#f5c842" emissiveIntensity={0.4} />
      </mesh>
      {/* pupils */}
      <mesh position={[0.18, 2.04, 0.67]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[-0.18, 2.04, 0.67]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      {/* hooked beak */}
      <mesh position={[0, 1.88, 0.68]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.07, 0.22, 8]} />
        <meshStandardMaterial color="#d4a840" roughness={0.5} />
      </mesh>
      {/* ear tufts */}
      <mesh castShadow position={[0.32, 2.52, -0.08]} rotation={[0.1, 0.2, 0.22]}>
        <coneGeometry args={[0.1, 0.35, 7]} />
        <meshStandardMaterial color="#4a3870" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[-0.32, 2.52, -0.08]} rotation={[0.1, -0.2, -0.22]}>
        <coneGeometry args={[0.1, 0.35, 7]} />
        <meshStandardMaterial color="#4a3870" roughness={0.85} />
      </mesh>
      {/* wing hints */}
      <mesh castShadow position={[0.6, 0.9, -0.1]} rotation={[0.2, 0, 0.55]}>
        <boxGeometry args={[0.5, 0.9, 0.12]} />
        <meshStandardMaterial color="#524480" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[-0.6, 0.9, -0.1]} rotation={[0.2, 0, -0.55]}>
        <boxGeometry args={[0.5, 0.9, 0.12]} />
        <meshStandardMaterial color="#524480" roughness={0.9} />
      </mesh>
      {/* talons */}
      <mesh castShadow position={[0.22, 0.2, 0.1]}>
        <cylinderGeometry args={[0.1, 0.08, 0.38, 8]} />
        <meshStandardMaterial color="#4a3870" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[-0.22, 0.2, 0.1]}>
        <cylinderGeometry args={[0.1, 0.08, 0.38, 8]} />
        <meshStandardMaterial color="#4a3870" roughness={0.85} />
      </mesh>
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

function NodeModal({ node, game, closeModal, saveAnswer, saveVoice, placeDamPiece, allocateResource, findEvidence, choosePolicy, updateMetrics }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,11,0.98),rgba(12,14,22,0.98))] p-6 text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Badge className={cx("mb-3 hover:bg-white/10", badgeTone(node.chapter))}>{node.chapter}</Badge>
            <h3 className="text-2xl font-semibold lg:text-3xl">{node.label}</h3>
            <p className="mt-2 max-w-2xl text-white/70">{node.description}</p>
          </div>
          <Button variant="outline" onClick={closeModal} className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10">close</Button>
        </div>

        {node.id === "river" && <RiverQuest game={game} saveAnswer={saveAnswer} placeDamPiece={placeDamPiece} saveVoice={saveVoice} />}
        {node.id === "otter" && <OtterEncounter saveAnswer={saveAnswer} updateMetrics={updateMetrics} game={game} saveVoice={saveVoice} />}
        {node.id === "meadow" && <MeadowQuest game={game} saveAnswer={saveAnswer} allocateResource={allocateResource} saveVoice={saveVoice} />}
        {node.id === "deer" && <DeerEncounter saveAnswer={saveAnswer} updateMetrics={updateMetrics} game={game} saveVoice={saveVoice} />}
        {node.id === "council" && <CouncilQuest game={game} saveAnswer={saveAnswer} findEvidence={findEvidence} choosePolicy={choosePolicy} saveVoice={saveVoice} />}
        {node.id === "archive" && <ArchiveEncounter saveAnswer={saveAnswer} updateMetrics={updateMetrics} game={game} saveVoice={saveVoice} />}
      </motion.div>
    </motion.div>
  );
}

function RiverQuest({ game, saveAnswer, placeDamPiece, saveVoice }) {
  const built = game.damSlots.filter(Boolean).length;
  const NPC = { name: "Ripple · Otter Engineer", icon: Droplets, color: "#6ee7ff" };
  return (
    <div className="space-y-6">
      {/* NPC opening */}
      <NpcSpeech name={NPC.name} icon={NPC.icon} color={NPC.color}>
        Three seasons of flooding and the council keeps calling it "within normal range." We built these supports ourselves — nobody asked us to. The question I keep hearing from the workers downstream is: <em>does any of this actually show?</em>
      </NpcSpeech>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Dam mini-game */}
        <div className="space-y-3">
          <div className="rounded-3xl border border-cyan-300/10 bg-gradient-to-b from-cyan-300/10 to-emerald-400/5 p-5">
            <div className="mb-3 flex items-center justify-between text-sm text-white/70">
              <span className="flex items-center gap-2"><Hammer className="h-4 w-4 text-cyan-300" /> Click empty slots to place dam supports</span>
              <span className="text-cyan-200 font-medium">overflow risk {game.riverRisk}%</span>
            </div>
            <div className="relative h-40 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-400/70 to-sky-300/45 transition-all duration-500" style={{ height: `${Math.max(game.riverRisk, 12)}%` }} />
              <div className="absolute inset-x-0 bottom-4 flex items-end justify-center gap-3 px-4">
                {game.damSlots.map((filled, i) => (
                  <button key={i} type="button" onClick={() => placeDamPiece(i)} className={cx(
                    "h-20 w-12 rounded-t-xl border transition-all",
                    filled ? "border-emerald-300 bg-amber-700/90 shadow-[0_0_20px_rgba(110,231,183,0.25)]" : "border-dashed border-white/20 bg-white/5 hover:border-cyan-300/60 hover:bg-white/10"
                  )} />
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniOutcome title="supports placed" value={`${built}/5`} />
              <MiniOutcome title="repair signal" value={game.selectedCharacter === "beaver" ? "very strong" : "visible"} />
              <MiniOutcome title="downstream trust" value={built >= 3 ? "growing" : "uncertain"} />
            </div>
          </div>
        </div>

        {/* Dialogue questions */}
        <div className="space-y-5">
          <DialogueQuestion
            npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
            question="We have wood left for one more push. Where should it go?"
            current={game.answers.env_priority}
            onSelect={saveAnswer}
            options={[
              ["env_priority", "Fix the immediate risks — where people already feel the pain", { environment: 3, alignment: 2 }],
              ["env_priority", "Invest in prevention, even if the impact isn't visible yet", { environment: 4, governance: 1 }],
              ["env_priority", "Follow the council's priorities — they have the full picture", { governance: 2, alignment: -1 }],
            ]}
          />
          <DialogueQuestion
            npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
            question="The engineers want to publish the flood data openly. What do you think?"
            current={game.answers.env_transparency}
            onSelect={saveAnswer}
            options={[
              ["env_transparency", "Share it openly — all groups deserve to see the numbers", { governance: 3, alignment: 3 }],
              ["env_transparency", "Share it with area managers first, then decide", { governance: 1 }],
              ["env_transparency", "Wait until the numbers look better before publishing", { governance: -2, alignment: -3 }],
            ]}
          />
        </div>
      </div>

      {/* Smart interview */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium flex items-center gap-2">
          <Mic className="h-3 w-3" /> One more question before you go
        </div>
        <SmartInterview
          npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
          opener="When something important breaks in your part of the forest — a real problem, not a small one — what usually happens next?"
          signalKey="env_voice" saved={game.voiceSaved.env_voice}
          onSave={saveVoice} saveAnswer={saveAnswer} effects={{ environment: 2, alignment: 1 }}
        />
      </div>
    </div>
  );
}

function OtterEncounter({ game, saveAnswer, updateMetrics, saveVoice }) {
  const NPC = { name: "Pip · Apprentice Engineer", icon: Leaf, color: "#7bf1b5" };
  const [acted, setAct] = useState(null);
  const doAction = (label, effects) => { if (acted) return; updateMetrics(effects); setAct(label); };
  return (
    <div className="space-y-5">
      <NpcSpeech name={NPC.name} icon={NPC.icon} color={NPC.color}>
        I'm still learning, but something doesn't add up. Leadership keeps publishing river reports — but they never show the parts that actually worry us. I've started wondering if that's on purpose.
      </NpcSpeech>

      <DialogueQuestion
        npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
        question="What actually convinces you that leadership cares about a problem? Not says they care — actually cares?"
        current={game.answers.env_visible_action}
        onSelect={saveAnswer}
        options={[
          ["env_visible_action", "Visible changes in how things actually work day-to-day", { environment: 4, alignment: 3 }],
          ["env_visible_action", "Inspiring speeches and public commitments from leaders", { governance: 1, alignment: -1 }],
          ["env_visible_action", "A detailed strategy scroll — even if daily work hasn't changed yet", { alignment: -3 }],
        ]}
      />

      <DialogueQuestion
        npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
        question="Who should have the most influence over what gets fixed first?"
        current={game.answers.env_voice_weight}
        onSelect={saveAnswer}
        options={[
          ["env_voice_weight", "The workers closest to the problem — they feel it most directly", { social: 2, alignment: 3 }],
          ["env_voice_weight", "Leadership — they need consistency across the whole forest", { governance: 2, alignment: -1 }],
          ["env_voice_weight", "External groups — outside pressure tends to drive real action", { environment: 1, governance: 1 }],
        ]}
      />

      {/* Consequence action */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium mb-3">Before you leave — make one call</div>
        {[
          { label: "Fund practical river repairs now", effects: { environment: 3, social: 1 }, style: "bg-white text-slate-950 hover:bg-white/90" },
          { label: "Commit to publishing a live flood dashboard", effects: { governance: 3, alignment: 1 }, style: "border-white/15 bg-white/5 text-white hover:bg-white/10" },
          { label: "Promise action next season — resources are tight now", effects: { alignment: -1, environment: 1 }, style: "border-white/15 bg-white/5 text-white/60 hover:bg-white/8" },
        ].map(({ label, effects, style }) => (
          <button key={label} type="button" onClick={() => doAction(label, effects)}
            className={cx("w-full text-left rounded-xl border px-4 py-3 text-sm transition-all", acted === label ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : acted ? "border-white/5 text-white/25 cursor-default" : cx("cursor-pointer", style))}>
            {label}
          </button>
        ))}
        {acted && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-white/35 italic pt-1">Decision made: "{acted}"</motion.div>}
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium flex items-center gap-2"><Mic className="h-3 w-3" /> One more question</div>
        <SmartInterview
          npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
          opener="Honestly — what would it take for you to genuinely believe the forest's environmental commitments are real?"
          signalKey="env_otter_voice" saved={game.voiceSaved.env_otter_voice}
          onSave={saveVoice} saveAnswer={saveAnswer} effects={{ environment: 2, alignment: 2 }}
        />
      </div>
    </div>
  );
}

function MeadowQuest({ game, saveAnswer, allocateResource, saveVoice }) {
  const avgTrust = Math.round((game.trust.otters + game.trust.deer + game.trust.badgers) / 3);
  const NPC = { name: "Fern · Meadow Mediator", icon: Users, color: "#ffca76" };
  return (
    <div className="space-y-6">
      <NpcSpeech name={NPC.name} icon={NPC.icon} color={NPC.color}>
        Every group feels like they're carrying the most and receiving the least. The Otters need river access. The Deer need quiet paths. The Badgers need someone to actually show up. I have {game.socialResources} tokens of support left — and no easy answers.
      </NpcSpeech>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Negotiation mini-game */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-white/60 px-1">
            <span className="flex items-center gap-2"><Scale className="h-4 w-4 text-amber-300" /> Distribute support tokens</span>
            <span>harmony <span className="font-semibold text-amber-200">{avgTrust}</span> · tokens left <span className="font-semibold text-white">{game.socialResources}</span></span>
          </div>
          <NegotiationCard title="Otter Guild" need="River access, safer water routes, and visible repair progress." trust={game.trust.otters} onSmall={() => allocateResource("otters", 2)} onLarge={() => allocateResource("otters", 3)} />
          <NegotiationCard title="Deer Circle" need="Quiet paths, fair meadow access, protection from overuse." trust={game.trust.deer} onSmall={() => allocateResource("deer", 2)} onLarge={() => allocateResource("deer", 3)} />
          <NegotiationCard title="Badger Union" need="Representation, workload fairness, and visible follow-through." trust={game.trust.badgers} onSmall={() => allocateResource("badgers", 2)} onLarge={() => allocateResource("badgers", 3)} />
        </div>

        {/* Dialogue questions */}
        <div className="space-y-5">
          <DialogueQuestion
            npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
            question="The Badgers keep asking why they hear about decisions only after they've already been made. What's the right response?"
            current={game.answers.social_fairness}
            onSelect={saveAnswer}
            options={[
              ["social_fairness", "Give every group a voice before decisions are finalized", { social: 4, governance: 2 }],
              ["social_fairness", "Make sure distribution is equal, then communicate after", { social: 3 }],
              ["social_fairness", "Trust leaders to decide quickly — consultation slows things down", { governance: 1, alignment: -2 }],
            ]}
          />
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="text-sm text-white/70 leading-relaxed">
              <span className="text-amber-200/80 font-medium">Fern asks:</span> How safe does it feel to say something honest here, even if it's uncomfortable?
            </div>
            <SliderPrompt label="" hint="" value={game.answers.social_safety ?? 50} onCommit={(val) => saveAnswer("social_safety", val, val >= 70 ? { social: 4 } : { social: -1, alignment: -2 })} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium flex items-center gap-2"><Mic className="h-3 w-3" /> One more question</div>
        <SmartInterview
          npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
          opener="Tell me about a time when you felt like your perspective actually changed something at work — or a time when you expected it to, and it didn't."
          signalKey="social_voice" saved={game.voiceSaved.social_voice}
          onSave={saveVoice} saveAnswer={saveAnswer} effects={{ social: 2, alignment: 2 }}
        />
      </div>
    </div>
  );
}

function DeerEncounter({ game, saveAnswer, updateMetrics, saveVoice }) {
  const NPC = { name: "Elder Moss · Deer Circle", icon: Trees, color: "#c8f27e" };
  const [acted, setAct] = useState(null);
  const doAction = (label, effects) => { if (acted) return; updateMetrics(effects); setAct(label); };
  return (
    <div className="space-y-5">
      <NpcSpeech name={NPC.name} icon={NPC.icon} color={NPC.color}>
        We don't ask for much. Just to be included before decisions are made — not after. The quiet strain of carrying more than our share is real, even if it doesn't show up in any report.
      </NpcSpeech>

      <DialogueQuestion
        npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
        question="When one group is clearly carrying more than the others — what's the right response?"
        current={game.answers.social_workload}
        onSelect={saveAnswer}
        options={[
          ["social_workload", "Redistribute support and track it visibly so everyone can see", { social: 4, governance: 1 }],
          ["social_workload", "Acknowledge it openly, but wait for the right season to act", { social: -1 }],
          ["social_workload", "Keep expectations equal regardless — context shouldn't change the standard", { social: -2, alignment: -1 }],
        ]}
      />

      <DialogueQuestion
        npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
        question="What actually makes inclusion feel real — not just official?"
        current={game.answers.social_credibility}
        onSelect={saveAnswer}
        options={[
          ["social_credibility", "Structural changes you can actually feel in your daily work", { social: 4, alignment: 3 }],
          ["social_credibility", "A clear values statement from leaders that sets the tone", { governance: 1 }],
          ["social_credibility", "Regular celebrations and visible recognition of the community", { social: 1 }],
        ]}
      />

      <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium mb-3">Make a decision for the Circle</div>
        {[
          { label: "Create mixed-group working circles across the meadow", effects: { social: 3, alignment: 2 } },
          { label: "Issue a top-down fairness charter from the council", effects: { governance: 2, social: -1 } },
          { label: "Defer action — wait for the next council review cycle", effects: { alignment: -2 } },
        ].map(({ label, effects }) => (
          <button key={label} type="button" onClick={() => doAction(label, effects)}
            className={cx("w-full text-left rounded-xl border px-4 py-3 text-sm transition-all",
              acted === label ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" :
              acted ? "border-white/5 text-white/25 cursor-default" :
              "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white cursor-pointer")}>
            {label}
          </button>
        ))}
        {acted && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-white/35 italic pt-1">Decision made: "{acted}"</motion.div>}
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium flex items-center gap-2"><Mic className="h-3 w-3" /> One more question</div>
        <SmartInterview
          npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
          opener="What's one thing your leaders could do differently that would make the most real difference for your team?"
          signalKey="social_deer_voice" saved={game.voiceSaved.social_deer_voice}
          onSave={saveVoice} saveAnswer={saveAnswer} effects={{ social: 2, alignment: 1 }}
        />
      </div>
    </div>
  );
}

function CouncilQuest({ game, saveAnswer, findEvidence, choosePolicy, saveVoice }) {
  const evidenceCount = Object.values(game.evidenceFound).filter(Boolean).length;
  const NPC = { name: "The Archivist · Hollow Council", icon: ShieldCheck, color: "#b89cff" };
  return (
    <div className="space-y-6">
      <NpcSpeech name={NPC.name} icon={NPC.icon} color={NPC.color}>
        Come in quietly. There are things in here the council hasn’t published. I’ve been watching the gap between what they say and what they actually do. You have sharp eyes — see what you can find.
      </NpcSpeech>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Evidence investigation */}
        <div className="space-y-4">
          <div className="text-xs text-white/40 uppercase tracking-wide font-medium flex items-center gap-2">
            <Eye className="h-3 w-3" /> Click to examine — {evidenceCount}/3 pieces found
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <EvidenceTile title="Hidden Ledger" text="Repairs promised but never properly resourced — the numbers don’t match." found={game.evidenceFound.hiddenLedger} onFind={() => findEvidence("hiddenLedger", { governance: 5, alignment: 3 })} />
            <EvidenceTile title="Missing Minutes" text="Council debates that were never shared with the rest of the forest." found={game.evidenceFound.missingMinutes} onFind={() => findEvidence("missingMinutes", { governance: 4, alignment: 2 })} />
            <EvidenceTile title="Broken Seal" text="A public decree that looks like it was quietly altered after the ceremony." found={game.evidenceFound.brokenSeal} onFind={() => findEvidence("brokenSeal", { governance: 6, social: 2 })} />
          </div>

          {/* Trust slider in context */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="text-sm text-white/70 leading-relaxed">
              <span className="text-violet-300/80 font-medium">The Archivist asks:</span> With everything you’ve seen in here — how much do you trust the council to act on what it says?
            </div>
            <SliderPrompt label="" hint="" value={game.answers.gov_trust ?? 50} onCommit={(val) => saveAnswer("gov_trust", val, val >= 70 ? { governance: 4 } : { alignment: -3 })} />
          </div>
        </div>

        {/* Dialogue questions */}
        <div className="space-y-5">
          <DialogueQuestion
            npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
            question="A young hare in the corridor asks you directly: what actually makes a leader credible?"
            current={game.answers.gov_credibility}
            onSelect={saveAnswer}
            options={[
              ["gov_credibility", "Consistent follow-through that people can actually observe", { governance: 4, alignment: 4 }],
              ["gov_credibility", "A strong long-term vision, even if day-to-day is messy", { governance: 2 }],
              ["gov_credibility", "Symbolic wins — visible moments that signal the direction", { alignment: -2 }],
            ]}
          />
          <DialogueQuestion
            npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
            question="The council is debating whether to welcome public criticism. Where do you stand?"
            current={game.answers.gov_accountability}
            onSelect={saveAnswer}
            options={[
              ["gov_accountability", "Challenge should be safe, public, and welcomed by default", { governance: 5, social: 2 }],
              ["gov_accountability", "Keep it private — protected feedback is more honest", { governance: 1 }],
              ["gov_accountability", "Only when leadership specifically asks for it", { alignment: -3 }],
            ]}
          />
        </div>
      </div>

      {/* Policy choice */}
      <div className="space-y-3">
        <div className="text-xs text-white/40 uppercase tracking-wide font-medium">Now decide: how should the council respond to what you found?</div>
        <div className="grid gap-4 lg:grid-cols-3">
          <PolicyCard active={game.policyChoice === "transparency-charter"} title="Transparency Charter" text="Publish all decisions, rationale, and progress reports to the entire forest." impact="strongest boost to trust + alignment" onClick={() => choosePolicy("transparency-charter", { governance: 8, alignment: 7 })} />
          <PolicyCard active={game.policyChoice === "guardian-panel"} title="Citizen Guardian Panel" text="Bring rotating animal representatives into council reviews and decision pathways." impact="boosts inclusion + credibility" onClick={() => choosePolicy("guardian-panel", { governance: 6, social: 5, alignment: 5 })} />
          <PolicyCard active={game.policyChoice === "elite-taskforce"} title="Elite Taskforce" text="Keep decisions within a select group of expert advisors to move faster." impact="efficient — but feels exclusive" onClick={() => choosePolicy("elite-taskforce", { governance: 2, social: -3, alignment: -4 })} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium flex items-center gap-2"><Mic className="h-3 w-3" /> One more question</div>
        <SmartInterview
          npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
          opener="Have you ever noticed a clear gap between what leadership says and what actually happens? Tell me about it — honestly."
          signalKey="gov_voice" saved={game.voiceSaved.gov_voice}
          onSave={saveVoice} saveAnswer={saveAnswer} effects={{ governance: 2, alignment: 2 }}
        />
      </div>
    </div>
  );
}

function ArchiveEncounter({ game, saveAnswer, updateMetrics, saveVoice }) {
  const NPC = { name: "Scholar Bark · Archive Tree", icon: ScrollText, color: "#8fd4ff" };
  const [acted, setAct] = useState(null);
  const doAction = (label, effects) => { if (acted) return; updateMetrics(effects); setAct(label); };
  return (
    <div className="space-y-5">
      <NpcSpeech name={NPC.name} icon={NPC.icon} color={NPC.color}>
        Every decision ever made in this forest is recorded here. But records and reality aren't always the same thing. The question I keep returning to: what does honest feedback actually do once it reaches the top?
      </NpcSpeech>

      <DialogueQuestion
        npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
        question="What actually helps leadership learn and improve the fastest?"
        current={game.answers.gov_feedback_culture}
        onSelect={saveAnswer}
        options={[
          ["gov_feedback_culture", "Open challenge — with psychological safety and genuine follow-up", { governance: 4, social: 2 }],
          ["gov_feedback_culture", "Private critique only — candour is easier without an audience", { governance: 1 }],
          ["gov_feedback_culture", "Keep critique minimal — protect the vision so it can land", { alignment: -3 }],
        ]}
      />

      <DialogueQuestion
        npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
        question="How much evidence should actually back an ESG claim before it's published?"
        current={game.answers.gov_proof_standard}
        onSelect={saveAnswer}
        options={[
          ["gov_proof_standard", "Evidence, methods, and assumptions should all be visible", { governance: 5, alignment: 3 }],
          ["gov_proof_standard", "High-level claims are enough — detail creates confusion", { governance: -2 }],
          ["gov_proof_standard", "Only the major claims need to be evidenced", { governance: 1 }],
        ]}
      />

      <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium mb-3">One decision for the Archive</div>
        {[
          { label: "Open the full archive to all forest citizens", effects: { governance: 3, alignment: 2 } },
          { label: "Share curated summaries — accessible but selective", effects: { governance: 2, social: 1 } },
          { label: "Keep sensitive records behind the council doors", effects: { alignment: -2 } },
        ].map(({ label, effects }) => (
          <button key={label} type="button" onClick={() => doAction(label, effects)}
            className={cx("w-full text-left rounded-xl border px-4 py-3 text-sm transition-all",
              acted === label ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" :
              acted ? "border-white/5 text-white/25 cursor-default" :
              "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white cursor-pointer")}>
            {label}
          </button>
        ))}
        {acted && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-white/35 italic pt-1">Decision made: "{acted}"</motion.div>}
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-3">
        <div className="text-xs text-white/35 uppercase tracking-wide font-medium flex items-center gap-2"><Mic className="h-3 w-3" /> One more question</div>
        <SmartInterview
          npcName={NPC.name} npcIcon={NPC.icon} npcColor={NPC.color}
          opener="In your experience — when feedback actually reaches leadership, what happens to it?"
          signalKey="gov_archive_voice" saved={game.voiceSaved.gov_archive_voice}
          onSave={saveVoice} saveAnswer={saveAnswer} effects={{ governance: 2, alignment: 1 }}
        />
      </div>
    </div>
  );
}

function SummaryScreen({ game, selectedProfile, forestStatus, totalDamBuilt, avgTrust, evidenceCount, restart }) {
  const metrics = [
    { label: "Environmental balance", value: game.metrics.environment, icon: Leaf },
    { label: "Social harmony", value: game.metrics.social, icon: Users },
    { label: "Governance trust", value: game.metrics.governance, icon: ShieldCheck },
    { label: "Alignment of leaders and citizens", value: game.metrics.alignment, icon: Crown },
  ];

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
            {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Your playthrough</CardTitle>
            <CardDescription className="text-white/65">Mocked data capture from the 3D journey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/75">
            <StatusRow label="Chosen guardian" value={selectedProfile?.name || "None"} />
            <StatusRow label="Dam supports built" value={`${totalDamBuilt} placed`} />
            <StatusRow label="Average meadow trust" value={`${avgTrust} / 100`} />
            <StatusRow label="Council clues found" value={`${evidenceCount} discovered`} />
            <StatusRow label="Saved voice notes" value={`${Object.keys(game.voiceSaved).length}`} />
            <StatusRow label="Policy chosen" value={formatPolicy(game.policyChoice)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-300" /> Simulated ESG insight output</CardTitle>
            <CardDescription className="text-white/65">How leadership might interpret this run</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/75">
            <InsightPill title="Environmental signal" text={game.metrics.environment >= 70 ? "Environmental action appears visible, practical, and believable." : "Environmental effort may exist, but it does not yet feel consistently tangible to employees."} />
            <InsightPill title="Social signal" text={game.metrics.social >= 70 ? "The forest feels fairly heard and represented across groups." : "There are likely gaps in fairness, representation, or psychological safety."} />
            <InsightPill title="Governance signal" text={game.metrics.governance >= 70 ? "Leadership appears credible, transparent, and accountable." : "Employees may perceive weak follow-through, unclear accountability, or low trust."} />
            <InsightPill title="Alignment signal" text={game.metrics.alignment >= 70 ? "Management vision and lived experience appear relatively aligned." : "The strongest signal is a mismatch between what leaders say and what people feel in daily work."} />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Mock archive of collected responses</CardTitle>
            <CardDescription className="text-white/65">Stored choices, reflections, and simulated voice notes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <ArchiveBlock title="Decision answers" entries={Object.entries(game.answers).slice(0, 12)} />
              <ArchiveBlock title="Voice reflections" entries={Object.entries(game.voiceSaved)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-black/35 text-white backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Prototype checks</CardTitle>
          <CardDescription className="text-white/65">Quick logic tests included in this file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-white/75">
          {SELF_CHECKS.map((test) => <StatusRow key={test.name} label={test.name} value={test.pass ? "pass" : "fail"} />)}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={restart} className="rounded-xl bg-white text-slate-950 hover:bg-white/90">Play again</Button>
        <Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10">Export mocked report</Button>
      </div>
    </div>
  );
}

function LorePill({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <Icon className="mb-3 h-5 w-5 text-emerald-200" />
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-white/65">{text}</div>
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

function MetricBar({ label, value, tone }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-white/60">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10">
        <div className={cx("h-1.5 rounded-full bg-gradient-to-r", toneBar(tone))} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MiniOutcome({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">{title}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}


function SliderPrompt({ label, hint, value, onCommit }) {
  const [localValue, setLocalValue] = useState([value]);

  useEffect(() => {
    setLocalValue([value]);
  }, [value]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="font-medium text-white">{label}</div>
      <div className="mt-1 text-sm text-white/60">{hint}</div>
      <div className="mt-5 space-y-3">
        <Slider value={localValue} min={0} max={100} step={5} onValueChange={setLocalValue} />
        <div className="flex items-center justify-between text-sm text-white/70">
          <span>low</span>
          <span className="font-semibold text-white">{localValue[0]}</span>
          <span>high</span>
        </div>
        <Button onClick={() => onCommit(localValue[0])} className="rounded-xl bg-white text-slate-950 hover:bg-white/90">Save rating</Button>
      </div>
    </div>
  );
}


// ── Conversational UI primitives ──────────────────────────────────────────

function pickFollowup(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("manag") || t.includes("leader") || t.includes("boss") || t.includes("senior"))
    return "How often do those feelings come up in direct conversations with your manager?";
  if (t.includes("fair") || t.includes("equal") || t.includes("unfair") || t.includes("inequ"))
    return "Can you think of a specific moment where that felt most unfair?";
  if (t.includes("communic") || t.includes("told") || t.includes("heard") || t.includes("listen") || t.includes("voice"))
    return "What would genuinely feeling heard on that look like in practice?";
  if (t.includes("trust") || t.includes("believe") || t.includes("credib") || t.includes("honest"))
    return "What would need to change for that trust to feel real and lasting?";
  if (t.includes("change") || t.includes("better") || t.includes("improv") || t.includes("different"))
    return "What's the one change that would make the biggest practical difference for you?";
  if (t.includes("work") || t.includes("load") || t.includes("stress") || t.includes("burn") || t.includes("tired"))
    return "How does that affect your energy and sense of purpose over time?";
  if (t.includes("team") || t.includes("colleague") || t.includes("group") || t.includes("together"))
    return "Do your teammates share that feeling, or is it more specific to your situation?";
  if (t.includes("report") || t.includes("data") || t.includes("number") || t.includes("metric"))
    return "In your experience, do those reports reflect what actually happens day-to-day?";
  const fallbacks = [
    "What does that look like day-to-day for your team?",
    "Has that always been the case, or is it a more recent shift?",
    "If leadership could see one thing clearly from your perspective, what would it be?",
    "What would 'better' actually look like in practice for you?",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function NpcSpeech({ name, icon: Icon, color, children, isThinking = false }) {
  return (
    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-start">
      <div className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center border" style={{ background: color + "20", borderColor: color + "50" }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-white/35 mb-1.5 uppercase tracking-wide font-medium">{name}</div>
        <div className="rounded-2xl rounded-tl-sm bg-white/8 border border-white/10 px-4 py-3 text-sm text-white/85 leading-relaxed">
          {isThinking ? (
            <span className="flex gap-1 items-center h-4">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          ) : children}
        </div>
      </div>
    </motion.div>
  );
}

function DialogueQuestion({ npcName, npcIcon, npcColor, question, options, current, onSelect }) {
  const selected = options.find(([, label]) => current === label);
  return (
    <div className="space-y-3">
      <NpcSpeech name={npcName} icon={npcIcon} color={npcColor}>{question}</NpcSpeech>
      <div className="pl-12 space-y-2">
        {options.map(([key, label, effects], i) => (
          <motion.button
            key={i}
            whileHover={!selected ? { x: 3 } : {}}
            onClick={() => !selected && onSelect(key, label, effects)}
            className={cx(
              "w-full text-left rounded-2xl px-4 py-3 text-sm transition-all border",
              selected && selected[1] === label
                ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                : selected
                  ? "border-white/5 text-white/25 cursor-default"
                  : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:border-white/25 hover:text-white cursor-pointer"
            )}
          >
            <span className="text-white/30 mr-2">{String.fromCharCode(65 + i)}.</span>
            {label}
          </motion.button>
        ))}
      </div>
      {selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pl-12 text-xs text-white/35 italic">
          You said: "{selected[1]}"
        </motion.div>
      )}
    </div>
  );
}

function SmartInterview({ npcName, npcIcon: NpcIcon, npcColor, opener, signalKey, saved, onSave, saveAnswer, effects = {} }) {
  const [step, setStep] = useState(saved ? 3 : 0);
  const [r1, setR1] = useState("");
  const [r2, setR2] = useState("");
  const [followup, setFollowup] = useState("");

  const submitFirst = () => {
    if (!r1.trim() || step !== 0) return;
    setStep(1);
    setTimeout(() => { setFollowup(pickFollowup(r1)); setStep(2); }, 900);
  };

  const submitSecond = () => {
    if (!r2.trim() || step !== 2) return;
    const combined = r1.trim() + " · " + r2.trim();
    onSave(signalKey, combined);
    if (saveAnswer) saveAnswer(signalKey + "_interview", combined, effects);
    setStep(3);
  };

  if (step === 3) {
    return (
      <div className="flex gap-3 items-start">
        <div className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center border" style={{ background: npcColor + "20", borderColor: npcColor + "50" }}>
          <NpcIcon className="h-4 w-4" style={{ color: npcColor }} />
        </div>
        <div className="flex-1">
          <div className="text-[10px] text-white/35 mb-1.5 uppercase tracking-wide font-medium">{npcName}</div>
          <div className="rounded-2xl rounded-tl-sm border border-emerald-400/20 bg-emerald-500/8 px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">Signal recorded</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">Your perspective has been captured anonymously. It will shape how Verdantia understands the gap between experience and leadership intent.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <NpcSpeech name={npcName} icon={NpcIcon} color={npcColor} isThinking={step === 1}>
        {step <= 1 ? opener : followup}
      </NpcSpeech>

      {step === 0 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="pl-12 space-y-2">
          <Textarea
            value={r1}
            onChange={(e) => setR1(e.target.value)}
            placeholder="Share your honest thoughts…"
            className="min-h-[88px] border-white/10 bg-white/5 text-white placeholder:text-white/25 text-sm resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitFirst(); }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/25">⌘↵ or Ctrl↵ to send</span>
            <Button onClick={submitFirst} disabled={!r1.trim()} className="rounded-xl bg-white text-slate-950 hover:bg-white/90 text-xs px-4 py-1.5 h-auto">Send</Button>
          </div>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="pl-12 space-y-2">
          <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-xs text-white/40 italic">"{r1}"</div>
          <Textarea
            value={r2}
            onChange={(e) => setR2(e.target.value)}
            placeholder="Go a little deeper…"
            className="min-h-[88px] border-white/10 bg-white/5 text-white placeholder:text-white/25 text-sm resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitSecond(); }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/25">⌘↵ or Ctrl↵ to submit</span>
            <Button onClick={submitSecond} disabled={!r2.trim()} className="rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-xs px-4 py-1.5 h-auto">Submit</Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function NegotiationCard({ title, need, trust, onSmall, onLarge }) {
  const canOfferTwo = trust < 100;
  const canOfferThree = trust < 100;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium">{title}</div>
          <div className="mt-1 text-sm text-white/60">{need}</div>
        </div>
        <Badge className="bg-white/10 text-white hover:bg-white/10">Trust {trust}</Badge>
      </div>
      <div className="mb-3 h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gradient-to-r from-amber-300 to-emerald-300" style={{ width: `${trust}%` }} />
      </div>
      <div className="flex gap-3">
        <Button onClick={onSmall} disabled={!canOfferTwo} variant="outline" className="flex-1 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10">offer 2</Button>
        <Button onClick={onLarge} disabled={!canOfferThree} className="flex-1 rounded-xl bg-amber-300 text-slate-950 hover:bg-amber-200">offer 3</Button>
      </div>
    </div>
  );
}

function EvidenceTile({ title, text, found, onFind }) {
  return (
    <button type="button" onClick={onFind} className={cx("rounded-2xl border p-5 text-left transition", found ? "border-violet-300 bg-violet-400/15" : "border-white/10 bg-black/20 hover:bg-white/10")}>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">{title}</div>
        {found ? <CheckCircle2 className="h-5 w-5 text-violet-200" /> : <Eye className="h-5 w-5 text-white/50" />}
      </div>
      <div className="text-sm text-white/65">{text}</div>
    </button>
  );
}

function PolicyCard({ title, text, impact, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cx("rounded-2xl border p-5 text-left transition", active ? "border-emerald-300 bg-emerald-400/15" : "border-white/10 bg-black/20 hover:bg-white/10")}>
      <div className="font-medium">{title}</div>
      <div className="mt-2 text-sm text-white/65">{text}</div>
      <div className="mt-4 text-xs uppercase tracking-[0.18em] text-emerald-200/80">{impact}</div>
    </button>
  );
}

function QuestItem({ label, done, detail }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 min-w-0">
        {done ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" /> : <div className="h-3 w-3 shrink-0 rounded-full border border-white/20" />}
        <span className={done ? "text-white/80" : "text-white/55"}>{label}</span>
      </div>
      <span className="text-white/35 shrink-0">{detail}</span>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
          <Icon className="h-5 w-5 text-emerald-200" />
        </div>
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
      <div className="mb-1 font-medium text-white">{title}</div>
      <div className="text-sm text-white/75">{text}</div>
    </div>
  );
}

function ArchiveBlock({ title, entries }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 font-medium text-white">{title}</div>
      <div className="space-y-2 text-sm text-white/70">
        {entries.length === 0 ? (
          <div className="text-white/45">No entries captured.</div>
        ) : (
          entries.map(([key, value]) => (
            <div key={key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-white/45">{key}: </span>
              <span>{String(value)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
