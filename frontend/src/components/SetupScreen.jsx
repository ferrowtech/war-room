import React, { useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

// ── Hero roster grouped by troop type ─────────────────────────────
const HEROES_BY_TYPE = [
  { type: "TANK",     list: ["Murphy", "Kimberly", "Marshall", "Williams", "Mason", "Violet", "Richard", "Monica", "Scarlett", "Stetmann"] },
  { type: "AIRCRAFT", list: ["DVA", "Carlie", "Schuyler", "Morrison", "Lucius", "Sarah", "Maxwell", "Cage"] },
  { type: "MISSILE",  list: ["Swift", "Tesla", "Fiona", "Adam", "Venom", "McGregor", "Elsa", "Kane"] },
];
const ALL_HEROES = HEROES_BY_TYPE.flatMap((g) => g.list);

export const SQUAD_CONFIG = [
  { en: "SQUAD 1 - PRIMARY",   ru: "ОТРЯД 1 - ОСНОВНОЙ",  start: 0  },
  { en: "SQUAD 2 - SECONDARY", ru: "ОТРЯД 2 - ВТОРИЧНЫЙ", start: 5  },
  { en: "SQUAD 3 - SUPPORT",   ru: "ОТРЯД 3 - ПОДДЕРЖКА", start: 10 },
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
    squadPower: "SQUAD POWER (M)",
    squadPowerPlaceholder: "e.g. 20.62",
    none: "- None -",
    enterWarRoom: "ENTER WAR ROOM",
    saveProfile: "SAVE PROFILE",
    footer: "LAST WAR: SURVIVAL // TACTICAL AI ADVISOR",
    errorServer: "SERVER NUMBER is required.",
  },
  RU: {
    commanderSetup: "НАСТРОЙКА КОМАНДИРА",
    editProfile: "РЕДАКТИРОВАТЬ ПРОФИЛЬ",
    serverNumber: "НОМЕР СЕРВЕРА",
    serverPlaceholder: "напр. 1042",
    furnaceLevel: "УРОВЕНЬ ПЕЧИ",
    squadPower: "МОЩНОСТЬ ОТРЯДА (М)",
    squadPowerPlaceholder: "напр. 20.62",
    none: "- Пусто -",
    enterWarRoom: "ВОЙТИ В КОМАНДНЫЙ ЦЕНТР",
    saveProfile: "СОХРАНИТЬ ПРОФИЛЬ",
    footer: "LAST WAR: SURVIVAL // ТАКТИЧЕСКИЙ ИИ-СОВЕТНИК",
    errorServer: "НОМЕР СЕРВЕРА обязателен.",
  },
};

const SETUP_LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "RU", label: "Русский" },
];

const SetupLanguageSelector = ({ lang, onSetLang }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative" data-testid="setup-language-selector">
      <button
        data-testid="setup-language-btn"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-primary px-2.5 py-1 flex items-center gap-1 font-heading text-[9px] tracking-widest"
      >
        <span>{lang}</span>
        <span style={{ fontSize: "8px" }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 border border-[#4fc3f7]/30 min-w-[110px]"
            style={{ background: "rgba(8,12,22,0.98)" }}
          >
            {SETUP_LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                data-testid={`setup-lang-option-${code.toLowerCase()}`}
                onClick={() => { onSetLang(code); setOpen(false); }}
                className="w-full text-left px-3 py-2 font-heading text-[9px] tracking-widest"
                style={{ color: code === lang ? "#4fc3f7" : "#546e7a", background: code === lang ? "rgba(79,195,247,0.08)" : "transparent" }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
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
  const [squadPowers, setSquadPowers] = useState([
    initialProfile?.squadPowers?.[0] ?? "",
    initialProfile?.squadPowers?.[1] ?? "",
    initialProfile?.squadPowers?.[2] ?? "",
  ]);
  const [furnaceLevel, setFurnaceLevel] = useState(
    initialProfile ? [initialProfile.furnaceLevel] : [5]
  );
  const [heroes, setHeroes] = useState(() => {
    const slots = emptySlots();
    if (!initialProfile?.heroes) return slots;
    initialProfile.heroes.forEach((h, i) => {
      if (i < TOTAL_HERO_SLOTS) slots[i] = parseHero(h);
    });
    return slots;
  });
  const [error, setError] = useState("");

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
    // troopType is NOT stored in profile — always inferred fresh from Squad 1 heroes
    onComplete({
      server,
      furnaceLevel: furnaceLevel[0],
      heroes: formattedHeroes,
      squadPowers: squadPowers.map((p) => (p !== "" && p !== null ? parseFloat(p) : null)),
      seasonWeek: initialProfile?.seasonWeek,
    });
  };

  // Compute the set of selected hero names so each hero can only appear once.
  // Each slot's dropdown filters out heroes already chosen in OTHER slots.
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
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-[#4fc3f7] text-2xl">❄️</span>
            <h1
              className="font-heading text-4xl sm:text-5xl text-white tracking-[0.15em]"
              style={{ textShadow: "0 0 20px rgba(79,195,247,0.6)" }}
            >
              WAR ROOM
            </h1>
            <span className="text-[#4fc3f7] text-2xl">⚔️</span>
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
                placeholder={T.serverPlaceholder}
                className="war-input w-full px-3 py-2.5 text-sm"
                min="1"
              />
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
                min={1} max={20} step={1}
              >
                <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden bg-[#37474f]/60">
                  <SliderPrimitive.Range className="absolute h-full bg-[#4fc3f7]" />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className="block h-3.5 w-3.5 bg-[#4fc3f7] border border-[#4fc3f7] cursor-pointer focus-visible:outline-none" />
              </SliderPrimitive.Root>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#37474f] font-heading">1</span>
                <span className="text-[10px] text-[#37474f] font-heading">20</span>
              </div>
            </div>

            {/* Hero Squads — Squad 1 determines troop type */}
            <div className="space-y-5">
              {SQUAD_CONFIG.map(({ en, ru, start }, squadIdx) => (
                <div key={start}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-[#4fc3f7]/20" />
                    <label className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.25em] whitespace-nowrap">
                      {lang === "RU" ? ru : en}
                    </label>
                    <div className="h-px flex-1 bg-[#4fc3f7]/20" />
                  </div>
                  <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map((offset) => {
                      const i = start + offset;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            data-testid={`setup-hero-${i + 1}-input`}
                            value={heroes[i].name}
                            onChange={(e) => handleHero(i, e.target.value)}
                            className="war-input flex-1 min-w-0 px-3 py-2 text-sm appearance-none cursor-pointer"
                            style={{ background: "rgba(10,14,26,0.95)" }}
                          >
                            <option value="None" style={{ background: "#0d1220" }}>{T.none}</option>
                            {HEROES_BY_TYPE.map(({ type, list }) => {
                              const available = list.filter(
                                (hero) => hero === heroes[i].name || !usedHeroSet.has(hero)
                              );
                              if (available.length === 0) return null;
                              return (
                                <optgroup key={type} label={`- ${type} -`} style={{ color: "#4fc3f7", background: "#0d1220" }}>
                                  {available.map((hero) => (
                                    <option key={hero} value={hero} style={{ background: "#0d1220", color: "#fff" }}>
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
                                  onClick={() => handleHeroStars(i, s)}
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
                  {/* Squad Power */}
                  <div className="flex items-center gap-2 mt-2">
                    <label className="font-heading text-[9px] text-[#37474f] tracking-[0.2em] flex-shrink-0">
                      {T.squadPower}
                    </label>
                    <input
                      data-testid={`setup-squad-power-${squadIdx + 1}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={squadPowers[squadIdx]}
                      onChange={(e) => {
                        const updated = [...squadPowers];
                        updated[squadIdx] = e.target.value;
                        setSquadPowers(updated);
                      }}
                      placeholder={T.squadPowerPlaceholder}
                      className="war-input flex-1 px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              ))}
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
