import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  Menu,
  X,
  Camera,
  Send,
  Shield,
  Zap,
  User,
  ChevronRight,
  Lock,
  Copy,
  Clock,
  ChevronDown,
  Calendar,
  Check,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DAILY_LIMIT = 3;
const HISTORY_KEY = "warroom_history";
const MAX_HISTORY = 20;

const WEEKLY_SCHEDULE = {
  1: "Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site. Level 1 cities unlock Day 3 at 12:00.",
  2: "Expand territory, upgrade Furnace, build Military Bases.",
  3: "Choose faction (Rebels or Gendarmerie) — determines Rare Soil War opponents.",
  4: "Rare Soil War begins — upgrade Alliance Furnace, coordinate with alliance.",
  5: "Active war phase — attack/defense rotations.",
  6: "Push Faction Award points, defend Alliance Furnace.",
  7: "Faction Duel — 4v4 Capitol Conquest, final ranking.",
  8: "Season ends — Transfer Surge available based on rank.",
};

// ── Rate limit helpers ──────────────────────────────────────────
const getToday = () => new Date().toDateString();
const getRemainingMissions = () => {
  const stored = JSON.parse(localStorage.getItem("warroom_missions") || "null");
  if (!stored || stored.date !== getToday()) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - stored.used);
};
const consumeMission = () => {
  const today = getToday();
  const stored = JSON.parse(localStorage.getItem("warroom_missions") || "null");
  const current =
    stored && stored.date === today ? stored : { date: today, used: 0 };
  current.used += 1;
  localStorage.setItem("warroom_missions", JSON.stringify(current));
  return Math.max(0, DAILY_LIMIT - current.used);
};

// ── Season helpers ──────────────────────────────────────────────
const getSeasonWeek = (startDate) => {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), 8);
};

// ── History helpers ─────────────────────────────────────────────
const loadHistory = () =>
  JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
const saveToHistory = (question, response) => {
  const prev = loadHistory();
  const entry = { id: Date.now(), question, response, ts: new Date().toISOString() };
  const updated = [entry, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
};

// ── Typewriter hook ─────────────────────────────────────────────
const useTypewriter = (text, speed = 18) => {
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!text) { setDisplayed(""); return; }
    setDisplayed("");
    setTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.substring(0, i));
      if (i >= text.length) {
        setTyping(false);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, typing };
};

// ── Intelligence Report ─────────────────────────────────────────
const IntelligenceReport = ({ text, isLatest = false }) => {
  const { displayed, typing } = useTypewriter(isLatest ? text : null);
  const shownText = isLatest ? displayed : text;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="intel-report p-5 relative" data-testid="intelligence-report">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#4fc3f7]/20">
        <Zap size={14} color="#4fc3f7" strokeWidth={1.5} />
        <span className="font-heading text-xs text-[#4fc3f7] tracking-[0.3em]">
          INTELLIGENCE REPORT
        </span>
        {typing && (
          <div className="flex gap-1 mr-auto">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        )}
        <button
          data-testid="copy-briefing-button"
          onClick={handleCopy}
          disabled={typing}
          className={`ml-auto btn-primary px-2 py-1 flex items-center gap-1.5 text-[10px] ${typing ? "opacity-30 cursor-not-allowed" : ""}`}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          <span>{copied ? "COPIED" : "COPY BRIEFING"}</span>
        </button>
      </div>

      <div className="font-report text-[#b3e5fc] text-sm leading-relaxed">
        {typing ? (
          <>
            {shownText}
            <span className="typewriter-cursor" />
          </>
        ) : (
          <ReactMarkdown
            className="markdown-report"
            components={{
              h2: ({ children }) => <strong className="block text-[#4fc3f7] font-heading text-xs tracking-widest mt-3 mb-1">{children}</strong>,
              h3: ({ children }) => <strong className="block text-[#b3e5fc] font-heading text-xs tracking-widest mt-2 mb-1">{children}</strong>,
              strong: ({ children }) => <strong className="text-white">{children}</strong>,
              li: ({ children }) => <li className="ml-4 list-disc text-[#b3e5fc]">{children}</li>,
              p: ({ children }) => <p className="mb-2">{children}</p>,
            }}
          >
            {shownText}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
};

// ── History Item ────────────────────────────────────────────────
const HistoryItem = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.response).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const timeStr = new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = new Date(item.ts).toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div
      className="border border-[#37474f]/40 transition-all duration-200 hover:border-[#4fc3f7]/30"
      style={{ background: "rgba(10,14,26,0.7)" }}
      data-testid="history-item"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left flex items-start gap-2 min-w-0"
        >
          <ChevronDown
            size={12}
            color="#37474f"
            className={`mt-0.5 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
          <div className="min-w-0">
            <span className="font-heading text-[9px] text-[#37474f] tracking-widest block">
              {dateStr} {timeStr}
            </span>
            <span className="font-report text-xs text-[#b3e5fc]/70 line-clamp-1 block mt-0.5">
              {item.question}
            </span>
          </div>
        </button>
        <button
          data-testid="history-copy-button"
          onClick={handleCopy}
          className="flex-shrink-0 btn-primary px-2 py-1 flex items-center gap-1 text-[9px]"
        >
          {copied ? <Check size={9} /> : <Copy size={9} />}
          <span>{copied ? "✓" : "COPY"}</span>
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#37474f]/30">
          <ReactMarkdown
            className="markdown-report"
            components={{
              h2: ({ children }) => <strong className="block text-[#4fc3f7] font-heading text-xs tracking-widest mt-2 mb-1">{children}</strong>,
              strong: ({ children }) => <strong className="text-white">{children}</strong>,
              li: ({ children }) => <li className="ml-3 list-disc text-[#b3e5fc]/80 text-xs">{children}</li>,
              p: ({ children }) => <p className="mb-1.5 text-xs text-[#b3e5fc]/80">{children}</p>,
            }}
          >
            {item.response}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// ── Season Week Tracker ─────────────────────────────────────────
const SeasonTracker = ({ seasonStartDate, onUpdateDate }) => {
  const [editing, setEditing] = useState(false);
  const [tempDate, setTempDate] = useState(seasonStartDate || "");

  const week = getSeasonWeek(seasonStartDate);
  const priority = week ? WEEKLY_SCHEDULE[week] : null;

  const handleSave = () => {
    if (tempDate) {
      onUpdateDate(tempDate);
      setEditing(false);
    }
  };

  return (
    <div
      className="mx-0 border-t border-[#4fc3f7]/15"
      style={{ background: "rgba(79,195,247,0.03)" }}
    >
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar size={10} color="#4fc3f7" strokeWidth={1.5} />
          <span className="font-heading text-[9px] text-[#4fc3f7] tracking-[0.3em]">
            POLAR STORM ❄️
          </span>
        </div>
        {seasonStartDate && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="font-heading text-[8px] text-[#37474f] tracking-widest hover:text-[#4fc3f7] transition-colors"
          >
            CHANGE
          </button>
        )}
      </div>

      {!seasonStartDate && !editing ? (
        <div className="px-4 pb-3">
          <p className="font-heading text-[9px] text-[#37474f] tracking-wide mb-2">
            Set Season 2 start date to track week
          </p>
          <button
            data-testid="set-season-date-btn"
            onClick={() => setEditing(true)}
            className="btn-primary w-full py-1.5 text-[9px]"
          >
            SET START DATE
          </button>
        </div>
      ) : editing ? (
        <div className="px-4 pb-3 space-y-2">
          <input
            data-testid="season-date-input"
            type="date"
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            className="war-input w-full px-2 py-1.5 text-xs"
            style={{ colorScheme: "dark" }}
          />
          <div className="flex gap-2">
            <button
              data-testid="season-date-save-btn"
              onClick={handleSave}
              className="btn-primary flex-1 py-1.5 text-[9px]"
            >
              CONFIRM
            </button>
            {seasonStartDate && (
              <button
                onClick={() => setEditing(false)}
                className="btn-secondary px-3 py-1.5 text-[9px] border border-[#37474f]/50 font-heading text-[#37474f] hover:text-white transition-colors"
              >
                CANCEL
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="font-heading text-[9px] text-[#37474f] tracking-widest">WEEK</span>
            <span
              className="font-heading text-2xl text-white"
              style={{ textShadow: "0 0 12px rgba(79,195,247,0.5)" }}
              data-testid="season-week-display"
            >
              {week}
              <span className="text-xs text-[#37474f] ml-1">/8</span>
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-[#37474f]/30 mb-2">
            <div
              className="h-full bg-[#4fc3f7] transition-all"
              style={{ width: `${(week / 8) * 100}%` }}
            />
          </div>
          <p className="font-report text-[10px] text-[#b3e5fc]/80 leading-relaxed">
            {priority}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Top Bar ─────────────────────────────────────────────────────
const TopBar = ({ profile, onEditProfile, onTogglePanel }) => (
  <div
    className="flex items-center justify-between px-4 py-3 border-b border-[#4fc3f7]/20"
    style={{ background: "rgba(10,14,26,0.95)" }}
  >
    {/* Left: menu toggle + logo */}
    <div className="flex items-center gap-3">
      <button
        data-testid="panel-toggle-button"
        onClick={onTogglePanel}
        className="btn-primary p-1.5 md:hidden"
        aria-label="Toggle profile panel"
      >
        <Menu size={16} />
      </button>
      <div className="flex items-center gap-2">
        <span className="text-[#4fc3f7] text-lg">❄️</span>
        <span
          className="font-heading text-xl text-white tracking-[0.2em]"
          style={{ textShadow: "0 0 15px rgba(79,195,247,0.5)" }}
        >
          WAR ROOM
        </span>
      </div>
    </div>

    {/* Right: badges + edit */}
    <div className="flex items-center gap-2">
      <div
        className="hidden sm:flex items-center gap-1.5 px-2 py-1 border border-[#4fc3f7]/30"
        style={{ background: "rgba(79,195,247,0.06)" }}
      >
        <span className="font-heading text-[10px] text-[#b3e5fc] tracking-widest">
          S-{profile.server}
        </span>
        <span className="text-[#37474f]">|</span>
        <span className="font-heading text-[10px] text-[#4fc3f7] tracking-widest">
          {profile.troopType.toUpperCase()}
        </span>
      </div>
      <button
        data-testid="edit-profile-link"
        onClick={onEditProfile}
        className="font-heading text-[10px] text-[#37474f] tracking-widest hover:text-[#4fc3f7] transition-colors"
      >
        EDIT PROFILE
      </button>
    </div>
  </div>
);

// ── Profile Panel ───────────────────────────────────────────────
const ProfilePanelContent = ({ profile, onClose, isMobile, onUpdateSeasonDate }) => {
  const troopIcon =
    profile.troopType === "Tank" ? "⚔️" : profile.troopType === "Aircraft" ? "✈️" : "🚀";

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#4fc3f7]/20">
        <div className="flex items-center gap-1.5">
          <User size={12} color="#4fc3f7" strokeWidth={1.5} />
          <span className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.3em]">
            COMMANDER
          </span>
        </div>
        {isMobile && (
          <button
            className="text-[#37474f] hover:text-[#4fc3f7] transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Server */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">SERVER</p>
          <p className="font-heading text-lg text-white">#{profile.server}</p>
        </div>
        <div className="h-px bg-[#37474f]/40" />

        {/* Troop type */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">TROOP TYPE</p>
          <div className="flex items-center gap-2">
            <span className="text-base">{troopIcon}</span>
            <span className="font-heading text-sm text-[#4fc3f7]">{profile.troopType.toUpperCase()}</span>
          </div>
        </div>
        <div className="h-px bg-[#37474f]/40" />

        {/* Furnace level */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">FURNACE LEVEL</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#37474f]/40">
              <div className="h-full bg-[#4fc3f7]" style={{ width: `${(profile.furnaceLevel / 20) * 100}%` }} />
            </div>
            <span className="font-heading text-sm text-white w-5 text-right">{profile.furnaceLevel}</span>
          </div>
        </div>
        <div className="h-px bg-[#37474f]/40" />

        {/* Heroes */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-2">🏔️ HEROES</p>
          <div className="space-y-1.5">
            {profile.heroes.filter((h) => h.trim()).map((hero, i) => (
              <div key={i} className="flex items-center gap-2">
                <ChevronRight size={10} color="#4fc3f7" />
                <span className="font-heading text-xs text-[#b3e5fc]">{hero}</span>
              </div>
            ))}
            {profile.heroes.filter((h) => h.trim()).length === 0 && (
              <span className="font-heading text-[10px] text-[#37474f]">No heroes set</span>
            )}
          </div>
        </div>

        {/* Counter info */}
        <div className="h-px bg-[#37474f]/40" />
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-2">COUNTER INTEL</p>
          <div className="p-2 border border-[#37474f]/40" style={{ background: "rgba(55,71,79,0.1)" }}>
            {profile.troopType === "Tank" && (
              <>
                <p className="font-heading text-[9px] text-green-400 mb-1">✓ BEATS: Missile</p>
                <p className="font-heading text-[9px] text-[#ff6f00]">✗ WEAK TO: Aircraft</p>
              </>
            )}
            {profile.troopType === "Aircraft" && (
              <>
                <p className="font-heading text-[9px] text-green-400 mb-1">✓ BEATS: Tank</p>
                <p className="font-heading text-[9px] text-[#ff6f00]">✗ WEAK TO: Missile</p>
              </>
            )}
            {profile.troopType === "Missile" && (
              <>
                <p className="font-heading text-[9px] text-green-400 mb-1">✓ BEATS: Aircraft</p>
                <p className="font-heading text-[9px] text-[#ff6f00]">✗ WEAK TO: Tank</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Season Week Tracker — pinned below scroll */}
      <SeasonTracker
        seasonStartDate={profile.seasonStartDate}
        onUpdateDate={onUpdateSeasonDate}
      />
    </div>
  );
};

const ProfilePanel = ({ profile, isOpen, onClose, onUpdateSeasonDate }) => (
  <>
    {/* Mobile: overlay drawer */}
    {isOpen && (
      <div className="md:hidden fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div
          data-testid="profile-panel-mobile"
          className="absolute left-0 top-0 bottom-0 w-72 flex flex-col"
          style={{
            background: "rgba(8,12,22,0.98)",
            borderRight: "1px solid rgba(79,195,247,0.35)",
            boxShadow: "4px 0 20px rgba(0,0,0,0.5)",
            animation: "slideInLeft 0.25s ease",
          }}
        >
          <ProfilePanelContent profile={profile} onClose={onClose} isMobile onUpdateSeasonDate={onUpdateSeasonDate} />
        </div>
      </div>
    )}

    {/* Desktop: always visible sidebar */}
    <div
      data-testid="profile-panel"
      className="hidden md:flex flex-col w-52 flex-shrink-0"
      style={{
        background: "rgba(8,12,22,0.95)",
        borderRight: "1px solid rgba(79,195,247,0.3)",
        boxShadow: "2px 0 12px rgba(79,195,247,0.08)",
      }}
    >
      <ProfilePanelContent profile={profile} onClose={onClose} isMobile={false} onUpdateSeasonDate={onUpdateSeasonDate} />
    </div>
  </>
);

// ── Mission Bar ─────────────────────────────────────────────────
const MissionBar = ({ remaining }) => {
  const isLow = remaining <= 1;
  return (
    <div
      data-testid="missions-remaining-counter"
      className={`flex items-center justify-between px-4 py-3 border-t flex-shrink-0 ${
        isLow ? "border-[#ff6f00]/40 mission-low" : "border-[#4fc3f7]/15"
      }`}
      style={{
        background: isLow ? "rgba(255,111,0,0.06)" : "rgba(8,12,22,0.98)",
        minHeight: "44px",
      }}
    >
      <div className="flex items-center gap-2">
        <Shield size={13} color={isLow ? "#ff6f00" : "#4fc3f7"} strokeWidth={1.5} />
        <span className={`font-heading text-xs tracking-[0.2em] ${isLow ? "text-[#ff6f00]" : "text-[#4fc3f7]"}`}>
          MISSIONS REMAINING
        </span>
      </div>
      <span
        className={`font-heading text-base font-bold px-2 py-0.5 border ${
          isLow
            ? "text-[#ff6f00] border-[#ff6f00]/40 bg-[#ff6f00]/10"
            : "text-[#4fc3f7] border-[#4fc3f7]/30 bg-[#4fc3f7]/05"
        }`}
        data-testid="missions-count"
      >
        {remaining}/{DAILY_LIMIT}
      </span>
    </div>
  );
};

// ── Locked Overlay ──────────────────────────────────────────────
const LockedOverlay = () => (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center z-20"
    style={{
      background:
        "linear-gradient(135deg, rgba(10,14,26,0.96) 0%, rgba(20,25,40,0.98) 100%)",
      border: "1px solid rgba(255,111,0,0.5)",
    }}
    data-testid="locked-overlay"
  >
    <Lock size={32} color="#ff6f00" strokeWidth={1} className="mb-4 opacity-80" />
    <h3 className="font-heading text-base text-[#ff6f00] tracking-[0.3em] mb-2 text-center">
      DAILY MISSION LIMIT REACHED
    </h3>
    <p className="font-report text-sm text-[#b3e5fc]/60 mb-6 text-center max-w-xs">
      Upgrade to Premium for unlimited tactical briefings
    </p>
    <a
      href="#premium"
      data-testid="upgrade-premium-button"
      className="btn-warning px-8 py-3 text-sm no-underline inline-block text-center"
    >
      ⚡ UPGRADE TO PREMIUM
    </a>
    <p className="font-heading text-[10px] text-[#37474f] mt-4 tracking-widest">
      RESETS AT MIDNIGHT
    </p>
  </div>
);

// ── Main WarRoom ────────────────────────────────────────────────
const WarRoom = ({ profile, onEditProfile }) => {
  const [localProfile, setLocalProfile] = useState(profile);
  const [question, setQuestion] = useState("");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState(getRemainingMissions);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const reportRef = useRef(null);
  const fileInputRef = useRef(null);

  const updateSeasonDate = (date) => {
    const updated = { ...localProfile, seasonStartDate: date };
    setLocalProfile(updated);
    localStorage.setItem("warroom_profile", JSON.stringify(updated));
  };

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      setUploadedImage(base64);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!question.trim() || isLoading || remaining <= 0) return;
    setError("");
    setIsLoading(true);

    try {
      const payload = {
        question: question.trim(),
        server: String(localProfile.server),
        troop_type: localProfile.troopType,
        furnace_level: Number(localProfile.furnaceLevel),
        heroes: localProfile.heroes,
        ...(uploadedImage ? { image_base64: uploadedImage } : {}),
      };

      const res = await axios.post(`${API}/brief`, payload);
      const newRemaining = consumeMission();
      setRemaining(newRemaining);
      setResponse(res.data.response);
      const newHistory = saveToHistory(question.trim(), res.data.response);
      setHistory(newHistory);
      setQuestion("");
      clearImage();

      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      const msg =
        err.response?.data?.detail || "TRANSMISSION FAILED. RETRY MISSION.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <div
      className="war-noise min-h-screen bg-[#0a0e1a] flex flex-col relative overflow-hidden"
      data-testid="warroom-screen"
    >
      <div className="scan-line" />

      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(79,195,247,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(79,195,247,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Top Bar */}
      <TopBar
        profile={localProfile}
        onEditProfile={onEditProfile}
        onTogglePanel={() => setPanelOpen((v) => !v)}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left Panel */}
        <ProfilePanel
          profile={localProfile}
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          onUpdateSeasonDate={updateSeasonDate}
        />

        {/* Center */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
          {/* Input section */}
          <div className="hud-panel hud-corner p-4 relative">
            {/* Top-right corner accent */}
            <div
              className="absolute top-0 right-0 w-8 h-8 pointer-events-none"
              style={{
                borderTop: "1px solid #4fc3f7",
                borderRight: "1px solid #4fc3f7",
              }}
            />

            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} color="#4fc3f7" strokeWidth={1.5} />
              <label className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.3em]">
                ASK YOUR TACTICAL ADVISOR
              </label>
            </div>

            {/* Image preview */}
            {imagePreview && (
              <div className="relative mb-3 border border-[#4fc3f7]/30 inline-block">
                <img
                  src={imagePreview}
                  alt="Attachment"
                  className="h-16 object-cover"
                />
                <button
                  onClick={clearImage}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-[#ff6f00] text-white flex items-center justify-center text-xs"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            <textarea
              data-testid="ask-advisor-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your tactical question... (Ctrl+Enter to send)"
              rows={3}
              disabled={remaining <= 0}
              className="war-input w-full px-3 py-2.5 text-sm resize-none"
            />

            {error && (
              <p className="text-[#ff6f00] text-xs font-heading tracking-widest mt-2">
                ⚠ {error}
              </p>
            )}

            <div className="flex gap-2 mt-3">
              {/* Image upload */}
              <input
                ref={fileInputRef}
                data-testid="image-upload-input"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                data-testid="image-upload-btn"
                className={`btn-primary px-3 py-2.5 flex items-center gap-1.5 cursor-pointer text-xs ${
                  remaining <= 0 ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <Camera size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">ATTACH</span>
              </label>

              {/* Submit */}
              <button
                data-testid="get-briefing-button"
                onClick={handleSubmit}
                disabled={!question.trim() || isLoading || remaining <= 0}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 text-xs"
              >
                {isLoading ? (
                  <>
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="font-heading tracking-[0.2em] ml-1">
                      TRANSMITTING
                    </span>
                  </>
                ) : (
                  <>
                    <Send size={13} strokeWidth={1.5} />
                    <span className="font-heading tracking-[0.2em]">
                      GET BRIEFING
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Locked overlay */}
            {remaining <= 0 && <LockedOverlay />}
          </div>

          {/* Intelligence Report */}
          {response && (
            <div ref={reportRef}>
              <IntelligenceReport text={response} isLatest />
            </div>
          )}

          {/* Mission History */}
          {history.length > 0 && (
            <div className="mt-2">
              <button
                data-testid="history-toggle-button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-2 w-full py-2 px-3 border border-[#37474f]/30 hover:border-[#4fc3f7]/30 transition-colors"
                style={{ background: "rgba(10,14,26,0.5)" }}
              >
                <Clock size={11} color="#37474f" strokeWidth={1.5} />
                <span className="font-heading text-[10px] text-[#37474f] tracking-[0.25em] flex-1 text-left">
                  MISSION HISTORY ({history.length})
                </span>
                <ChevronDown
                  size={12}
                  color="#37474f"
                  className={`transition-transform duration-200 ${showHistory ? "rotate-180" : ""}`}
                />
              </button>
              {showHistory && (
                <div className="space-y-1 mt-1">
                  {history.map((item) => (
                    <HistoryItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!response && remaining > 0 && (
            <div className="flex flex-col items-center justify-center flex-1 py-12 opacity-20">
              <Zap size={40} color="#4fc3f7" strokeWidth={0.8} className="mb-3" />
              <p className="font-heading text-xs text-[#4fc3f7] tracking-[0.3em] text-center">
                AWAITING MISSION BRIEFING REQUEST
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Mission Bar */}
      <MissionBar remaining={remaining} />
    </div>
  );
};

export default WarRoom;
