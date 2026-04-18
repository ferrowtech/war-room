import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  Menu,
  X,
  Camera,
  Send,
  Zap,
  User,
  ChevronRight,
  Copy,
  Clock,
  ChevronDown,
  Calendar,
  Check,
  Target,
  Map,
  Thermometer,
  Star,
  Shield,
  RefreshCw,
} from "lucide-react";

const BRIEF_URL = "/.netlify/functions/brief";
const SERVER_WEEK_URL = "/.netlify/functions/server-week";
const HISTORY_KEY = "warroom_history";
const LANG_KEY = "warroom_lang";
const MAX_HISTORY = 20;

// ── Translations ──────────────────────────────────────────────────
const TRANSLATIONS = {
  EN: {
    askAdvisor: "ASK YOUR TACTICAL ADVISOR",
    questionPlaceholder: "Enter your tactical question... (Ctrl+Enter to send)",
    attach: "ATTACH",
    getBriefing: "GET BRIEFING",
    transmitting: "TRANSMITTING",
    intelReport: "INTELLIGENCE REPORT",
    copyBriefing: "COPY BRIEFING",
    copied: "COPIED",
    editProfile: "EDIT PROFILE",
    commander: "COMMANDER",
    server: "SERVER",
    troopType: "TROOP TYPE",
    furnaceLevel: "FURNACE LEVEL",
    squads: "SQUADS",
    sq1: "SQ1 PRIMARY",
    sq2: "SQ2 SECONDARY",
    sq3: "SQ3 SUPPORT",
    counterIntel: "COUNTER INTEL",
    beats: "BEATS:",
    weakTo: "WEAK TO:",
    polarStorm: "POLAR STORM",
    week: "WEEK",
    autoLabel: "AUTO",
    refresh: "REFRESH",
    detecting: "DETECTING...",
    weekNotFound: "Week not detected",
    missionHistory: "MISSION HISTORY",
    clearHistory: "CLEAR HISTORY",
    awaiting: "AWAITING MISSION BRIEFING REQUEST",
    noHeroes: "No heroes set",
    transmissionFailed: "TRANSMISSION FAILED. RETRY MISSION.",
  },
  RU: {
    askAdvisor: "ЗАДАЙТЕ ВОПРОС СОВЕТНИКУ",
    questionPlaceholder: "Введите тактический вопрос... (Ctrl+Enter для отправки)",
    attach: "ФАЙЛ",
    getBriefing: "ПОЛУЧИТЬ ПРИКАЗ",
    transmitting: "ПЕРЕДАЧА...",
    intelReport: "ОПЕРАТИВНАЯ СВОДКА",
    copyBriefing: "КОПИРОВАТЬ",
    copied: "СКОПИРОВАНО",
    editProfile: "ПРОФИЛЬ",
    commander: "КОМАНДИР",
    server: "СЕРВЕР",
    troopType: "ТИП ВОЙСК",
    furnaceLevel: "УРОВЕНЬ ПЕЧИ",
    squads: "ОТРЯДЫ",
    sq1: "ОТР.1 ОСНОВНОЙ",
    sq2: "ОТР.2 ВТОРИЧНЫЙ",
    sq3: "ОТР.3 ПОДДЕРЖКА",
    counterIntel: "РАЗВЕДДАННЫЕ",
    beats: "ПОБЕЖДАЕТ:",
    weakTo: "УЯЗВИМ К:",
    polarStorm: "ПОЛЯРНЫЙ ШТОРМ",
    week: "НЕДЕЛЯ",
    autoLabel: "АВТО",
    refresh: "ОБНОВИТЬ",
    detecting: "ОПРЕДЕЛЯЮ...",
    weekNotFound: "Неделя не определена",
    missionHistory: "ИСТОРИЯ ОПЕРАЦИЙ",
    clearHistory: "ОЧИСТИТЬ ИСТОРИЮ",
    awaiting: "ОЖИДАНИЕ ЗАПРОСА БРИФИНГА",
    noHeroes: "Нет героев",
    transmissionFailed: "ОШИБКА ПЕРЕДАЧИ. ПОВТОРИТЕ МИССИЮ.",
  },
};

// ── Quick Actions (by language) ───────────────────────────────────
const QUICK_ACTIONS = {
  EN: [
    { label: "Today's Boss",         Icon: Target,      question: "Which boss should I attack today and with which heroes?" },
    { label: "Dig Site Strategy",    Icon: Map,         question: "Which Dig Sites should I target and how to capture them?" },
    { label: "Temperature Help",     Icon: Thermometer, question: "My base temperature is dropping, what should I do?" },
    { label: "This Week's Priority", Icon: Calendar,    question: "What should I focus on this week?" },
    { label: "Hero Advice",          Icon: Star,        question: "How should I develop my heroes and what to upgrade next?" },
    { label: "War Phase",            Icon: Shield,      question: "How does the War Phase work and when should I attack?" },
  ],
  RU: [
    { label: "Босс сегодня",         Icon: Target,      question: "Какого босса атаковать сегодня и какими героями?" },
    { label: "Раскопки",             Icon: Map,         question: "Какие раскопки атаковать и как их захватить?" },
    { label: "Температура",          Icon: Thermometer, question: "Температура базы падает, что делать?" },
    { label: "Приоритет недели",     Icon: Calendar,    question: "На что сосредоточиться на этой неделе?" },
    { label: "Герои",                Icon: Star,        question: "Как развивать героев и что прокачивать следующим?" },
    { label: "Фаза войны",           Icon: Shield,      question: "Как работает фаза войны и когда атаковать?" },
  ],
};

// ── Image compression ─────────────────────────────────────────────
const MAX_IMG_WIDTH = 1280;
const MAX_B64_BYTES = 3 * 1024 * 1024;

const compressImage = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > MAX_IMG_WIDTH) {
          h = Math.round((h * MAX_IMG_WIDTH) / w);
          w = MAX_IMG_WIDTH;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        let quality = 0.85;
        let dataUrl;
        do {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          quality = Math.max(quality - 0.1, 0.1);
        } while (dataUrl.length > MAX_B64_BYTES && quality > 0.1);
        resolve({ base64: dataUrl.split(",")[1], dataUrl });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

// ── Weekly schedule ───────────────────────────────────────────────
const WEEKLY_SCHEDULE = {
  EN: {
    1: "Build Titanium Alloy Factory, upgrade Furnace, capture first Dig Site. Level 1 cities unlock Day 3 at 12:00.",
    2: "Expand territory, upgrade Furnace, build Military Bases.",
    3: "Choose faction (Rebels or Gendarmerie) — determines Rare Soil War opponents.",
    4: "Rare Soil War begins — upgrade Alliance Furnace, coordinate with alliance.",
    5: "Active war phase — attack/defense rotations.",
    6: "Push Faction Award points, defend Alliance Furnace.",
    7: "Faction Duel — 4v4 Capitol Conquest, final ranking.",
    8: "Season ends — Transfer Surge available based on rank.",
  },
  RU: {
    1: "Постройте завод Титанового сплава, улучшайте Печь, захватите первые Раскопки. Города 1 ур. открываются на 3-й день в 12:00.",
    2: "Расширяйте территорию, улучшайте Печь, стройте Военные базы.",
    3: "Выберите фракцию (Повстанцы или Жандармерия) — определяет противников в Войне за редкую почву.",
    4: "Война за редкую почву — улучшайте Альянсовую печь, координируйте союз.",
    5: "Активная фаза войны — ротации атаки и обороны.",
    6: "Копите очки наград фракции, защищайте Альянсовую печь.",
    7: "Дуэль фракций — 4 на 4, финальный рейтинг.",
    8: "Сезон заканчивается — доступен Surge перевода по рейтингу.",
  },
};

// ── Fallback: calculate week from start date (backward compat) ────
const getSeasonWeekFromDate = (startDate) => {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const days = Math.floor((now - start) / 86400000);
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), 8);
};

// ── History helpers ───────────────────────────────────────────────
const loadHistory = () => JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
const saveToHistory = (question, response) => {
  const prev = loadHistory();
  const entry = { id: Date.now(), question, response, ts: new Date().toISOString() };
  const updated = [entry, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
};

// ── Typewriter hook ───────────────────────────────────────────────
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
      if (i >= text.length) { setTyping(false); clearInterval(interval); }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, typing };
};

// ── Intelligence Report ───────────────────────────────────────────
const IntelligenceReport = ({ text, isLatest = false, tr }) => {
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
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#4fc3f7]/20">
        <Zap size={14} color="#4fc3f7" strokeWidth={1.5} />
        <span className="font-heading text-xs text-[#4fc3f7] tracking-[0.3em]">
          {tr.intelReport}
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
          <span>{copied ? tr.copied : tr.copyBriefing}</span>
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

// ── History Item ──────────────────────────────────────────────────
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

// ── Season Tracker ────────────────────────────────────────────────
const SeasonTracker = ({ seasonWeek, isDetecting, onRefresh, tr, language }) => {
  const schedule = WEEKLY_SCHEDULE[language] || WEEKLY_SCHEDULE.EN;
  const priority = seasonWeek ? schedule[seasonWeek] : null;

  return (
    <div className="mx-0 border-t border-[#4fc3f7]/15" style={{ background: "rgba(79,195,247,0.03)" }}>
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar size={10} color="#4fc3f7" strokeWidth={1.5} />
          <span className="font-heading text-[9px] text-[#4fc3f7] tracking-[0.3em]">
            {tr.polarStorm} ❄️
          </span>
        </div>
        <button
          data-testid="season-week-refresh-btn"
          onClick={onRefresh}
          disabled={isDetecting}
          className="flex items-center gap-1 font-heading text-[8px] text-[#37474f] tracking-widest hover:text-[#4fc3f7] transition-colors disabled:opacity-40"
        >
          <RefreshCw size={8} className={isDetecting ? "animate-spin" : ""} />
          {tr.refresh}
        </button>
      </div>

      <div className="px-4 pb-3">
        {isDetecting ? (
          <div className="flex items-center gap-2 py-1">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="font-heading text-[9px] text-[#37474f] tracking-widest">{tr.detecting}</span>
          </div>
        ) : seasonWeek ? (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="font-heading text-[9px] text-[#37474f] tracking-widest">{tr.week}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading text-[8px] text-[#4fc3f7]/50 tracking-widest">{tr.autoLabel}</span>
                <span
                  className="font-heading text-2xl text-white"
                  style={{ textShadow: "0 0 12px rgba(79,195,247,0.5)" }}
                  data-testid="season-week-display"
                >
                  {seasonWeek}
                  <span className="text-xs text-[#37474f] ml-1">/8</span>
                </span>
              </div>
            </div>
            <div className="h-1 bg-[#37474f]/30 mb-2">
              <div
                className="h-full bg-[#4fc3f7] transition-all"
                style={{ width: `${(seasonWeek / 8) * 100}%` }}
              />
            </div>
            {priority && (
              <p className="font-report text-[10px] text-[#b3e5fc]/80 leading-relaxed">{priority}</p>
            )}
          </>
        ) : (
          <p className="font-heading text-[9px] text-[#37474f] tracking-wide">{tr.weekNotFound}</p>
        )}
      </div>
    </div>
  );
};

// ── Top Bar ───────────────────────────────────────────────────────
const TopBar = ({ profile, onEditProfile, onTogglePanel, language, onToggleLanguage, tr }) => (
  <div
    className="flex items-center justify-between px-4 py-3 border-b border-[#4fc3f7]/20"
    style={{ background: "rgba(10,14,26,0.95)" }}
  >
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

    <div className="flex items-center gap-2">
      {/* Server/Troop badge */}
      <div
        className="hidden sm:flex items-center gap-1.5 px-2 py-1 border border-[#4fc3f7]/30"
        style={{ background: "rgba(79,195,247,0.06)" }}
      >
        <span className="font-heading text-[10px] text-[#b3e5fc] tracking-widest">
          S-{profile.server}
        </span>
        <span className="text-[#37474f]">|</span>
        <span className="font-heading text-[10px] text-[#4fc3f7] tracking-widest">
          {profile.troopType?.toUpperCase()}
        </span>
      </div>

      {/* EN / RU Language Toggle */}
      <div
        data-testid="language-toggle"
        className="flex items-center overflow-hidden border border-[#4fc3f7]/30"
        style={{ background: "rgba(79,195,247,0.04)" }}
      >
        <button
          data-testid="lang-en-btn"
          onClick={() => language !== "EN" && onToggleLanguage()}
          className={`px-2 py-1 font-heading text-[9px] tracking-widest transition-all ${
            language === "EN"
              ? "bg-[#4fc3f7] text-[#0a0e1a]"
              : "text-[#37474f] hover:text-[#b3e5fc]"
          }`}
        >
          EN
        </button>
        <button
          data-testid="lang-ru-btn"
          onClick={() => language !== "RU" && onToggleLanguage()}
          className={`px-2 py-1 font-heading text-[9px] tracking-widest transition-all ${
            language === "RU"
              ? "bg-[#4fc3f7] text-[#0a0e1a]"
              : "text-[#37474f] hover:text-[#b3e5fc]"
          }`}
        >
          RU
        </button>
      </div>

      <button
        data-testid="edit-profile-link"
        onClick={onEditProfile}
        className="font-heading text-[10px] text-[#37474f] tracking-widest hover:text-[#4fc3f7] transition-colors"
      >
        {tr.editProfile}
      </button>
    </div>
  </div>
);

// ── Profile Panel Content ─────────────────────────────────────────
const ProfilePanelContent = ({
  profile,
  onClose,
  isMobile,
  isDetecting,
  onRefreshWeek,
  tr,
  language,
}) => {
  const troopIcon =
    profile.troopType === "Tank" ? "⚔️" : profile.troopType === "Aircraft" ? "✈️" : "🚀";

  const squadDefs = [
    { label: tr.sq1, indices: [0, 1, 2, 3, 4] },
    { label: tr.sq2, indices: [5, 6, 7, 8, 9] },
    { label: tr.sq3, indices: [10, 11, 12, 13, 14] },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#4fc3f7]/20">
        <div className="flex items-center gap-1.5">
          <User size={12} color="#4fc3f7" strokeWidth={1.5} />
          <span className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.3em]">
            {tr.commander}
          </span>
        </div>
        {isMobile && (
          <button className="text-[#37474f] hover:text-[#4fc3f7] transition-colors" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Server */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">{tr.server}</p>
          <p className="font-heading text-lg text-white">#{profile.server}</p>
        </div>
        <div className="h-px bg-[#37474f]/40" />

        {/* Troop type */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">{tr.troopType}</p>
          <div className="flex items-center gap-2">
            <span className="text-base">{troopIcon}</span>
            <span className="font-heading text-sm text-[#4fc3f7]">{profile.troopType?.toUpperCase()}</span>
          </div>
        </div>
        <div className="h-px bg-[#37474f]/40" />

        {/* Furnace level */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">{tr.furnaceLevel}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#37474f]/40">
              <div className="h-full bg-[#4fc3f7]" style={{ width: `${(profile.furnaceLevel / 20) * 100}%` }} />
            </div>
            <span className="font-heading text-sm text-white w-5 text-right">{profile.furnaceLevel}</span>
          </div>
        </div>
        <div className="h-px bg-[#37474f]/40" />

        {/* Hero squads */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-2">{tr.squads}</p>
          {squadDefs.map(({ label, indices }) => {
            const active = indices
              .map((i) => profile.heroes?.[i])
              .filter((h) => h && h !== "None");
            if (active.length === 0) return null;
            return (
              <div key={label} className="mb-2">
                <p className="font-heading text-[8px] text-[#4fc3f7]/60 tracking-[0.2em] mb-1">{label}</p>
                <div className="space-y-1">
                  {active.map((hero, i) => {
                    const m = hero.match(/^(.+?) \((\d)★\)$/);
                    const name = m ? m[1] : hero;
                    const stars = m ? parseInt(m[2]) : 0;
                    return (
                      <div key={i} className="flex items-center gap-1.5">
                        <ChevronRight size={10} color="#4fc3f7" />
                        <span className="font-heading text-xs text-[#b3e5fc]">{name}</span>
                        {stars > 0 && (
                          <span className="text-xs leading-none">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span key={s} style={{ color: s <= stars ? "#f59e0b" : "#37474f" }}>★</span>
                            ))}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {(!profile.heroes || profile.heroes.filter((h) => h && h !== "None").length === 0) && (
            <span className="font-heading text-[10px] text-[#37474f]">{tr.noHeroes}</span>
          )}
        </div>

        {/* Counter Intel */}
        <div className="h-px bg-[#37474f]/40" />
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-2">{tr.counterIntel}</p>
          <div className="p-2 border border-[#37474f]/40" style={{ background: "rgba(55,71,79,0.1)" }}>
            {profile.troopType === "Tank" && (
              <>
                <p className="font-heading text-[9px] text-green-400 mb-1">✓ {tr.beats} Missile</p>
                <p className="font-heading text-[9px] text-[#ff6f00]">✗ {tr.weakTo} Aircraft</p>
              </>
            )}
            {profile.troopType === "Aircraft" && (
              <>
                <p className="font-heading text-[9px] text-green-400 mb-1">✓ {tr.beats} Tank</p>
                <p className="font-heading text-[9px] text-[#ff6f00]">✗ {tr.weakTo} Missile</p>
              </>
            )}
            {profile.troopType === "Missile" && (
              <>
                <p className="font-heading text-[9px] text-green-400 mb-1">✓ {tr.beats} Aircraft</p>
                <p className="font-heading text-[9px] text-[#ff6f00]">✗ {tr.weakTo} Tank</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Season Week Tracker — pinned at bottom */}
      <SeasonTracker
        seasonWeek={profile.seasonWeek}
        isDetecting={isDetecting}
        onRefresh={onRefreshWeek}
        tr={tr}
        language={language}
      />
    </div>
  );
};

// ── Profile Panel ─────────────────────────────────────────────────
const ProfilePanel = ({ profile, isOpen, onClose, isDetecting, onRefreshWeek, tr, language }) => (
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
          <ProfilePanelContent
            profile={profile}
            onClose={onClose}
            isMobile
            isDetecting={isDetecting}
            onRefreshWeek={onRefreshWeek}
            tr={tr}
            language={language}
          />
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
      <ProfilePanelContent
        profile={profile}
        onClose={onClose}
        isMobile={false}
        isDetecting={isDetecting}
        onRefreshWeek={onRefreshWeek}
        tr={tr}
        language={language}
      />
    </div>
  </>
);

// ── Main WarRoom ──────────────────────────────────────────────────
const WarRoom = ({ profile, onEditProfile }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem(LANG_KEY) || "EN");
  const tr = TRANSLATIONS[language] || TRANSLATIONS.EN;
  const quickActions = QUICK_ACTIONS[language] || QUICK_ACTIONS.EN;

  const [localProfile, setLocalProfile] = useState(profile);
  const [question, setQuestion] = useState("");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [detectingWeek, setDetectingWeek] = useState(false);
  const reportRef = useRef(null);
  const fileInputRef = useRef(null);

  const toggleLanguage = () => {
    const next = language === "EN" ? "RU" : "EN";
    setLanguage(next);
    localStorage.setItem(LANG_KEY, next);
  };

  const detectSeasonWeek = useCallback(async () => {
    if (!localProfile?.server) return;
    setDetectingWeek(true);
    try {
      const res = await fetch(`${SERVER_WEEK_URL}?server=${localProfile.server}`);
      const data = await res.json();
      if (data.week) {
        setLocalProfile((prev) => {
          const updated = { ...prev, seasonWeek: data.week };
          localStorage.setItem("warroom_profile", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.warn("[WAR ROOM] Season week detection failed:", e.message);
    } finally {
      setDetectingWeek(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localProfile?.server]);

  // Auto-detect season week on mount if not already set
  useEffect(() => {
    const effectiveWeek =
      localProfile?.seasonWeek || getSeasonWeekFromDate(localProfile?.seasonStartDate);
    if (!effectiveWeek) {
      detectSeasonWeek();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { base64, dataUrl } = await compressImage(file);
    setUploadedImage(base64);
    setImagePreview(dataUrl);
  }, []);

  const clearImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (overrideQ) => {
    const q = typeof overrideQ === "string" ? overrideQ.trim() : question.trim();
    if (!q || isLoading) return;
    setError("");
    setIsLoading(true);

    try {
      const effectiveWeek =
        localProfile.seasonWeek || getSeasonWeekFromDate(localProfile?.seasonStartDate);

      const payload = {
        question: q,
        server: String(localProfile.server),
        troop_type: localProfile.troopType,
        furnace_level: Number(localProfile.furnaceLevel),
        heroes: localProfile.heroes,
        season_week: effectiveWeek,
        language,
        ...(uploadedImage ? { image_base64: uploadedImage } : {}),
      };

      console.log("[WAR ROOM] Heroes in payload:", JSON.stringify(payload.heroes));

      const res = await axios.post(BRIEF_URL, payload);
      setResponse(res.data.response);
      const newHistory = saveToHistory(q, res.data.response);
      setHistory(newHistory);
      setQuestion("");
      clearImage();

      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      const msg = err.response?.data?.detail || tr.transmissionFailed;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (q) => {
    setQuestion(q);
    handleSubmit(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  return (
    <div
      className="war-noise min-h-screen bg-[#0a0e1a] flex flex-col relative overflow-hidden"
      data-testid="warroom-screen"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(79,195,247,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(79,195,247,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <TopBar
        profile={localProfile}
        onEditProfile={onEditProfile}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        language={language}
        onToggleLanguage={toggleLanguage}
        tr={tr}
      />

      <div className="flex flex-1 overflow-hidden relative z-10">
        <ProfilePanel
          profile={localProfile}
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          isDetecting={detectingWeek}
          onRefreshWeek={detectSeasonWeek}
          tr={tr}
          language={language}
        />

        {/* Center content */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
          {/* Input section */}
          <div className="hud-panel hud-corner p-4 relative overflow-hidden">
            <div className="scan-line-card" />
            <div
              className="absolute top-0 right-0 w-8 h-8 pointer-events-none"
              style={{ borderTop: "1px solid #4fc3f7", borderRight: "1px solid #4fc3f7" }}
            />

            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} color="#4fc3f7" strokeWidth={1.5} />
              <label className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.3em]">
                {tr.askAdvisor}
              </label>
            </div>

            {imagePreview && (
              <div className="relative mb-3 border border-[#4fc3f7]/30 inline-block">
                <img src={imagePreview} alt="Attachment" className="h-16 object-cover" />
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
              placeholder={tr.questionPlaceholder}
              rows={3}
              className="war-input w-full px-3 py-2.5 text-sm resize-none"
            />

            {error && (
              <p className="text-[#ff6f00] text-xs font-heading tracking-widest mt-2">
                ⚠ {error}
              </p>
            )}

            {/* Quick actions — visible before first response */}
            {!response && !isLoading && (
              <div className="grid grid-cols-2 gap-1.5 mt-3" data-testid="quick-actions-grid">
                {quickActions.map(({ label, Icon, question: q }) => (
                  <button
                    key={label}
                    data-testid={`quick-action-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => handleQuickAction(q)}
                    className="quick-action-btn flex items-center gap-2 px-3 py-2 text-left transition-all duration-150"
                  >
                    <Icon size={12} strokeWidth={1.5} className="flex-shrink-0 text-[#4fc3f7]" />
                    <span className="font-heading text-[9px] tracking-[0.15em] text-[#b0bec5] leading-tight">
                      {label.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-3">
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
                className="btn-primary px-3 py-2.5 flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Camera size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">{tr.attach}</span>
              </label>

              <button
                data-testid="get-briefing-button"
                onClick={handleSubmit}
                disabled={!question.trim() || isLoading}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 text-xs"
              >
                {isLoading ? (
                  <>
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="font-heading tracking-[0.2em] ml-1">{tr.transmitting}</span>
                  </>
                ) : (
                  <>
                    <Send size={13} strokeWidth={1.5} />
                    <span className="font-heading tracking-[0.2em]">{tr.getBriefing}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Intelligence Report */}
          {response && (
            <div ref={reportRef}>
              <IntelligenceReport text={response} isLatest tr={tr} />
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
                  {tr.missionHistory} ({history.length})
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
                  <button
                    data-testid="clear-history-button"
                    onClick={() => {
                      localStorage.removeItem(HISTORY_KEY);
                      setHistory([]);
                      setShowHistory(false);
                    }}
                    className="w-full mt-2 py-2 px-3 font-heading text-[9px] tracking-[0.25em] text-[#37474f] border border-[#37474f]/20 hover:text-[#ff6f00] hover:border-[#ff6f00]/30 transition-colors"
                    style={{ background: "rgba(10,14,26,0.3)" }}
                  >
                    {tr.clearHistory}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!response && (
            <div className="flex flex-col items-center justify-center flex-1 py-12 opacity-20">
              <Zap size={40} color="#4fc3f7" strokeWidth={0.8} className="mb-3" />
              <p className="font-heading text-xs text-[#4fc3f7] tracking-[0.3em] text-center">
                {tr.awaiting}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WarRoom;
