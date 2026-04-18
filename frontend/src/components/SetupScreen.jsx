import React, { useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

// All heroes available in every squad — Squad 1 defines troop type (computed in WarRoom)
const ALL_HEROES = [
  "Murphy", "Kimberly", "Marshall", "Williams", "Mason", "Violet", "Richard", "Monica", "Scarlett", "Stetmann",
  "DVA", "Carlie", "Schuyler", "Morrison", "Lucius", "Sarah", "Maxwell", "Cage",
  "Swift", "Tesla", "Fiona", "Adam", "Venom", "McGregor", "Elsa", "Kane",
];

export const TIMEZONE_OPTIONS = [
  { label: "UTC-8", offset: -8 },
  { label: "UTC-5", offset: -5 },
  { label: "UTC+0", offset:  0 },
  { label: "UTC+1", offset:  1 },
  { label: "UTC+3", offset:  3 },
  { label: "UTC+5", offset:  5 },
  { label: "UTC+8", offset:  8 },
];

const SQUAD_CONFIG = [
  { en: "SQUAD 1 — PRIMARY",   ru: "ОТРЯД 1 — ОСНОВНОЙ",  start: 0  },
  { en: "SQUAD 2 — SECONDARY", ru: "ОТРЯД 2 — ВТОРИЧНЫЙ", start: 5  },
  { en: "SQUAD 3 — SUPPORT",   ru: "ОТРЯД 3 — ПОДДЕРЖКА", start: 10 },
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
    timezoneLabel: "SERVER TIMEZONE",
    furnaceLevel: "FURNACE LEVEL",
    none: "— None —",
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
    timezoneLabel: "ЧАСОВОЙ ПОЯС СЕРВЕРА",
    furnaceLevel: "УРОВЕНЬ ПЕЧИ",
    none: "— Пусто —",
    enterWarRoom: "ВОЙТИ В КОМАНДНЫЙ ЦЕНТР",
    saveProfile: "СОХРАНИТЬ ПРОФИЛЬ",
    footer: "LAST WAR: SURVIVAL // ТАКТИЧЕСКИЙ ИИ-СОВЕТНИК",
    errorServer: "НОМЕР СЕРВЕРА обязателен.",
  },
};

const SetupScreen = ({ onComplete, initialProfile = null }) => {
  const lang = localStorage.getItem("warroom_lang") || "EN";
  const T = SETUP_T[lang] || SETUP_T.EN;
  const isEditing = Boolean(initialProfile);

  const [server, setServer] = useState(initialProfile?.server || "");
  const [timezoneOffset, setTimezoneOffset] = useState(initialProfile?.timezoneOffset ?? 0);
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
      timezoneOffset,
      seasonWeek: initialProfile?.seasonWeek,
    });
  };

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

            {/* Server Timezone */}
            <div>
              <label className="block font-heading text-xs text-[#4fc3f7] tracking-[0.25em] mb-2">
                {T.timezoneLabel}
              </label>
              <div className="grid grid-cols-7 gap-1" data-testid="timezone-selector">
                {TIMEZONE_OPTIONS.map(({ label, offset }) => (
                  <button
                    key={label}
                    type="button"
                    data-testid={`setup-tz-${label.replace("+", "p").replace("-", "m")}`}
                    onClick={() => setTimezoneOffset(offset)}
                    className="py-2 font-heading text-[9px] tracking-wide border transition-all"
                    style={{
                      background: timezoneOffset === offset ? "rgba(79,195,247,0.2)" : "rgba(10,14,26,0.8)",
                      borderColor: timezoneOffset === offset ? "#4fc3f7" : "rgba(55,71,79,0.5)",
                      color: timezoneOffset === offset ? "#4fc3f7" : "#546e7a",
                    }}
                  >
                    {label}
                  </button>
                ))}
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
              {SQUAD_CONFIG.map(({ en, ru, start }) => (
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
                            {ALL_HEROES.map((hero) => (
                              <option key={hero} value={hero} style={{ background: "#0d1220", color: "#fff" }}>
                                {hero}
                              </option>
                            ))}
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
