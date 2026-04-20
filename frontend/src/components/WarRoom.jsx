import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  Menu, X, Camera, Send, Zap, User, Copy, Clock,
  ChevronDown, Calendar, Check, Target, Map, Thermometer, Star, Shield, RefreshCw,
} from "lucide-react";

const BRIEF_URL       = "/.netlify/functions/brief";
const SERVER_WEEK_URL = "/.netlify/functions/server-week";
const HISTORY_KEY     = "warroom_history";
const LANG_KEY        = "warroom_lang";
const MAX_HISTORY     = 20;

// ── Hero type map — Squad 1 (indices 0–4) determines the primary troop type ──
const HERO_TYPES_MAP = {
  Murphy: "Tank",    Kimberly: "Tank",  Marshall: "Tank",  Williams: "Tank",
  Mason:  "Tank",    Violet:   "Tank",  Richard:  "Tank",  Monica:   "Tank",
  Scarlett: "Tank",  Stetmann: "Tank",
  DVA:     "Aircraft", Carlie:   "Aircraft", Schuyler: "Aircraft", Morrison: "Aircraft",
  Lucius:  "Aircraft", Sarah:    "Aircraft", Maxwell:  "Aircraft", Cage:     "Aircraft",
  Swift:  "Missile", Tesla:    "Missile", Fiona:    "Missile", Adam:     "Missile",
  Venom:  "Missile", McGregor: "Missile", Elsa:     "Missile", Kane:     "Missile",
};

// Single source of truth for troop type — inferred ONLY from Squad 1 heroes
const inferTroopType = (heroes = []) => {
  const counts = { Tank: 0, Aircraft: 0, Missile: 0 };
  heroes.slice(0, 5).forEach((h) => {
    if (!h || h === "None") return;
    const name = h.replace(/\s*\(\d[★*]\)$/, "").trim();
    const t = HERO_TYPES_MAP[name];
    if (t) counts[t]++;
  });
  const max = Math.max(...Object.values(counts));
  if (max === 0) return "Tank";
  return Object.keys(counts).find((k) => counts[k] === max) || "Tank";
};

// ── Server timezone — all Last War servers use UTC-2 (fixed) ─────
const SERVER_UTC_OFFSET = -2;

// Returns current server time as HH:MM — now.getTime() is already UTC, apply offset once only
const getServerTime = () => {
  const now = new Date();
  const serverMs = now.getTime() + SERVER_UTC_OFFSET * 3600000;
  const d = new Date(serverMs);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

// Returns time until next Wednesday/Saturday 12:00 server time (UTC-2)
const getWarCountdown = () => {
  const now = new Date();
  const serverNowMs = now.getTime() + SERVER_UTC_OFFSET * 3600000;
  const warDayNums  = [3, 6]; // Wednesday=3, Saturday=6
  const DAY_NAMES   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const d = new Date(serverNowMs + daysAhead * 86400000);
    if (!warDayNums.includes(d.getUTCDay())) continue;

    const warServerMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
    if (warServerMs <= serverNowMs) continue;

    const warActualUTC = warServerMs - SERVER_UTC_OFFSET * 3600000;
    const diffMs = warActualUTC - now.getTime();
    if (diffMs <= 0) continue;

    const days  = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const mins  = Math.floor((diffMs % 3600000) / 60000);
    const countdown = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return { dayName: DAY_NAMES[d.getUTCDay()], countdown };
  }
  return { dayName: "-", countdown: "-" };
};

// ── Translations ──────────────────────────────────────────────────
const TRANSLATIONS = {
  EN: {
    askAdvisor: "INTELLIGENCE REQUEST",
    questionPlaceholder: "Enter your tactical query...",
    attach: "SCAN SCREEN", getBriefing: "GET BRIEFING", transmitting: "TRANSMITTING",
    intelReport: "INTELLIGENCE REPORT", copyBriefing: "COPY BRIEFING", copied: "COPIED",
    editProfile: "EDIT PROFILE", commander: "FIELD STATUS", server: "SERVER",
    furnaceLevel: "FURNACE LEVEL", droneLevel: "DRONE LEVEL", squads: "SQUADS",
    sq1: "SQ1 PRIMARY", sq2: "SQ2 SECONDARY", sq3: "SQ3 SUPPORT",
    polarStorm: "POLAR STORM", week: "WEEK", autoLabel: "AUTO",
    refresh: "REFRESH", detecting: "DETECTING...", weekNotFound: "Week not detected",
    missionHistory: "MISSION HISTORY", clearHistory: "CLEAR HISTORY",
    awaiting: "AWAITING MISSION BRIEFING REQUEST", noHeroes: "No heroes set",
    transmissionFailed: "TRANSMISSION FAILED. RETRY MISSION.",
    todaysBoss: "TODAY'S BOSS", bonusDay: "YOUR BONUS DAY",
    noBossToday: "No Wanted Boss today", notYourBonus: "not your bonus", dayWord: "day",
    digSiteWidget: "DIG SITE TARGET", target: "TARGET", digSites: "DIG SITES", weakToShort: "weak to",
    warPhaseLabel: "WAR PHASE", nextWar: "NEXT WAR", st: "ST", inTime: "in", serverNow: "SERVER",
    timezoneHint: "Set timezone to match your server time",
  },
  RU: {
    askAdvisor: "ЗАПРОС РАЗВЕДКИ",
    questionPlaceholder: "Введите тактический запрос...",
    attach: "СКАНИРОВАТЬ ЭКРАН", getBriefing: "ПОЛУЧИТЬ БРИФИНГ", transmitting: "ПЕРЕДАЧА...",
    intelReport: "ОПЕРАТИВНАЯ СВОДКА", copyBriefing: "КОПИРОВАТЬ", copied: "СКОПИРОВАНО",
    editProfile: "ПРОФИЛЬ", commander: "БОЕВОЙ СТАТУС", server: "СЕРВЕР",
    furnaceLevel: "УРОВЕНЬ ПЕЧИ", droneLevel: "УРОВЕНЬ ДРОНА", squads: "ОТРЯДЫ",
    sq1: "ОТР.1 ОСНОВНОЙ", sq2: "ОТР.2 ВТОРИЧНЫЙ", sq3: "ОТР.3 ПОДДЕРЖКА",
    polarStorm: "ПОЛЯРНЫЙ ШТОРМ", week: "НЕДЕЛЯ", autoLabel: "АВТО",
    refresh: "ОБНОВИТЬ", detecting: "ОПРЕДЕЛЯЮ...", weekNotFound: "Неделя не определена",
    missionHistory: "ИСТОРИЯ ОПЕРАЦИЙ", clearHistory: "ОЧИСТИТЬ ИСТОРИЮ",
    awaiting: "ОЖИДАНИЕ ЗАПРОСА БРИФИНГА", noHeroes: "Нет героев",
    transmissionFailed: "ОШИБКА ПЕРЕДАЧИ. ПОВТОРИТЕ МИССИЮ.",
    todaysBoss: "БОСС СЕГОДНЯ", bonusDay: "ВАШ БОНУСНЫЙ ДЕНЬ",
    noBossToday: "Сегодня нет Wanted Boss", notYourBonus: "не ваш бонус", dayWord: "день",
    digSiteWidget: "МЕСТО РАСКОПОК", target: "ЦЕЛЬ", digSites: "МЕСТА РАСКОПОК", weakToShort: "слаб к",
    warPhaseLabel: "ФАЗА ВОЙНЫ", nextWar: "СЛЕДУЮЩАЯ ВОЙНА", st: "CT", inTime: "через", serverNow: "СЕРВЕР",
    timezoneHint: "Установите часовой пояс сервера",
  },
  FR: {
    askAdvisor: "DEMANDE DE RENSEIGNEMENT",
    questionPlaceholder: "Entrez votre requête tactique...",
    attach: "SCANNER L'ÉCRAN", getBriefing: "OBTENIR LE BRIEFING", transmitting: "TRANSMISSION...",
    intelReport: "RAPPORT DE RENSEIGNEMENT", copyBriefing: "COPIER", copied: "COPIÉ",
    editProfile: "MODIFIER LE PROFIL", commander: "STATUT TERRAIN", server: "SERVEUR",
    furnaceLevel: "NIVEAU DU FOURNEAU", droneLevel: "NIVEAU DU DRONE", squads: "ESCOUADES",
    sq1: "ESC.1 PRINCIPALE", sq2: "ESC.2 SECONDAIRE", sq3: "ESC.3 SOUTIEN",
    polarStorm: "TEMPÊTE POLAIRE", week: "SEMAINE", autoLabel: "AUTO",
    refresh: "ACTUALISER", detecting: "DÉTECTION...", weekNotFound: "Semaine non détectée",
    missionHistory: "HISTORIQUE DES MISSIONS", clearHistory: "EFFACER L'HISTORIQUE",
    awaiting: "EN ATTENTE D'UN BRIEFING DE MISSION", noHeroes: "Aucun héros configuré",
    transmissionFailed: "ÉCHEC DE TRANSMISSION. RÉESSAYER.",
    todaysBoss: "BOSS DU JOUR", bonusDay: "VOTRE JOUR DE BONUS",
    noBossToday: "Pas de Wanted Boss aujourd'hui", notYourBonus: "pas votre bonus", dayWord: "jour",
    digSiteWidget: "CIBLE DE FOUILLE", target: "CIBLE", digSites: "SITES DE FOUILLE", weakToShort: "faible contre",
    warPhaseLabel: "PHASE DE GUERRE", nextWar: "PROCHAINE GUERRE", st: "HS", inTime: "dans", serverNow: "SERVEUR",
    timezoneHint: "Réglez le fuseau horaire de votre serveur",
  },
};

const QUICK_ACTIONS = {
  EN: [
    { label: "Daily Briefing",   Icon: Calendar,    question: "Give me a full daily briefing for today - boss, dig sites, priorities and what to focus on" },
    { label: "Attack Strategy",  Icon: Target,      question: "What is the best attack strategy for my squad today?" },
    { label: "Dig Sites",        Icon: Map,         question: "Which dig sites should I capture and how?" },
    { label: "Temperature",      Icon: Thermometer, question: "How do I manage my base temperature and avoid freezing?" },
    { label: "Hero Upgrade",     Icon: Star,        question: "Which hero should I upgrade next and how?" },
    { label: "War Phase",        Icon: Shield,      question: "Explain the War Phase and when I should attack the enemy furnace" },
    { label: "Compare Squads",   Icon: Zap,         question: "Compare my squad powers and recommend which squad to use for each situation - boss fights, dig sites, war phase attacks and defense." },
  ],
  RU: [
    { label: "Ежедневный брифинг", Icon: Calendar,    question: "Дай полный ежедневный брифинг на сегодня - босс, раскопки, приоритеты и на что сосредоточиться" },
    { label: "Стратегия атаки",    Icon: Target,      question: "Какова лучшая стратегия атаки для моего отряда сегодня?" },
    { label: "Места раскопок",     Icon: Map,         question: "Какие раскопки захватить и как?" },
    { label: "Температура",        Icon: Thermometer, question: "Как управлять температурой базы и не замёрзнуть?" },
    { label: "Прокачка героев",    Icon: Star,        question: "Какого героя прокачивать следующим и как?" },
    { label: "Военная фаза",       Icon: Shield,      question: "Объясни военную фазу и когда атаковать печь врага" },
    { label: "Сравнить отряды",    Icon: Zap,         question: "Сравни мои отряды и порекомендуй какой использовать для боссов, мест раскопок, атаки и защиты в войне." },
  ],
  FR: [
    { label: "Briefing Quotidien",   Icon: Calendar,    question: "Donne-moi un briefing complet pour aujourd'hui - boss, sites de fouille, priorites et objectifs du jour" },
    { label: "Strategie d'Attaque",  Icon: Target,      question: "Quelle est la meilleure strategie d'attaque pour mon escouade aujourd'hui?" },
    { label: "Sites de Fouille",     Icon: Map,         question: "Quels sites de fouille devrais-je capturer et comment?" },
    { label: "Temperature",          Icon: Thermometer, question: "Comment gerer la temperature de ma base et eviter le gel?" },
    { label: "Amelioration Heros",   Icon: Star,        question: "Quel heros devrais-je ameliorer en priorite et comment?" },
    { label: "Phase de Guerre",      Icon: Shield,      question: "Explique la Phase de Guerre et quand je dois attaquer le fourneau ennemi" },
    { label: "Comparer Escouades",   Icon: Zap,         question: "Compare mes puissances d'escouade et recommande laquelle utiliser pour chaque situation - combats de boss, sites de fouille, attaques et defense en phase de guerre." },
  ],
};

// ── Goal selector quick-picks (above textarea) ────────────────────
const GOAL_SELECTOR = {
  EN: [
    { label: "Who to upgrade next",   question: "Which hero should I prioritize upgrading next and why, based on my current roster?" },
    { label: "Is this worth spending", question: "Is it worth spending my resources right now, given my current furnace and drone level?" },
    { label: "Best team setup",        question: "What is the best team setup for my troop type right now?" },
    { label: "What to do today",       question: "What should I focus on doing today to maximize my progress in the current season week?" },
    { label: "Event advice",           question: "What events are available now and what is the best strategy to approach them?" },
    { label: "Compare options",        question: "I have multiple choices right now - compare them and tell me which is the best option for my profile." },
  ],
  RU: [
    { label: "Кого улучшить",         question: "Какого героя улучшить следующим и почему, исходя из моего текущего состава?" },
    { label: "Стоит ли тратить",       question: "Стоит ли тратить ресурсы прямо сейчас, учитывая мой уровень печи и дрона?" },
    { label: "Лучший состав",          question: "Каков лучший состав отряда для моего типа войск прямо сейчас?" },
    { label: "Что делать сегодня",     question: "На чём сосредоточиться сегодня, чтобы максимально продвинуться на текущей неделе сезона?" },
    { label: "Советы по событиям",     question: "Какие события доступны сейчас и какова лучшая стратегия для них?" },
    { label: "Сравнить варианты",      question: "У меня несколько вариантов - сравни их и скажи, какой лучший для моего профиля." },
  ],
  FR: [
    { label: "Qui ameliorer",          question: "Quel heros dois-je prioriser pour amelioration et pourquoi, selon mon effectif actuel?" },
    { label: "Ca vaut la depense?",    question: "Vaut-il la peine de depenser mes ressources maintenant, vu mon niveau de fourneau et de drone?" },
    { label: "Meilleure equipe",       question: "Quelle est la meilleure configuration d'equipe pour mon type de troupe en ce moment?" },
    { label: "Que faire aujourd'hui",  question: "Sur quoi me concentrer aujourd'hui pour maximiser ma progression dans la semaine de saison actuelle?" },
    { label: "Conseils evenements",    question: "Quels evenements sont disponibles maintenant et quelle est la meilleure strategie?" },
    { label: "Comparer les options",   question: "J'ai plusieurs choix - compare-les et dis-moi quelle est la meilleure option pour mon profil." },
  ],
};

// ── Game data ─────────────────────────────────────────────────────
const BOSS_SCHEDULE = {
  Monday:    { name: "Frenzied Butcher", type: "Tank"     },
  Tuesday:   { name: "Frankenstein",     type: "Missile"  },
  Wednesday: { name: "Mutant Bulldog",   type: "Aircraft" },
  Thursday:  { name: "Frenzied Butcher", type: "Tank"     },
  Friday:    { name: "Frankenstein",     type: "Missile"  },
  Saturday:  { name: "Mutant Bulldog",   type: "Aircraft" },
  Sunday:    null,
};

const DIG_SITE = {
  Tank:     { beast: "BEAR"    },
  Missile:  { beast: "GORILLA" },
  Aircraft: { beast: "MAMMOTH" },
};

const DAY_NAMES_RU = {
  Monday: "Понедельник", Tuesday: "Вторник",  Wednesday: "Среда",
  Thursday: "Четверг",   Friday: "Пятница",   Saturday: "Суббота", Sunday: "Воскресенье",
};

const DAY_NAMES_FR = {
  Monday: "Lundi", Tuesday: "Mardi",  Wednesday: "Mercredi",
  Thursday: "Jeudi", Friday: "Vendredi", Saturday: "Samedi", Sunday: "Dimanche",
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
        let w = img.width, h = img.height;
        if (w > MAX_IMG_WIDTH) { h = Math.round((h * MAX_IMG_WIDTH) / w); w = MAX_IMG_WIDTH; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        let quality = 0.85, dataUrl;
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
    3: "Choose faction (Rebels or Gendarmerie) - determines Rare Soil War opponents.",
    4: "Rare Soil War begins - upgrade Alliance Furnace, coordinate with alliance.",
    5: "Active war phase - attack/defense rotations.",
    6: "Push Faction Award points, defend Alliance Furnace.",
    7: "Faction Duel - 4v4 Capitol Conquest, final ranking.",
    8: "Season ends - Transfer Surge available based on rank.",
  },
  RU: {
    1: "Постройте завод Титанового сплава, улучшайте Печь, захватите первые Раскопки. Города 1 ур. открываются на 3-й день в 12:00.",
    2: "Расширяйте территорию, улучшайте Печь, стройте Военные базы.",
    3: "Выберите фракцию (Повстанцы или Жандармерия) - определяет противников в Войне за редкую почву.",
    4: "Война за редкую почву - улучшайте Альянсовую печь, координируйте союз.",
    5: "Активная фаза войны - ротации атаки и обороны.",
    6: "Копите очки наград фракции, защищайте Альянсовую печь.",
    7: "Дуэль фракций - 4 на 4, финальный рейтинг.",
    8: "Сезон заканчивается - доступен Surge перевода по рейтингу.",
  },
  FR: {
    1: "Construisez l'Usine d'Alliage de Titane, ameliorez le Fourneau, capturez votre premier Site de Fouille. Les villes niveau 1 s'ouvrent le Jour 3 a 12:00.",
    2: "Etendez votre territoire, ameliorez le Fourneau, construisez des Bases Militaires.",
    3: "Choisissez votre faction (Rebelles ou Gendarmerie) - determine vos adversaires dans la Guerre pour le Sol Rare.",
    4: "La Guerre pour le Sol Rare commence - ameliorez le Fourneau de l'Alliance, coordonnez votre alliance.",
    5: "Phase de guerre active - rotations attaque/defense.",
    6: "Accumulez des points de Recompense de Faction, defendez le Fourneau de l'Alliance.",
    7: "Duel de Factions - 4v4 Conquete du Capitole, classement final.",
    8: "La saison se termine - le Transfert en Surge est disponible selon votre rang.",
  },
};

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
    setDisplayed(""); setTyping(true);
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

// ── Dev-only logging flag ─────────────────────────────────────────
const isDev = process.env.NODE_ENV === "development";

// ── Markdown error boundary (catches ReactMarkdown render failures) ──
class MarkdownErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { if (isDev) console.error("[WAR ROOM] ReactMarkdown render error:", err.message); }
  render() {
    if (this.state.hasError) {
      return (
        <pre className="whitespace-pre-wrap font-report text-[#b3e5fc] text-sm leading-relaxed">
          {this.props.fallback}
        </pre>
      );
    }
    return this.props.children;
  }
}

// ── Intelligence Report ───────────────────────────────────────────
const IntelligenceReport = ({ text, isLatest = false, tr }) => {
  const { displayed, typing } = useTypewriter(isLatest ? text : null);
  const shownText = isLatest ? displayed : text;
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="intel-report p-5 relative" data-testid="intelligence-report">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#4fc3f7]/20">
        <Zap size={14} color="#4fc3f7" strokeWidth={1.5} />
        <span className="font-heading text-xs text-[#4fc3f7] tracking-[0.3em]">{tr.intelReport}</span>
        {typing && <div className="flex gap-1 mr-auto"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></div>}
        <button
          data-testid="copy-briefing-button"
          onClick={handleCopy} disabled={typing}
          className={`ml-auto btn-primary px-2 py-1 flex items-center gap-1.5 text-[10px] ${typing ? "opacity-30 cursor-not-allowed" : ""}`}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          <span>{copied ? tr.copied : tr.copyBriefing}</span>
        </button>
      </div>
      <div className="font-report text-[#b3e5fc] text-sm leading-relaxed">
        {typing ? (
          <>{shownText}<span className="typewriter-cursor" /></>
        ) : (
          <MarkdownErrorBoundary fallback={shownText}>
            <ReactMarkdown className="markdown-report" components={{
              h2: ({ children }) => <strong className="block text-[#4fc3f7] font-heading text-xs tracking-widest mt-3 mb-1">{children}</strong>,
              h3: ({ children }) => <strong className="block text-[#b3e5fc] font-heading text-xs tracking-widest mt-2 mb-1">{children}</strong>,
              strong: ({ children }) => <strong className="text-white">{children}</strong>,
              li: ({ children }) => <li className="ml-4 list-disc text-[#b3e5fc]">{children}</li>,
              p: ({ children }) => <p className="mb-2">{children}</p>,
            }}>{shownText}</ReactMarkdown>
          </MarkdownErrorBoundary>
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
    navigator.clipboard.writeText(item.response).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const timeStr = new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = new Date(item.ts).toLocaleDateString([], { month: "short", day: "numeric" });
  return (
    <div className="border border-[#37474f]/40 transition-all duration-200 hover:border-[#4fc3f7]/30" style={{ background: "rgba(10,14,26,0.7)" }} data-testid="history-item">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setExpanded((v) => !v)} className="flex-1 text-left flex items-start gap-2 min-w-0">
          <ChevronDown size={12} color="#37474f" className={`mt-0.5 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          <div className="min-w-0">
            <span className="font-heading text-[9px] text-[#37474f] tracking-widest block">{dateStr} {timeStr}</span>
            <span className="font-report text-xs text-[#b3e5fc]/70 line-clamp-1 block mt-0.5">{item.question}</span>
          </div>
        </button>
        <button data-testid="history-copy-button" onClick={handleCopy} className="flex-shrink-0 btn-primary px-2 py-1 flex items-center gap-1 text-[9px]">
          {copied ? <Check size={9} /> : <Copy size={9} />}<span>{copied ? "✓" : "COPY"}</span>
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#37474f]/30">
          <MarkdownErrorBoundary fallback={item.response}>
            <ReactMarkdown className="markdown-report" components={{
              h2: ({ children }) => <strong className="block text-[#4fc3f7] font-heading text-xs tracking-widest mt-2 mb-1">{children}</strong>,
              strong: ({ children }) => <strong className="text-white">{children}</strong>,
              li: ({ children }) => <li className="ml-3 list-disc text-[#b3e5fc]/80 text-xs">{children}</li>,
              p: ({ children }) => <p className="mb-1.5 text-xs text-[#b3e5fc]/80">{children}</p>,
            }}>{item.response}</ReactMarkdown>
          </MarkdownErrorBoundary>
        </div>
      )}
    </div>
  );
};

// ── Today's Boss Widget ───────────────────────────────────────────
const TodaysBossWidget = ({ troopType, tr }) => {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const boss = BOSS_SCHEDULE[today];
  const isBonus = boss && boss.type === troopType;
  return (
    <div data-testid="todays-boss-widget">
      <div className="flex items-center gap-1.5 mb-2">
        <Target size={10} color="#4fc3f7" strokeWidth={1.5} />
        <span className="font-heading text-[9px] text-[#4fc3f7] tracking-[0.3em]">{tr.todaysBoss}</span>
      </div>
      {!boss ? (
        <p className="font-heading text-[9px] text-[#37474f] tracking-wide">{tr.noBossToday}</p>
      ) : (
        <div
          className={`p-2 border widget-ice-hover ${isBonus ? "border-[#4fc3f7]/50" : "border-[#b8d4e8]/25"}`}
          style={{ background: isBonus ? "rgba(79,195,247,0.08)" : "rgba(184,212,232,0.04)" }}
        >
          <p className={`font-heading text-[10px] tracking-widest mb-0.5 ${isBonus ? "text-[#4fc3f7]" : "text-[#b8d4e8]"}`}>
            ⚔️ {boss.name.toUpperCase()}
          </p>
          {isBonus ? (
            <p className="font-heading text-[9px] text-[#4fc3f7]">- {tr.bonusDay}! +50% {troopType}</p>
          ) : (
            <p className="font-heading text-[9px] text-[#b8d4e8]/70">- {boss.type} {tr.dayWord} ({tr.notYourBonus})</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Dig Site Widget ───────────────────────────────────────────────
const DigSiteWidget = ({ troopType, tr }) => {
  const site = DIG_SITE[troopType] || DIG_SITE.Tank;
  return (
    <div data-testid="dig-site-widget">
      <div className="flex items-center gap-1.5 mb-2">
        <Map size={10} color="#4fc3f7" strokeWidth={1.5} />
        <span className="font-heading text-[9px] text-[#4fc3f7] tracking-[0.3em]">{tr.digSiteWidget}</span>
      </div>
      <div className="p-2 border border-[#b8d4e8]/30 widget-ice-hover" style={{ background: "rgba(184,212,232,0.06)" }}>
        <p className="font-heading text-[10px] text-[#e8f4f8] tracking-widest mb-0.5">🏔️ {tr.target}: {site.beast}</p>
        <p className="font-heading text-[9px] text-[#b8d4e8]/70">{tr.digSites} ({tr.weakToShort} {troopType})</p>
      </div>
    </div>
  );
};

// ── Season Tracker ────────────────────────────────────────────────
const POST_SEASON_LABEL = { EN: "POST-SEASON", RU: "ПОСТ-СЕЗОН", FR: "HORS-SAISON" };

const SeasonTracker = ({ seasonWeek, isDetecting, onRefresh, tr, language }) => {
  const schedule    = WEEKLY_SCHEDULE[language] || WEEKLY_SCHEDULE.EN;
  const isPostSeason = seasonWeek > 8;
  const priority    = !isPostSeason && seasonWeek ? schedule[seasonWeek] : null;
  const barWidth    = seasonWeek ? Math.min((seasonWeek / 8) * 100, 100) : 0;
  return (
    <div className="mx-0 border-t border-[#4fc3f7]/20 px-4 py-3" style={{ background: "rgba(79,195,247,0.04)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Calendar size={10} color="#4fc3f7" strokeWidth={1.5} />
          <span className="font-heading text-[9px] text-[#4fc3f7] tracking-[0.3em]">{tr.polarStorm} ❄️</span>
        </div>
        <button
          data-testid="season-week-refresh-btn"
          onClick={onRefresh} disabled={isDetecting}
          className="flex items-center gap-1 font-heading text-[8px] text-[#37474f] tracking-widest hover:text-[#4fc3f7] transition-colors disabled:opacity-40"
        >
          <RefreshCw size={8} className={isDetecting ? "animate-spin" : ""} />
          {tr.refresh}
        </button>
      </div>
      {isDetecting ? (
        <div className="flex items-center gap-2 py-1">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          <span className="font-heading text-[9px] text-[#37474f]">{tr.detecting}</span>
        </div>
      ) : seasonWeek ? (
        <div className="border-l-2 border-[#4fc3f7] pl-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-heading text-[9px] text-[#37474f] tracking-widest">{tr.week}</span>
            <span className="font-heading text-[8px] text-[#4fc3f7]/50 tracking-widest">{tr.autoLabel}</span>
          </div>
          <div className="font-heading text-5xl text-white leading-none mb-2" style={{ textShadow: "0 0 20px rgba(79,195,247,0.65)" }} data-testid="season-week-display">
            {isPostSeason ? (
              <span className="text-2xl text-[#4fc3f7]">{POST_SEASON_LABEL[language] || POST_SEASON_LABEL.EN}</span>
            ) : (
              <>{seasonWeek}<span className="text-sm text-[#37474f] ml-1">/8</span></>
            )}
          </div>
          <div className="h-2 bg-[#37474f]/30 mb-3 overflow-hidden">
            <div className="h-full bg-[#4fc3f7] transition-all" style={{ width: `${barWidth}%` }} />
          </div>
          {priority && <p className="font-report text-[11px] text-[#b3e5fc] leading-relaxed">{priority}</p>}
        </div>
      ) : (
        <p className="font-heading text-[9px] text-[#37474f]">{tr.weekNotFound}</p>
      )}
    </div>
  );
};

// ── War Phase Countdown (UTC-3 fixed) ─────────────────────────────
const WarCountdownWidget = ({ tr, language }) => {
  const serverTimeStr  = getServerTime();
  const { dayName, countdown } = getWarCountdown();
  const displayDay     = language === "RU" ? (DAY_NAMES_RU[dayName] || dayName) : language === "FR" ? (DAY_NAMES_FR[dayName] || dayName) : dayName;

  return (
    <div
      className="mx-0 border-t border-[#ff6f00]/20 px-4 py-3"
      style={{ background: "rgba(255,111,0,0.03)" }}
      data-testid="war-countdown-widget"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Shield size={10} color="#ff6f00" strokeWidth={1.5} />
          <span className="font-heading text-[9px] text-[#ff6f00] tracking-[0.3em]">{tr.warPhaseLabel}</span>
        </div>
        <span className="font-heading text-[8px] text-[#ff6f00]/50 tracking-widest" data-testid="server-time-display">
          {tr.serverNow}: {serverTimeStr}
        </span>
      </div>
      <div className="border border-[#ff6f00]/30 p-2" style={{ background: "rgba(255,111,0,0.06)" }}>
        <p className="font-heading text-[9px] text-[#ff6f00]/70 tracking-widest mb-1">
          {tr.nextWar}: {displayDay} 12:00 {tr.st}
        </p>
        <p
          className="font-heading text-xl text-white leading-none"
          style={{ textShadow: "0 0 12px rgba(255,111,0,0.5)" }}
          data-testid="war-countdown-display"
        >
          {tr.inTime} {countdown}
        </p>
      </div>
    </div>
  );
};

// ── Top Bar ───────────────────────────────────────────────────────
const TopBar = ({ profile, onEditProfile, onTogglePanel, tr }) => (
  <div
    className="flex items-center justify-between px-4 py-3 border-b border-[#4fc3f7]/20"
    style={{ background: "rgba(10,14,26,0.95)" }}
  >
    <div className="flex items-center gap-3">
      <button data-testid="panel-toggle-button" onClick={onTogglePanel} className="btn-primary p-1.5 md:hidden" aria-label="Toggle profile panel">
        <Menu size={16} />
      </button>
      <div className="flex items-center gap-2">
        <img
          src="https://www.lastwar.com/en/img/logo.png"
          alt="Last War"
          style={{ height: "28px" }}
          className="object-contain"
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <span className="font-heading text-xl text-white tracking-[0.2em]" style={{ textShadow: "0 0 15px rgba(79,195,247,0.5)" }}>
          WAR ROOM
        </span>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center px-2 py-1 border border-[#4fc3f7]/30" style={{ background: "rgba(79,195,247,0.06)" }}>
        <span className="font-heading text-[10px] text-[#b3e5fc] tracking-widest">S-{profile.server}</span>
      </div>

      <button data-testid="edit-profile-link" onClick={onEditProfile} className="font-heading text-[10px] text-[#37474f] tracking-widest hover:text-[#4fc3f7] transition-colors">
        {tr.editProfile}
      </button>
    </div>
  </div>
);

// ── Profile Panel Content ─────────────────────────────────────────
const ProfilePanelContent = ({
  profile, troopType, onClose, isMobile,
  isDetecting, onRefreshWeek, tr, language,
}) => {
  const squadDefs = [
    { label: tr.sq1, indices: [0, 1, 2, 3, 4], powerIdx: 0 },
    { label: tr.sq2, indices: [5, 6, 7, 8, 9],  powerIdx: 1 },
    { label: tr.sq3, indices: [10, 11, 12, 13, 14], powerIdx: 2 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#4fc3f7]/20">
        <div className="flex items-center gap-1.5">
          <User size={12} color="#4fc3f7" strokeWidth={1.5} />
          <span className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.3em]">{tr.commander}</span>
        </div>
        {isMobile && (
          <button className="text-[#37474f] hover:text-[#4fc3f7] transition-colors" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Scrollable section */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Server */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">{tr.server}</p>
          <p className="font-heading text-lg text-white">#{profile.server}</p>
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

        {/* Drone level */}
        {profile.droneLevel != null && (
          <>
            <div>
              <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1" data-testid="sidebar-drone-label">{tr.droneLevel}</p>
              <span className="font-heading text-sm text-white" data-testid="sidebar-drone-value">{profile.droneLevel}</span>
            </div>
            <div className="h-px bg-[#37474f]/40" />
          </>
        )}

        {/* Hero squads with power */}
        <div>
          <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-2">{tr.squads}</p>
          {squadDefs.map(({ label, indices, powerIdx }) => {
            const active = indices.map((i) => profile.heroes?.[i]).filter((h) => h && h !== "None");
            if (active.length === 0) return null;
            const power = profile.squadPowers?.[powerIdx];
            const displayLabel = power ? `${label} - ${power}M` : label;
            return (
              <div key={label} className="mb-2">
                <p className="font-heading text-[8px] text-[#4fc3f7]/60 tracking-[0.2em] mb-1">{displayLabel}</p>
                <div className="space-y-1">
                  {active.map((hero, i) => {
                    const m = hero.match(/^(.+?) \((\d)★\)$/);
                    const name = m ? m[1] : hero, stars = m ? parseInt(m[2]) : 0;
                    return (
                      <div key={name} className="flex items-center gap-1.5">
                        <span className="font-heading text-xs text-[#b3e5fc]">{name}</span>
                        {stars > 0 && (
                          <span className="text-xs leading-none">
                            {[1,2,3,4,5].map((s) => <span key={s} style={{ color: s <= stars ? "#f59e0b" : "#37474f" }}>★</span>)}
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
        <div className="h-px bg-[#37474f]/40" />

        {/* TODAY'S BOSS — uses inferred troopType, not profile.troopType */}
        <TodaysBossWidget troopType={troopType} tr={tr} />
        <div className="h-px bg-[#37474f]/40" />

        {/* DIG SITE TARGET — uses inferred troopType */}
        <DigSiteWidget troopType={troopType} tr={tr} />
      </div>

      {/* Pinned: Season Week */}
      <SeasonTracker seasonWeek={profile.seasonWeek} isDetecting={isDetecting} onRefresh={onRefreshWeek} tr={tr} language={language} />

      {/* Pinned: War Countdown */}
      <WarCountdownWidget tr={tr} language={language} />
    </div>
  );
};

// ── Profile Panel ─────────────────────────────────────────────────
const ProfilePanel = ({ profile, troopType, isOpen, onClose, isDetecting, onRefreshWeek, tr, language }) => (
  <>
    {isOpen && (
      <div className="md:hidden fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div data-testid="profile-panel-mobile" className="absolute left-0 top-0 bottom-0 w-72 flex flex-col"
          style={{ background: "rgba(8,12,22,0.98)", borderRight: "1px solid rgba(79,195,247,0.35)", boxShadow: "4px 0 20px rgba(0,0,0,0.5)", animation: "slideInLeft 0.25s ease" }}>
          <ProfilePanelContent profile={profile} troopType={troopType} onClose={onClose} isMobile
            isDetecting={isDetecting} onRefreshWeek={onRefreshWeek} tr={tr} language={language} />
        </div>
      </div>
    )}
    <div data-testid="profile-panel" className="hidden md:flex flex-col w-52 flex-shrink-0"
      style={{ background: "rgba(8,12,22,0.95)", borderRight: "1px solid rgba(79,195,247,0.3)", boxShadow: "2px 0 12px rgba(79,195,247,0.08)" }}>
      <ProfilePanelContent profile={profile} troopType={troopType} onClose={onClose} isMobile={false}
        isDetecting={isDetecting} onRefreshWeek={onRefreshWeek} tr={tr} language={language} />
    </div>
  </>
);

// ── Main WarRoom ──────────────────────────────────────────────────
const WarRoom = ({ profile, onEditProfile }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem(LANG_KEY) || "EN");
  const tr           = TRANSLATIONS[language] || TRANSLATIONS.EN;
  const quickActions = QUICK_ACTIONS[language] || QUICK_ACTIONS.EN;

  const [localProfile, setLocalProfile] = useState(profile);

  // Single source of truth: troop type inferred from Squad 1 heroes — never read from profile field
  const inferredTroopType = inferTroopType(localProfile?.heroes || []);

  const [question,      setQuestion]      = useState("");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview,  setImagePreview]  = useState(null);
  const [response,      setResponse]      = useState("");
  const [isLoading,     setIsLoading]     = useState(false);
  const [panelOpen,     setPanelOpen]     = useState(false);
  const [error,         setError]         = useState("");
  const [history,       setHistory]       = useState(loadHistory);
  const [showHistory,   setShowHistory]   = useState(false);
  const [detectingWeek, setDetectingWeek] = useState(false);
  const reportRef          = useRef(null);
  const fileInputRef       = useRef(null);
  const isMounted          = useRef(true);
  const weekDetectionRan   = useRef(false);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const detectSeasonWeek = useCallback(async () => {
    if (!localProfile?.server) return;
    setDetectingWeek(true);
    try {
      const res  = await fetch(`${SERVER_WEEK_URL}?server=${localProfile.server}`);
      const data = await res.json();
      if (data.week != null && data.week > 0) {
        setLocalProfile((prev) => {
          const updated = { ...prev, seasonWeek: data.week, currentSeason: data.season };
          localStorage.setItem("warroom_profile", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      if (isDev) console.warn("[WAR ROOM] Season week detection failed:", e.message);
    } finally {
      setDetectingWeek(false);
    }
  }, [localProfile?.server]);

  useEffect(() => {
    if (weekDetectionRan.current) return;
    weekDetectionRan.current = true;
    const effectiveWeek = localProfile?.seasonWeek || getSeasonWeekFromDate(localProfile?.seasonStartDate);
    if (!effectiveWeek) detectSeasonWeek();
  }, [localProfile?.seasonWeek, localProfile?.seasonStartDate, detectSeasonWeek]);

  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { base64, dataUrl } = await compressImage(file);
    setUploadedImage(base64); setImagePreview(dataUrl);
  }, []);

  const clearImage = () => {
    setUploadedImage(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (overrideQ) => {
    const q = typeof overrideQ === "string" ? overrideQ.trim() : question.trim();
    if (!q || isLoading) return;
    if (isMounted.current) { setError(""); setIsLoading(true); }
    let rawResponse = null;
    try {
      const effectiveWeek = localProfile.seasonWeek || getSeasonWeekFromDate(localProfile?.seasonStartDate);
      const payload = {
        question: q,
        server: String(localProfile.server),
        troop_type: inferredTroopType,
        furnace_level: Number(localProfile.furnaceLevel),
        drone_level: localProfile.droneLevel || null,
        hq_level: localProfile.hqLevel || null,
        virus_resistance: localProfile.virusResistance || null,
        squad_types: localProfile.squadTypes || [null, null, null],
        heroes: localProfile.heroes,
        squad_powers: localProfile.squadPowers || [],
        season_week: effectiveWeek,
        language,
        ...(uploadedImage ? { image_base64: uploadedImage } : {}),
      };
      const res = await axios.post(BRIEF_URL, payload);
      if (isDev) console.log("[WAR ROOM] Raw response data:", JSON.stringify(res.data).slice(0, 200));
      rawResponse = res.data?.response ?? "";
      if (isDev) console.log("[WAR ROOM] Response text length:", rawResponse.length, "chars");
      if (isDev && !rawResponse) console.warn("[WAR ROOM] Response is empty - res.data:", res.data);
      if (isMounted.current) {
        const newHistory = saveToHistory(q, rawResponse);
        setHistory(newHistory);
        setQuestion("");
        clearImage();
        setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch (err) {
      if (isDev) console.error("[WAR ROOM] handleSubmit error:", err);
      if (isMounted.current) setError(err.response?.data?.detail || tr.transmissionFailed);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        if (rawResponse !== null) setResponse(rawResponse);
      }
    }
  };

  const handleQuickAction = (q) => { setQuestion(q); handleSubmit(q); };
  const handleKeyDown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(); };

  return (
    <div className="war-noise min-h-screen bg-[#0a0e1a] flex flex-col relative overflow-hidden" data-testid="warroom-screen">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(79,195,247,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(79,195,247,0.025) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <TopBar profile={localProfile} onEditProfile={onEditProfile} onTogglePanel={() => setPanelOpen((v) => !v)} tr={tr} />

      <div className="flex flex-1 overflow-hidden relative z-10">
        <ProfilePanel
          profile={localProfile}
          troopType={inferredTroopType}
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          isDetecting={detectingWeek}
          onRefreshWeek={detectSeasonWeek}
          tr={tr}
          language={language}
        />

        <div className="flex-1 flex flex-col overflow-y-auto p-4 pb-16 gap-4">
          {/* Input section */}
          <div className="hud-panel p-4 relative" data-testid="intelligence-request-card">
            <div className="scan-line-card" />
            {/* HUD corner brackets — all 4 explicit, consistent 12px × 2px cyan */}
            <div className="absolute top-0 left-0 w-3 h-3 pointer-events-none" style={{ borderTop: "2px solid #4fc3f7", borderLeft: "2px solid #4fc3f7", zIndex: 3 }} />
            <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none" style={{ borderTop: "2px solid #4fc3f7", borderRight: "2px solid #4fc3f7", zIndex: 3 }} />
            <div className="absolute bottom-0 left-0 w-3 h-3 pointer-events-none" style={{ borderBottom: "2px solid #4fc3f7", borderLeft: "2px solid #4fc3f7", zIndex: 3 }} />
            <div className="absolute bottom-0 right-0 w-3 h-3 pointer-events-none" style={{ borderBottom: "2px solid #4fc3f7", borderRight: "2px solid #4fc3f7", zIndex: 3 }} />
            <div className="flex items-center gap-2 mb-3">
              <Zap size={12} color="#4fc3f7" strokeWidth={1.5} />
              <label className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.3em]">{tr.askAdvisor}</label>
            </div>

            {/* Goal selector — horizontal scroll strip */}
            {!isLoading && (() => {
              const goals = GOAL_SELECTOR[language] || GOAL_SELECTOR.EN;
              return (
                <div
                  className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1"
                  data-testid="goal-selector-row"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {goals.map(({ label, question: gq }) => (
                    <button
                      key={label}
                      type="button"
                      data-testid={`goal-${label.toLowerCase().replace(/[\s'?]+/g, "-")}`}
                      onClick={() => handleQuickAction(gq)}
                      className="flex-shrink-0 px-3 py-1.5 font-heading text-[9px] tracking-[0.12em] border border-[#4fc3f7]/25 hover:border-[#4fc3f7]/60 hover:text-[#4fc3f7] transition-all duration-150 whitespace-nowrap"
                      style={{
                        background: "rgba(79,195,247,0.05)",
                        color: "#6b8fa3",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              );
            })()}

            {imagePreview && (
              <div className="relative mb-3 border border-[#4fc3f7]/30 inline-block">
                <img src={imagePreview} alt="Attachment" className="h-16 object-cover" />
                <button onClick={clearImage} className="absolute -top-2 -right-2 w-5 h-5 bg-[#ff6f00] text-white flex items-center justify-center text-xs"><X size={10} /></button>
              </div>
            )}

            <textarea
              data-testid="ask-advisor-input"
              value={question} onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown} placeholder={tr.questionPlaceholder}
              rows={3} className="war-input w-full px-3 py-2.5 text-sm resize-none"
            />

            {error && <p className="text-[#ff6f00] text-xs font-heading tracking-widest mt-2">⚠ {error}</p>}

            <div className="flex gap-2 mt-3">
              <input ref={fileInputRef} data-testid="image-upload-input" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="image-upload" />
              <label htmlFor="image-upload" data-testid="image-upload-btn" className="btn-primary px-3 py-2.5 flex items-center gap-1.5 cursor-pointer text-xs">
                <Camera size={14} strokeWidth={1.5} />
                <span className="hidden sm:inline">{tr.attach}</span>
              </label>
              <button
                data-testid="get-briefing-button"
                onClick={handleSubmit} disabled={!question.trim() || isLoading}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2 text-xs"
              >
                {isLoading ? (
                  <><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /><span className="font-heading tracking-[0.2em] ml-1">{tr.transmitting}</span></>
                ) : (
                  <><Send size={13} strokeWidth={1.5} /><span className="font-heading tracking-[0.2em]">{tr.getBriefing}</span></>
                )}
              </button>
            </div>
          </div>

          {response && <div ref={reportRef}><IntelligenceReport text={response} isLatest tr={tr} /></div>}

          {/* Quick actions — always visible, below the report (hidden only while loading) */}
          {!isLoading && (() => {
            const [primary, ...rest] = quickActions;
            const PrimaryIcon = primary.Icon;
            return (
              <div className="space-y-1.5" data-testid="quick-actions-grid">
                <button
                  data-testid={`quick-action-${primary.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => handleQuickAction(primary.question)}
                  className="quick-action-btn-primary w-full flex items-center gap-2.5 px-4 text-left"
                  style={{ minHeight: "48px" }}
                >
                  <PrimaryIcon size={16} strokeWidth={1.5} className="flex-shrink-0 text-[#4fc3f7]" />
                  <span className="font-heading text-[13px] tracking-[0.2em] text-[#4fc3f7] leading-tight">
                    {primary.label.toUpperCase()}
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  {rest.map(({ label, Icon, question: q }) => (
                    <button
                      key={label}
                      data-testid={`quick-action-${label.toLowerCase().replace(/\s+/g, "-")}`}
                      onClick={() => handleQuickAction(q)}
                      className="quick-action-btn flex items-center gap-2 px-3 text-left transition-all duration-150"
                      style={{ minHeight: "48px" }}
                    >
                      <Icon size={13} strokeWidth={1.5} className="flex-shrink-0 text-[#4fc3f7]" />
                      <span className="font-heading text-[11px] tracking-[0.12em] text-[#b0bec5] leading-tight">
                        {label.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {history.length > 0 && (
            <div className="mt-2">
              <button data-testid="history-toggle-button" onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-2 w-full py-2 px-3 border border-[#37474f]/30 hover:border-[#4fc3f7]/30 transition-colors"
                style={{ background: "rgba(10,14,26,0.5)" }}>
                <Clock size={11} color="#37474f" strokeWidth={1.5} />
                <span className="font-heading text-[10px] text-[#37474f] tracking-[0.25em] flex-1 text-left">{tr.missionHistory} ({history.length})</span>
                <ChevronDown size={12} color="#37474f" className={`transition-transform duration-200 ${showHistory ? "rotate-180" : ""}`} />
              </button>
              {showHistory && (
                <div className="space-y-1 mt-1">
                  {history.map((item) => <HistoryItem key={item.id} item={item} />)}
                  <button data-testid="clear-history-button"
                    onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); setShowHistory(false); }}
                    className="w-full mt-2 py-2 px-3 font-heading text-[9px] tracking-[0.25em] text-[#37474f] border border-[#37474f]/20 hover:text-[#ff6f00] hover:border-[#ff6f00]/30 transition-colors"
                    style={{ background: "rgba(10,14,26,0.3)" }}>
                    {tr.clearHistory}
                  </button>
                </div>
              )}
            </div>
          )}

          {!response && (
            <div className="flex flex-col items-center justify-center flex-1 py-12 opacity-20">
              <Zap size={40} color="#4fc3f7" strokeWidth={0.8} className="mb-3" />
              <p className="font-heading text-xs text-[#4fc3f7] tracking-[0.3em] text-center">{tr.awaiting}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WarRoom;
