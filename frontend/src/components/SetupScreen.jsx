import React, { useState, useCallback } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ChevronDown } from "lucide-react";

const SERVER_WEEK_URL = `${process.env.REACT_APP_BACKEND_URL}/.netlify/functions/server-week`;

// ── Hero roster grouped by troop type ─────────────────────────────
const HEROES_BY_TYPE = [
  { type: "TANK",     list: ["Murphy", "Kimberly", "Marshall", "Williams", "Mason", "Violet", "Richard", "Monica", "Scarlett", "Stetmann"] },
  { type: "AIRCRAFT", list: ["DVA", "Carlie", "Schuyler", "Morrison", "Lucius", "Sarah", "Maxwell", "Cage"] },
  { type: "MISSILE",  list: ["Swift", "Tesla", "Fiona", "Adam", "Venom", "McGregor", "Elsa", "Kane"] },
];
const ALL_HEROES = HEROES_BY_TYPE.flatMap((g) => g.list);

export const SQUAD_CONFIG = [
  { en: "SQUAD 1 - PRIMARY",   ru: "ОТРЯД 1 - ОСНОВНОЙ",  fr: "ESCOUADE 1 - PRINCIPALE",  start: 0  },
  { en: "SQUAD 2 - SECONDARY", ru: "ОТРЯД 2 - ВТОРИЧНЫЙ", fr: "ESCOUADE 2 - SECONDAIRE",  start: 5  },
  { en: "SQUAD 3 - SUPPORT",   ru: "ОТРЯД 3 - ПОДДЕРЖКА", fr: "ESCOUADE 3 - SOUTIEN",     start: 10 },
];

const TOTAL_HERO_SLOTS = 15;

const emptySlots = () =>
  Array(TOTAL_HERO_SLOTS).fill(null).map(() => ({ name: "None", stars: 1 }));

const parseHero = (h) => {
  if (!h || h === "None" || !h.trim()) return { name: "None", stars: 1 };
  const match = h.match(/^(.+?) \((\d)★\)$/);
  if (match) {
    const name = ALL_HEROES.includes(match[1]) ? match[1] : "None";
    return { name, stars: parseInt(match[2]) };
  }
  return { name: ALL_HEROES.includes(h) ? h : "None", stars: 1 };
};

const SETUP_T = {
  EN: {
    commanderSetup: "COMMANDER SETUP",
    editProfile: "EDIT PROFILE",
    serverNumber: "SERVER NUMBER",
    serverPlaceholder: "e.g. 1042",
    furnaceLevel: "FURNACE LEVEL",
    droneLevel: "DRONE LEVEL",
    dronePlaceholder: "e.g. 75",
    hqLevel: "HQ LEVEL",
    hqPlaceholder: "e.g. 25",
    virusResistance: "VIRUS RESISTANCE",
    virusPlaceholder: "e.g. 8500",
    troopType: "TROOP TYPE",
    none: "- None -",
    enterWarRoom: "ENTER WAR ROOM",
    saveProfile: "SAVE PROFILE",
    footer: "LAST WAR: SURVIVAL // TACTICAL AI ADVISOR",
    errorServer: "SERVER NUMBER is required.",
    secondarySquads: "ADD SECONDARY SQUADS (OPTIONAL)",
    secondarySquadsHint: "improves advice accuracy",
    detecting: "Detecting season...",
    autoDetected: "Auto-detected",
    serverNotFound: "Server not found - enter week manually",
  },
  RU: {
    commanderSetup: "НАСТРОЙКА КОМАНДИРА",
    editProfile: "РЕДАКТИРОВАТЬ ПРОФИЛЬ",
    serverNumber: "НОМЕР СЕРВЕРА",
    serverPlaceholder: "напр. 1042",
    furnaceLevel: "УРОВЕНЬ ПЕЧИ",
    droneLevel: "УРОВЕНЬ ДРОНА",
    dronePlaceholder: "напр. 75",
    hqLevel: "УРОВЕНЬ ШТАБА",
    hqPlaceholder: "напр. 25",
    virusResistance: "ВИРУСНАЯ УСТОЙЧИВОСТЬ",
    virusPlaceholder: "напр. 8500",
    troopType: "ТИП ВОЙСК",
    none: "- Пусто -",
    enterWarRoom: "ВОЙТИ В КОМАНДНЫЙ ЦЕНТР",
    saveProfile: "СОХРАНИТЬ ПРОФИЛЬ",
    footer: "LAST WAR: SURVIVAL // ТАКТИЧЕСКИЙ ИИ-СОВЕТНИК",
    errorServer: "НОМЕР СЕРВЕРА обязателен.",
    secondarySquads: "ДОПОЛНИТЕЛЬНЫЕ ОТРЯДЫ (необязательно)",
    secondarySquadsHint: "улучшает точность советов",
    detecting: "Определяем сезон...",
    autoDetected: "Определено автоматически",
    serverNotFound: "Сервер не найден - введите неделю вручную",
  },
  FR: {
    commanderSetup: "CONFIGURATION DU COMMANDANT",
    editProfile: "MODIFIER LE PROFIL",
    serverNumber: "NUMERO DE SERVEUR",
    serverPlaceholder: "ex. 1042",
    furnaceLevel: "NIVEAU DU FOURNEAU",
    droneLevel: "NIVEAU DU DRONE",
    dronePlaceholder: "ex. 75",
    hqLevel: "NIVEAU QG",
    hqPlaceholder: "ex. 25",
    virusResistance: "RESISTANCE VIRALE",
    virusPlaceholder: "ex. 8500",
    troopType: "TYPE DE TROUPE",
    none: "- Aucun -",
    enterWarRoom: "ENTRER DANS LA SALLE DE GUERRE",
    saveProfile: "SAUVEGARDER LE PROFIL",
    footer: "LAST WAR: SURVIVAL // CONSEILLER TACTIQUE IA",
    errorServer: "NUMERO DE SERVEUR requis.",
    secondarySquads: "AJOUTER ESCOUADES SECONDAIRES (OPTIONNEL)",
    secondarySquadsHint: "ameliore la precision des conseils",
    detecting: "Detection du saison...",
    autoDetected: "Auto-detecte",
    serverNotFound: "Serveur non trouve - entrez la semaine manuellement",
  },
};

const SETUP_LANGUAGES = [
  { code: "EN", label: "English",  flag: "🇬🇧" },
  { code: "RU", label: "Русский",  flag: "🇷🇺" },
  { code: "FR", label: "Français", flag: "🇫🇷" },
];

const SetupLanguageSelector = ({ lang, onSetLang }) => {
  const [open, setOpen] = React.useState(false);
  const current = SETUP_LANGUAGES.find((l) => l.code === lang) || SETUP_LANGUAGES[0];
  return (
    <div className="relative" data-testid="setup-language-selector">
      <button
        data-testid="setup-language-btn"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-primary px-2.5 py-1 flex items-center gap-1.5 font-heading text-[9px] tracking-widest"
      >
        <span style={{ fontSize: "14px", lineHeight: 1 }}>{current.flag}</span>
        <span>{lang}</span>
        <span style={{ fontSize: "8px" }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 border border-[#4fc3f7]/30 min-w-[130px]"
            style={{ background: "rgba(8,12,22,0.98)" }}
          >
            {SETUP_LANGUAGES.map(({ code, label, flag }) => (
              <button
                key={code}
                type="button"
                data-testid={`setup-lang-option-${code.toLowerCase()}`}
                onClick={() => { onSetLang(code); setOpen(false); }}
                className="w-full text-left px-3 py-2 font-heading text-[9px] tracking-widest flex items-center gap-2"
                style={{ color: code === lang ? "#4fc3f7" : "#546e7a", background: code === lang ? "rgba(79,195,247,0.08)" : "transparent" }}
              >
                <span style={{ fontSize: "14px", lineHeight: 1 }}>{flag}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Single squad section (heroes + dedup + troop type) ────────────
const TROOP_TYPES = ["Tank", "Aircraft", "Missile"];

const SquadSection = ({ squadCfg, lang, heroes, usedHeroSet, onHero, onHeroStars, T, squadType, onSquadType }) => {
  const { en, ru, fr, start } = squadCfg;
  const label = lang === "RU" ? ru : lang === "FR" ? fr : en;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px flex-1 bg-[#4fc3f7]/20" />
        <span className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.25em] whitespace-nowrap">{label}</span>
        <div className="h-px flex-1 bg-[#4fc3f7]/20" />
      </div>

      {/* Troop type selector */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="font-heading text-[9px] text-[#37474f] tracking-[0.2em] flex-shrink-0">{T.troopType}:</span>
        {TROOP_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onSquadType(squadType === t ? null : t)}
            className="font-heading text-[9px] px-2.5 py-1 border transition-colors tracking-widest"
            style={{
              borderColor: squadType === t ? "#4fc3f7" : "rgba(55,71,79,0.5)",
              background:  squadType === t ? "rgba(79,195,247,0.12)" : "transparent",
              color:        squadType === t ? "#4fc3f7" : "#546e7a",
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((offset) => {
          const i = start + offset;
          return (
            <div key={i} className="flex items-center gap-2">
              <select
                data-testid={`setup-hero-${i + 1}-input`}
                value={heroes[i].name}
                onChange={(e) => onHero(i, e.target.value)}
                className="war-input flex-1 min-w-0 px-3 py-2 text-sm appearance-none cursor-pointer"
                style={{ background: "rgba(10,14,26,0.95)" }}
                translate="no"
                lang="en"
              >
                <option value="None" style={{ background: "#0d1220" }}>{T.none}</option>
                {HEROES_BY_TYPE.map(({ type, list }) => {
                  const available = list.filter(
                    (hero) => hero === heroes[i].name || !usedHeroSet.has(hero)
                  );
                  if (available.length === 0) return null;
                  return (
                    <optgroup key={type} label={`- ${type} -`} style={{ color: "#4fc3f7", background: "#0d1220" }} translate="no">
                      {available.map((hero) => (
                        <option key={hero} value={hero} style={{ background: "#0d1220", color: "#fff" }} translate="no">
                          {hero}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {heroes[i].name !== "None" && (
                <div className="flex gap-0.5 flex-shrink-0" data-testid={`hero-${i + 1}-stars`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      data-testid={`setup-hero-${i + 1}-star-${s}`}
                      onClick={() => onHeroStars(i, s)}
                      className="w-6 h-6 flex items-center justify-center text-base leading-none transition-all hover:scale-125 focus:outline-none"
                      style={{ color: heroes[i].stars >= s ? "#fbbf24" : "#37474f" }}
                      title={`${s}★`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SetupScreen = ({ onComplete, initialProfile = null }) => {
  const [lang, setLangState] = useState(() => localStorage.getItem("warroom_lang") || "EN");
  const T = SETUP_T[lang] || SETUP_T.EN;
  const isEditing = Boolean(initialProfile);

  const setLang = (code) => {
    localStorage.setItem("warroom_lang", code);
    setLangState(code);
  };

  const [server, setServer] = useState(initialProfile?.server || "");
  const [furnaceLevel, setFurnaceLevel] = useState(
    initialProfile ? [initialProfile.furnaceLevel] : [5]
  );
  const [droneLevel,       setDroneLevel]       = useState(initialProfile?.droneLevel       ?? "");
  const [hqLevel,          setHqLevel]          = useState(initialProfile?.hqLevel          ?? "");
  const [virusResistance,  setVirusResistance]  = useState(initialProfile?.virusResistance  ?? "");
  const [squadTypes, setSquadTypes] = useState(() => {
    const saved = initialProfile?.squadTypes;
    return Array.isArray(saved) ? saved : [null, null, null];
  });
  const [showSecondary, setShowSecondary] = useState(() => {
    // Auto-expand if editing and secondary squads have heroes
    if (!initialProfile?.heroes) return false;
    return initialProfile.heroes.slice(5).some((h) => h && h !== "None");
  });
  const [heroes, setHeroes] = useState(() => {
    const slots = emptySlots();
    if (!initialProfile?.heroes) return slots;
    initialProfile.heroes.forEach((h, i) => {
      if (i < TOTAL_HERO_SLOTS) slots[i] = parseHero(h);
    });
    return slots;
  });
  const [error, setError] = useState("");

  // Season week auto-detection state
  const [weekData,      setWeekData]      = useState(
    initialProfile?.seasonWeek
      ? { week: initialProfile.seasonWeek, season: initialProfile.currentSeason, serverDay: null, autoDetected: false }
      : null
  );
  const [weekDetecting, setWeekDetecting] = useState(false);
  const [weekManual,    setWeekManual]    = useState(initialProfile?.seasonWeek ? String(initialProfile.seasonWeek) : "");

  const handleServerBlur = useCallback(async (num) => {
    if (!num || !String(num).trim()) return;
    setWeekDetecting(true);
    try {
      const res  = await fetch(`${SERVER_WEEK_URL}?server=${String(num).trim()}`);
      const data = await res.json();
      if (data.week != null && data.week > 0) {
        setWeekData({ week: data.week, season: data.season, serverDay: data.serverDay, autoDetected: true });
        setWeekManual(String(data.week));
      } else {
        setWeekData({ week: null, season: null, serverDay: null, autoDetected: false, notFound: true });
      }
    } catch {
      setWeekData({ week: null, season: null, serverDay: null, autoDetected: false, notFound: true });
    } finally {
      setWeekDetecting(false);
    }
  }, []);

  const handleHero = (index, name) => {
    const updated = [...heroes];
    updated[index] = {
      name,
      stars: name === "None" ? 1 : updated[index].name === name ? updated[index].stars : 1,
    };
    setHeroes(updated);
  };

  const handleHeroStars = (index, stars) => {
    const updated = [...heroes];
    updated[index] = { ...updated[index], stars };
    setHeroes(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!server) { setError(T.errorServer); return; }
    setError("");
    const formattedHeroes = heroes.map((h) =>
      h.name !== "None" ? `${h.name} (${h.stars}★)` : "None"
    );
    onComplete({
      server,
      furnaceLevel: furnaceLevel[0],
      droneLevel:       droneLevel       !== "" ? parseInt(droneLevel,       10) : null,
      hqLevel:          hqLevel          !== "" ? parseInt(hqLevel,          10) : null,
      virusResistance:  virusResistance  !== "" ? parseInt(virusResistance,  10) : null,
      squadTypes,
      heroes: formattedHeroes,
      squadPowers: initialProfile?.squadPowers || [null, null, null],
      seasonWeek: weekData?.week || (weekManual !== "" ? parseInt(weekManual, 10) : initialProfile?.seasonWeek) || null,
      currentSeason: weekData?.season || initialProfile?.currentSeason || null,
    });
  };

  const usedHeroSet = new Set(heroes.map((h) => h.name).filter((n) => n !== "None"));

  return (
    <div
      className="war-noise min-h-screen bg-[#0a0e1a] flex items-center justify-center px-4 py-8 relative overflow-hidden"
      data-testid="setup-screen"
    >
      <div className="scan-line" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(79,195,247,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(79,195,247,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Language selector — top-right corner */}
      <div className="fixed top-4 right-4 z-50">
        <SetupLanguageSelector lang={lang} onSetLang={setLang} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img
              src="https://www.lastwar.com/en/img/logo.png"
              alt="Last War"
              style={{ height: "28px" }}
              className="object-contain"
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <h1
              className="font-heading text-xl text-white tracking-[0.2em]"
              style={{ textShadow: "0 0 15px rgba(79,195,247,0.5)" }}
            >
              WAR ROOM
            </h1>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <div className="h-px flex-1 bg-[#4fc3f7]/30" />
            <span className="font-heading text-sm text-[#4fc3f7] tracking-[0.3em]">
              {isEditing ? T.editProfile : T.commanderSetup}
            </span>
            <div className="h-px flex-1 bg-[#4fc3f7]/30" />
          </div>
        </div>

        <div className="hud-panel hud-corner p-6 relative">
          <div
            className="absolute top-0 right-0 w-10 h-10 pointer-events-none"
            style={{ borderTop: "2px solid #4fc3f7", borderRight: "2px solid #4fc3f7" }}
          />

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Server Number */}
            <div>
              <label className="block font-heading text-xs text-[#4fc3f7] tracking-[0.25em] mb-2">
                {T.serverNumber}
              </label>
              <input
                data-testid="setup-server-input"
                type="number"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                onBlur={(e) => handleServerBlur(e.target.value)}
                placeholder={T.serverPlaceholder}
                className="war-input w-full px-3 py-2.5 text-sm"
                min="1"
              />

              {/* Season week auto-detect row */}
              <div className="mt-2 min-h-[28px]">
                {weekDetecting && (
                  <p className="font-heading text-[9px] text-[#37474f] tracking-widest animate-pulse">
                    {T.detecting}
                  </p>
                )}
                {!weekDetecting && weekData?.autoDetected && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading text-[9px] text-[#4fc3f7]/80 tracking-widest">
                      S{weekData.season} WK{weekData.week}{weekData.serverDay ? ` DAY ${weekData.serverDay}` : ""}
                    </span>
                    <span
                      className="font-heading text-[8px] px-1.5 py-0.5 tracking-widest"
                      style={{ background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.25)", color: "#4fc3f7" }}
                    >
                      {T.autoDetected}
                    </span>
                    <input
                      data-testid="setup-season-week-input"
                      type="number"
                      value={weekManual}
                      onChange={(e) => setWeekManual(e.target.value)}
                      className="war-input px-2 py-1 text-xs w-16 text-center"
                      min="1"
                      max="8"
                      title="Override season week"
                    />
                  </div>
                )}
                {!weekDetecting && weekData?.notFound && (
                  <div className="flex items-center gap-2">
                    <p className="font-heading text-[9px] text-[#37474f] tracking-widest">{T.serverNotFound}</p>
                    <input
                      data-testid="setup-season-week-input"
                      type="number"
                      value={weekManual}
                      onChange={(e) => setWeekManual(e.target.value)}
                      placeholder="1-8"
                      className="war-input px-2 py-1 text-xs w-16 text-center"
                      min="1"
                      max="8"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Furnace Level */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="font-heading text-xs text-[#4fc3f7] tracking-[0.25em]">
                  {T.furnaceLevel}
                </label>
                <span
                  className="font-heading text-xl text-white"
                  style={{ textShadow: "0 0 10px rgba(79,195,247,0.5)" }}
                  data-testid="furnace-level-display"
                >
                  {furnaceLevel[0]}
                </span>
              </div>
              <SliderPrimitive.Root
                data-testid="setup-furnace-slider"
                className="relative flex w-full touch-none select-none items-center"
                value={furnaceLevel}
                onValueChange={setFurnaceLevel}
                min={1} max={30} step={1}
              >
                <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden bg-[#37474f]/60">
                  <SliderPrimitive.Range className="absolute h-full bg-[#4fc3f7]" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block h-3.5 w-3.5 bg-[#4fc3f7] border border-[#4fc3f7] cursor-pointer focus-visible:outline-none" />
              </SliderPrimitive.Root>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#37474f] font-heading">1</span>
                <span className="text-[10px] text-[#37474f] font-heading">30</span>
              </div>
            </div>

            {/* Drone Level + HQ Level — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-heading text-xs text-[#4fc3f7] tracking-[0.25em] mb-2">
                  {T.droneLevel}
                </label>
                <input
                  data-testid="setup-drone-level-input"
                  type="number"
                  value={droneLevel}
                  onChange={(e) => setDroneLevel(e.target.value)}
                  placeholder={T.dronePlaceholder}
                  className="war-input w-full px-3 py-2.5 text-sm"
                  min="1"
                />
              </div>
              <div>
                <label className="block font-heading text-xs text-[#4fc3f7]/70 tracking-[0.25em] mb-2">
                  {T.hqLevel} <span className="text-[#37474f] text-[9px] normal-case tracking-normal">(opt)</span>
                </label>
                <input
                  data-testid="setup-hq-level-input"
                  type="number"
                  value={hqLevel}
                  onChange={(e) => setHqLevel(e.target.value)}
                  placeholder={T.hqPlaceholder}
                  className="war-input w-full px-3 py-2.5 text-sm"
                  min="1"
                  max="35"
                />
              </div>
            </div>

            {/* Virus Resistance */}
            <div>
              <label className="block font-heading text-xs text-[#4fc3f7]/70 tracking-[0.25em] mb-2">
                {T.virusResistance} <span className="text-[#37474f] text-[9px] normal-case tracking-normal">(opt)</span>
              </label>
              <input
                data-testid="setup-virus-resistance-input"
                type="number"
                value={virusResistance}
                onChange={(e) => setVirusResistance(e.target.value)}
                placeholder={T.virusPlaceholder}
                className="war-input w-full px-3 py-2.5 text-sm"
                min="0"
              />
            </div>

            {/* Squad 1 — always visible */}
            <div>
              <SquadSection
                squadCfg={SQUAD_CONFIG[0]}
                lang={lang}
                heroes={heroes}
                usedHeroSet={usedHeroSet}
                onHero={handleHero}
                onHeroStars={handleHeroStars}
                T={T}
                squadType={squadTypes[0]}
                onSquadType={(t) => setSquadTypes((prev) => { const n = [...prev]; n[0] = t; return n; })}
              />
            </div>

            {/* Secondary Squads — collapsible */}
            <div>
              <button
                type="button"
                data-testid="toggle-secondary-squads"
                onClick={() => setShowSecondary((v) => !v)}
                className="w-full flex items-center gap-2 py-2.5 px-3 border border-[#4fc3f7]/20 hover:border-[#4fc3f7]/40 transition-colors"
                style={{ background: "rgba(79,195,247,0.04)" }}
              >
                <ChevronDown
                  size={12}
                  color="#4fc3f7"
                  className={`flex-shrink-0 transition-transform duration-200 ${showSecondary ? "rotate-180" : ""}`}
                />
                <div className="flex-1 text-left">
                  <span className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.2em]">
                    {T.secondarySquads}
                  </span>
                  {!showSecondary && (
                    <span className="font-heading text-[9px] text-[#37474f] tracking-wide ml-2">
                      — {T.secondarySquadsHint}
                    </span>
                  )}
                </div>
              </button>

              {showSecondary && (
                <div className="space-y-5 mt-4 pl-1 border-l border-[#4fc3f7]/15">
                  {SQUAD_CONFIG.slice(1).map((cfg, idx) => (
                    <SquadSection
                      key={cfg.start}
                      squadCfg={cfg}
                      lang={lang}
                      heroes={heroes}
                      usedHeroSet={usedHeroSet}
                      onHero={handleHero}
                      onHeroStars={handleHeroStars}
                      T={T}
                      squadType={squadTypes[idx + 1]}
                      onSquadType={(t) => setSquadTypes((prev) => { const n = [...prev]; n[idx + 1] = t; return n; })}
                    />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="text-[#ff6f00] text-xs font-heading tracking-widest">⚠ {error}</p>
            )}

            <button
              data-testid="setup-submit-button"
              type="submit"
              className="btn-primary w-full py-4 text-base tracking-[0.3em] mt-2"
              style={{ fontSize: "1rem" }}
            >
              {isEditing ? `💾 ${T.saveProfile}` : `❄️ ${T.enterWarRoom}`}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-[#37474f] font-heading tracking-widest mt-4">
          {T.footer}
        </p>
      </div>
    </div>
  );
};

export default SetupScreen;
