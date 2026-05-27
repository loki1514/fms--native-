import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Paperclip,
  Mic,
  Send,
  Search,
  UserPlus,
  Check,
  FileText,
} from "lucide-react";
import { SidekickFace, type FaceState } from "./SidekickFace";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SUGGESTED = [
  "Show critical tickets at SS Plaza",
  "Energy spike yesterday — why?",
  "Open checklist items for today",
  "Compare health across properties",
  "Who's on call for Bajaj Kolkata?",
];

const TEAM = [
  { id: "1", name: "Aarav Mehta", role: "Facility Manager" },
  { id: "2", name: "Priya Shah", role: "Ops Lead" },
  { id: "3", name: "Rohan Kapoor", role: "Engineer" },
  { id: "4", name: "Nisha Verma", role: "Security Head" },
  { id: "5", name: "Devansh Iyer", role: "Tech Support" },
  { id: "6", name: "Kavya Nair", role: "Housekeeping" },
];

export function SidekickChat({ open, onClose }: Props) {
  const [input, setInput] = useState("");
  const [faceState, setFaceState] = useState<FaceState>("idle");
  const [showMembers, setShowMembers] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);

  const filtered = TEAM.filter((m) =>
    m.name.toLowerCase().includes(memberQuery.toLowerCase()),
  );

  const toggleMember = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleAttach = () => {
    const fake = `Report-${Math.floor(Math.random() * 999)}.pdf`;
    setDocs((d) => [...d, fake]);
  };

  const handleMicToggle = () =>
    setFaceState((s) => (s === "listening" ? "idle" : "listening"));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl glass-strong sm:h-[80vh] sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.2_145)] pulse-dot" />
                <h2 className="text-display text-lg text-white">Cassandra</h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Face */}
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-6">
              <SidekickFace size={140} state={faceState} onClick={handleMicToggle} />
              <p className="text-sm text-white/70">
                {faceState === "listening"
                  ? "Listening…"
                  : faceState === "speaking"
                    ? "Speaking…"
                    : "Tap face to speak"}
              </p>
            </div>

            {/* Suggested pills */}
            <div className="px-5 pb-3">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/45">
                Based on recent chats
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-white/85 backdrop-blur-xl transition hover:border-white/30 hover:bg-white/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Attached docs / members chips */}
            {(docs.length > 0 || selected.length > 0) && (
              <div className="flex flex-wrap gap-2 px-5 pb-2">
                {docs.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1.5 rounded-full bg-[oklch(0.7_0.15_235)/20%] px-3 py-1 text-xs text-[oklch(0.85_0.12_235)]"
                  >
                    <FileText className="h-3 w-3" /> {d}
                  </span>
                ))}
                {selected.map((id) => {
                  const m = TEAM.find((t) => t.id === id);
                  return (
                    <span
                      key={id}
                      className="rounded-full bg-[oklch(0.78_0.2_145)/20%] px-3 py-1 text-xs text-[oklch(0.85_0.18_145)]"
                    >
                      @{m?.name.split(" ")[0]}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Member dropdown */}
            <AnimatePresence>
              {showMembers && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="relative z-10 overflow-hidden border-t border-white/10 bg-[oklch(0.15_0.02_280)]"
                >
                  <div className="flex items-center gap-2 px-5 py-3">
                    <Search className="h-4 w-4 text-white/50" />
                    <input
                      autoFocus
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      placeholder="Search members…"
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto px-2 pb-2">
                    {filtered.map((m) => {
                      const on = selected.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleMember(m.id)}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-white/5"
                        >
                          <div>
                            <div className="text-sm text-white">{m.name}</div>
                            <div className="text-xs text-white/50">{m.role}</div>
                          </div>
                          {on && (
                            <Check className="h-4 w-4 text-[oklch(0.78_0.2_145)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input bar */}
            <div className="mt-auto border-t border-white/10 bg-black/20 px-3 py-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-xl">
                <button
                  onClick={handleAttach}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Attach document"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowMembers((v) => !v)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 ${
                    showMembers ? "text-white" : "text-white/70"
                  }`}
                  aria-label="Add members"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Sidekick anything…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
                <button
                  onClick={handleMicToggle}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                    faceState === "listening"
                      ? "bg-[oklch(0.66_0.24_22)] text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                  aria-label="Voice"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90"
                  aria-label="Send"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
