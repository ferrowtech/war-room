import React, { useState, useEffect, useCallback } from "react";
import { CheckSquare, Square, RefreshCw, Zap, Calendar } from "lucide-react";

// ── Server date helper (UTC-2) ────────────────────────────────────
const SERVER_UTC_OFFSET = -2;

const getServerDate = () => {
  const d = new Date(Date.now() + SERVER_UTC_OFFSET * 3600000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

const getServerDayOfWeek = () => {
  const d = new Date(Date.now() + SERVER_UTC_OFFSET * 3600000);
  return d.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
};

// ── Task definitions ──────────────────────────────────────────────
const DAILY_TASKS = {
  EN: [
    { id: "wanted_monster",  label: "Attack Wanted Monster",            note: "max 3 attacks for rewards" },
    { id: "doom_walker",     label: "Kill Doom Walker",                 note: "highest level available" },
    { id: "arms_race",       label: "Complete Arms Race tasks",         note: "" },
    { id: "tavern",          label: "Claim free hero recruitment",      note: "Tavern" },
    { id: "trucks",          label: "Send all trucks",                  note: "" },
    { id: "stamina",         label: "Use all Stamina",                  note: "" },
    { id: "likes",           label: "Give 10 likes on bases",           note: "" },
    { id: "collect",         label: "Collect from resource buildings",  note: "" },
    { id: "alliance_helps",  label: "Claim alliance helps",             note: "" },
    { id: "dig_site",        label: "Attack Dig Site beast",            note: "your troop type" },
  ],
  RU: [
    { id: "wanted_monster",  label: "Атаковать Разыскиваемого монстра", note: "макс. 3 атаки для наград" },
    { id: "doom_walker",     label: "Убить Скитальца судьбы",           note: "самый высокий уровень" },
    { id: "arms_race",       label: "Выполнить задания Гонки вооружений", note: "" },
    { id: "tavern",          label: "Забрать бесплатный найм героя",    note: "Таверна" },
    { id: "trucks",          label: "Отправить все грузовики",          note: "" },
    { id: "stamina",         label: "Использовать всю Выносливость",    note: "" },
    { id: "likes",           label: "Поставить 10 лайков базам",        note: "" },
    { id: "collect",         label: "Собрать с ресурсных зданий",       note: "" },
    { id: "alliance_helps",  label: "Забрать помощи альянса",           note: "" },
    { id: "dig_site",        label: "Атаковать зверя Места раскопок",   note: "ваш тип войск" },
  ],
  FR: [
    { id: "wanted_monster",  label: "Attaquer le Monstre recherche",    note: "max 3 attaques pour les recompenses" },
    { id: "doom_walker",     label: "Tuer le Marcheur Maudit",          note: "niveau le plus eleve dispo" },
    { id: "arms_race",       label: "Completer les taches Course aux armements", note: "" },
    { id: "tavern",          label: "Reclamer recrutement gratuit",     note: "Taverne" },
    { id: "trucks",          label: "Envoyer tous les camions",         note: "" },
    { id: "stamina",         label: "Utiliser toute l'Endurance",       note: "" },
    { id: "likes",           label: "Donner 10 likes sur les bases",    note: "" },
    { id: "collect",         label: "Collecter des batiments",          note: "" },
    { id: "alliance_helps",  label: "Reclamer les aides d'alliance",    note: "" },
    { id: "dig_site",        label: "Attaquer la bete du Site de Fouille", note: "votre type de troupe" },
  ],
};

// weekly tasks per day of week (0=Sun...6=Sat)
const WEEKLY_TASKS = {
  EN: {
    0: [{ id: "sunday_prep",    label: "No Wanted Monster today",           note: "prep for Monday", critical: false }],
    1: [{ id: "monday_drone",   label: "Drone Parts day",                   note: "complete drone tasks in Alliance Duel", critical: false }],
    2: [{ id: "tuesday_boss",   label: "Missile boss day - Frankenstein",   note: "attack for rewards", critical: false }],
    3: [{ id: "wed_valor",      label: "Valor Badge day",                   note: "claim from Alliance Duel - NEVER skip", critical: true }],
    4: [{ id: "thu_hero",       label: "Hero day",                          note: "spend Skill Medals and Hero Shards", critical: false }],
    5: [{ id: "fri_rewards",    label: "Biggest reward day",                note: "maximize Building + Research + Training", critical: false }],
    6: [{ id: "sat_pvp",        label: "PvP day + Aircraft boss (Mutant Bulldog)", note: "set shield or fight", critical: false }],
  },
  RU: {
    0: [{ id: "sunday_prep",    label: "Нет Разыскиваемого монстра",        note: "готовимся к понедельнику", critical: false }],
    1: [{ id: "monday_drone",   label: "День Запчастей дрона",              note: "выполнить задания в Дуэли альянса", critical: false }],
    2: [{ id: "tuesday_boss",   label: "Ракетный босс - Франкенштейн",      note: "атаковать для наград", critical: false }],
    3: [{ id: "wed_valor",      label: "День Знаков доблести",              note: "забрать из Дуэли альянса - НИКОГДА не пропускать", critical: true }],
    4: [{ id: "thu_hero",       label: "День героев",                       note: "тратить Медали навыков и Осколки героев", critical: false }],
    5: [{ id: "fri_rewards",    label: "День максимальных наград",          note: "макс. Строительство + Исследование + Тренировка", critical: false }],
    6: [{ id: "sat_pvp",        label: "PvP + Авиационный босс (Бульдог)",  note: "поставить щит или воевать", critical: false }],
  },
  FR: {
    0: [{ id: "sunday_prep",    label: "Pas de Monstre recherche aujourd'hui", note: "preparez-vous pour lundi", critical: false }],
    1: [{ id: "monday_drone",   label: "Journee Pieces de Drone",           note: "completer les taches dans le Duel d'alliance", critical: false }],
    2: [{ id: "tuesday_boss",   label: "Journee Boss Missile - Frankenstein", note: "attaquer pour les recompenses", critical: false }],
    3: [{ id: "wed_valor",      label: "Journee Badge de Valeur",           note: "reclamer dans le Duel d'alliance - NE JAMAIS sauter", critical: true }],
    4: [{ id: "thu_hero",       label: "Journee des Heros",                 note: "depenser Medailles et Eclats de heros", critical: false }],
    5: [{ id: "fri_rewards",    label: "Journee des plus grandes recompenses", note: "maximiser Construction + Recherche + Entrainement", critical: false }],
    6: [{ id: "sat_pvp",        label: "Journee PvP + Boss Aviation (Bulldog Mutant)", note: "mettre un bouclier ou combattre", critical: false }],
  },
};

const DAY_NAMES = {
  EN: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
  RU: ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"],
  FR: ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"],
};

const UI = {
  EN: { daily: "DAILY TASKS", today: "TODAY'S OPERATIONS", resetAt: "Resets at midnight server time", done: "done", clearAll: "CLEAR ALL", progress: (n, t) => `${n}/${t} COMPLETE` },
  RU: { daily: "ЕЖЕДНЕВНЫЕ ЗАДАЧИ", today: "ОПЕРАЦИИ СЕГОДНЯ", resetAt: "Сбрасывается в полночь по серверному времени", done: "выполнено", clearAll: "СБРОСИТЬ ВСЕ", progress: (n, t) => `${n}/${t} ВЫПОЛНЕНО` },
  FR: { daily: "TACHES QUOTIDIENNES", today: "OPERATIONS DU JOUR", resetAt: "Reinitialise a minuit heure serveur", done: "complete", clearAll: "TOUT EFFACER", progress: (n, t) => `${n}/${t} COMPLETE` },
};

const STORAGE_KEY = "warroom_checklist";

// ── Helper: load / save checked set ──────────────────────────────
const loadChecklist = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: null, checked: {} };
    return JSON.parse(raw);
  } catch { return { date: null, checked: {} }; }
};

const saveChecklist = (date, checked) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, checked }));
};

// ── Task row ──────────────────────────────────────────────────────
const TaskRow = ({ task, checked, onToggle }) => (
  <button
    type="button"
    data-testid={`checklist-task-${task.id}`}
    onClick={() => onToggle(task.id)}
    className="w-full flex items-start gap-3 py-2.5 px-3 text-left transition-all duration-150 hover:bg-[#4fc3f7]/5 group"
    style={{ borderBottom: "1px solid rgba(55,71,79,0.3)" }}
  >
    <div className="flex-shrink-0 mt-0.5">
      {checked
        ? <CheckSquare size={16} color="#4fc3f7" strokeWidth={1.5} />
        : <Square      size={16} color={task.critical ? "#ff6f00" : "#37474f"} strokeWidth={1.5} className="group-hover:text-[#4fc3f7]" />
      }
    </div>
    <div className="flex-1 min-w-0">
      <span
        className="font-report text-sm leading-snug block"
        style={{ color: checked ? "#37474f" : task.critical ? "#ff9800" : "#b3e5fc", textDecoration: checked ? "line-through" : "none" }}
      >
        {task.label}
      </span>
      {task.note && !checked && (
        <span className="font-heading text-[9px] tracking-widest" style={{ color: task.critical ? "#ff6f00" : "#546e7a" }}>
          {task.note}
        </span>
      )}
    </div>
  </button>
);

// ── Progress bar ─────────────────────────────────────────────────
const ProgressBar = ({ done, total, label }) => (
  <div className="px-4 py-2">
    <div className="flex justify-between items-center mb-1">
      <span className="font-heading text-[9px] text-[#37474f] tracking-widest">{label}</span>
      <span className="font-heading text-[9px] text-[#4fc3f7] tracking-widest">{done}/{total}</span>
    </div>
    <div className="h-1 bg-[#37474f]/30">
      <div
        className="h-full bg-[#4fc3f7] transition-all duration-300"
        style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
      />
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────
const DailyChecklist = ({ language = "EN" }) => {
  const lang = ["EN","RU","FR"].includes(language) ? language : "EN";
  const t    = UI[lang];

  const todayDow   = getServerDayOfWeek();
  const todayDate  = getServerDate();
  const dayName    = DAY_NAMES[lang][todayDow];

  const dailyTasks  = DAILY_TASKS[lang]  || DAILY_TASKS.EN;
  const weeklyToday = (WEEKLY_TASKS[lang] || WEEKLY_TASKS.EN)[todayDow] || [];

  // ── Checked state ───────────────────────────────────────────────
  const [checked, setChecked] = useState(() => {
    const stored = loadChecklist();
    if (stored.date !== todayDate) return {};
    return stored.checked || {};
  });

  // Auto-reset if server date changed (e.g. user kept app open overnight)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getServerDate();
      const stored  = loadChecklist();
      if (stored.date && stored.date !== current) {
        setChecked({});
        saveChecklist(current, {});
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, []);

  // Persist whenever checked changes
  useEffect(() => {
    saveChecklist(todayDate, checked);
  }, [checked, todayDate]);

  const toggle = useCallback((id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const clearAll = () => setChecked({});

  const allTasks    = [...dailyTasks, ...weeklyToday];
  const totalDone   = allTasks.filter((t) => checked[t.id]).length;
  const dailyDone   = dailyTasks.filter((t) => checked[t.id]).length;
  const weeklyDone  = weeklyToday.filter((t) => checked[t.id]).length;

  return (
    <div className="war-noise min-h-screen bg-[#0a0e1a] flex flex-col pb-16" data-testid="daily-checklist-screen">
      <div className="scan-line" />

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-[#4fc3f7]/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} color="#4fc3f7" strokeWidth={1.5} />
          <span className="font-heading text-sm text-[#4fc3f7] tracking-[0.3em]">DAILY OPS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-heading text-[10px] text-[#546e7a] tracking-widest">{dayName}</span>
          <button
            type="button"
            data-testid="checklist-clear-all"
            onClick={clearAll}
            className="flex items-center gap-1 font-heading text-[8px] text-[#37474f] tracking-widest hover:text-[#ff6f00] transition-colors"
          >
            <RefreshCw size={9} />
            {t.clearAll}
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <ProgressBar done={totalDone} total={allTasks.length} label={t.progress(totalDone, allTasks.length)} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 pb-4">

        {/* Daily tasks */}
        <div className="hud-panel overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#4fc3f7]/20" style={{ background: "rgba(79,195,247,0.04)" }}>
            <div className="flex items-center gap-1.5">
              <Zap size={10} color="#4fc3f7" strokeWidth={1.5} />
              <span className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.3em]">{t.daily}</span>
            </div>
            <span className="font-heading text-[9px] text-[#37474f] tracking-widest">{dailyDone}/{dailyTasks.length}</span>
          </div>
          {dailyTasks.map((task) => (
            <TaskRow key={task.id} task={task} checked={!!checked[task.id]} onToggle={toggle} />
          ))}
        </div>

        {/* Today's weekly tasks */}
        {weeklyToday.length > 0 && (
          <div className="hud-panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#4fc3f7]/20" style={{ background: "rgba(255,111,0,0.04)" }}>
              <div className="flex items-center gap-1.5">
                <Calendar size={10} color="#ff9800" strokeWidth={1.5} />
                <span className="font-heading text-[10px] text-[#ff9800] tracking-[0.3em]">{t.today}</span>
              </div>
              <span className="font-heading text-[9px] text-[#37474f] tracking-widest">{weeklyDone}/{weeklyToday.length}</span>
            </div>
            {weeklyToday.map((task) => (
              <TaskRow key={task.id} task={task} checked={!!checked[task.id]} onToggle={toggle} />
            ))}
          </div>
        )}

        {/* Reset note */}
        <p className="text-center font-heading text-[9px] text-[#37474f] tracking-widest pb-2">
          {t.resetAt} (UTC-2)
        </p>
      </div>
    </div>
  );
};

export default DailyChecklist;
