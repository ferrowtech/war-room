import React, { useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

const TROOP_TYPES = ["Tank", "Aircraft", "Missile"];

const HEROES = {
  Tank: ["Murphy", "Kimberly", "Marshall", "Williams", "Mason", "Violet", "Richard", "Monica", "Scarlett", "Stetmann"],
  Aircraft: ["DVA", "Carlie", "Schuyler", "Morrison", "Lucius", "Sarah", "Maxwell", "Cage"],
  Missile: ["Swift", "Tesla", "Fiona", "Adam", "Venom", "McGregor", "Elsa", "Kane"],
};
const ALL_HEROES = [...HEROES.Tank, ...HEROES.Aircraft, ...HEROES.Missile];

const parseHero = (h) => {
  if (!h || h === "None" || !h.trim()) return { name: "None", stars: 1 };
  const match = h.match(/^(.+?) \((\d)★\)$/);
  if (match) return { name: ALL_HEROES.includes(match[1]) ? match[1] : "None", stars: parseInt(match[2]) };
  return { name: ALL_HEROES.includes(h) ? h : "None", stars: 1 };
};

const SetupScreen = ({ onComplete, initialProfile = null }) => {
  const [server, setServer] = useState(initialProfile?.server || "");
  const [troopType, setTroopType] = useState(initialProfile?.troopType || "");
  const [furnaceLevel, setFurnaceLevel] = useState(
    initialProfile ? [initialProfile.furnaceLevel] : [5]
  );
  const [heroes, setHeroes] = useState(() => {
    if (!initialProfile?.heroes) return [
      { name: "None", stars: 1 },
      { name: "None", stars: 1 },
      { name: "None", stars: 1 },
    ];
    return initialProfile.heroes.map(parseHero);
  });
  const [error, setError] = useState("");

  const handleHero = (index, name) => {
    const updated = [...heroes];
    updated[index] = { name, stars: name === "None" ? 1 : updated[index].name === name ? updated[index].stars : 1 };
    setHeroes(updated);
  };

  const handleHeroStars = (index, stars) => {
    const updated = [...heroes];
    updated[index] = { ...updated[index], stars };
    setHeroes(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!server || !troopType) {
      setError("SERVER NUMBER and TROOP TYPE are required.");
      return;
    }
    setError("");
    const formattedHeroes = heroes.map((h) =>
      h.name !== "None" ? `${h.name} (${h.stars}★)` : "None"
    );
    onComplete({ server, troopType, furnaceLevel: furnaceLevel[0], heroes: formattedHeroes, seasonStartDate: initialProfile?.seasonStartDate });
  };

  const isEditing = Boolean(initialProfile);

  return (
    <div
      className="war-noise min-h-screen bg-[#0a0e1a] flex items-center justify-center px-4 py-8 relative overflow-hidden"
      data-testid="setup-screen"
    >
      <div className="scan-line" />

      {/* Background grid lines */}
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
              {isEditing ? "EDIT PROFILE" : "COMMANDER SETUP"}
            </span>
            <div className="h-px flex-1 bg-[#4fc3f7]/30" />
          </div>
        </div>

        {/* Form Panel */}
        <div className="hud-panel hud-corner p-6 relative">
          {/* Top-right corner */}
          <div
            className="absolute top-0 right-0 w-10 h-10 pointer-events-none"
            style={{
              borderTop: "2px solid #4fc3f7",
              borderRight: "2px solid #4fc3f7",
            }}
          />

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Server Number */}
            <div>
              <label className="block font-heading text-xs text-[#4fc3f7] tracking-[0.25em] mb-2">
                SERVER NUMBER
              </label>
              <input
                data-testid="setup-server-input"
                type="number"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="e.g. 1042"
                className="war-input w-full px-3 py-2.5 text-sm"
                min="1"
              />
            </div>

            {/* Troop Type */}
            <div>
              <label className="block font-heading text-xs text-[#4fc3f7] tracking-[0.25em] mb-2">
                PRIMARY TROOP TYPE
              </label>
              <select
                data-testid="setup-troop-select"
                value={troopType}
                onChange={(e) => setTroopType(e.target.value)}
                className="war-input w-full px-3 py-2.5 text-sm appearance-none cursor-pointer"
                style={{ background: "rgba(10,14,26,0.95)" }}
              >
                <option value="" disabled>
                  Select troop type...
                </option>
                {TROOP_TYPES.map((t) => (
                  <option
                    key={t}
                    value={t}
                    style={{ background: "#0d1220", color: "#fff" }}
                  >
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Furnace Level */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="font-heading text-xs text-[#4fc3f7] tracking-[0.25em]">
                  FURNACE LEVEL
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
                min={1}
                max={20}
                step={1}
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

            {/* Heroes */}
            <div>
              <label className="block font-heading text-xs text-[#4fc3f7] tracking-[0.25em] mb-2">
                TOP HEROES 🏔️
              </label>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    {/* Dropdown */}
                    <select
                      data-testid={`setup-hero-${i + 1}-input`}
                      value={heroes[i].name}
                      onChange={(e) => handleHero(i, e.target.value)}
                      className="war-input flex-1 min-w-0 px-3 py-2 text-sm appearance-none cursor-pointer"
                      style={{ background: "rgba(10,14,26,0.95)" }}
                    >
                      <option value="None" style={{ background: "#0d1220" }}>— None —</option>
                      {Object.entries(HEROES).map(([type, list]) => (
                        <optgroup key={type} label={`── ${type.toUpperCase()} ──`}>
                          {list.map((hero) => (
                            <option key={hero} value={hero} style={{ background: "#0d1220", color: "#fff" }}>
                              {hero}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* Star rating */}
                    {heroes[i].name !== "None" ? (
                      <div
                        className="flex gap-0.5 flex-shrink-0"
                        data-testid={`hero-${i + 1}-stars`}
                      >
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
                    ) : (
                      <div className="w-[120px] flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[#ff6f00] text-xs font-heading tracking-widest">
                ⚠ {error}
              </p>
            )}

            {/* Submit */}
            <button
              data-testid="setup-submit-button"
              type="submit"
              className="btn-primary w-full py-4 text-base tracking-[0.3em] mt-2"
              style={{ fontSize: "1rem" }}
            >
              {isEditing ? "💾 SAVE PROFILE" : "❄️ ENTER WAR ROOM"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#37474f] font-heading tracking-widest mt-4">
          LAST WAR: SURVIVAL // TACTICAL AI ADVISOR
        </p>
      </div>
    </div>
  );
};

export default SetupScreen;
