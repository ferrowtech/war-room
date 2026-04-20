import React, { useState, useEffect } from "react";
import "./App.css";
import SetupScreen from "./components/SetupScreen";
import WarRoom from "./components/WarRoom";
import DailyChecklist from "./components/DailyChecklist";
import { MessageSquare, CheckSquare } from "lucide-react";

const PROFILE_KEY = "warroom_profile";

// ── Bottom navigation ─────────────────────────────────────────────
const BottomNav = ({ activeTab, onTabChange, language }) => {
  const labels = {
    warroom:   { EN: "INTEL",     RU: "БРИФИНГ", FR: "INTEL"   },
    checklist: { EN: "DAILY OPS", RU: "ОП. ДЕНЬ", FR: "OPS JOUR" },
  };
  const lang = ["EN","RU","FR"].includes(language) ? language : "EN";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[#4fc3f7]/20"
      style={{ background: "rgba(8,12,22,0.97)", backdropFilter: "blur(12px)", height: "52px" }}
      data-testid="bottom-nav"
    >
      {[
        { key: "warroom",   Icon: MessageSquare },
        { key: "checklist", Icon: CheckSquare   },
      ].map(({ key, Icon }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            data-testid={`nav-tab-${key}`}
            onClick={() => onTabChange(key)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: active ? "#4fc3f7" : "#37474f" }}
          >
            <Icon size={16} strokeWidth={active ? 2 : 1.5} />
            <span className="font-heading text-[8px] tracking-[0.25em]">{labels[key][lang]}</span>
            {active && (
              <span
                className="absolute bottom-0"
                style={{ height: "2px", width: "40px", background: "#4fc3f7", borderRadius: "1px" }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};

function App() {
  const [profile,   setProfile]   = useState(null);
  const [loaded,    setLoaded]    = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [activeTab, setActiveTab] = useState("warroom");

  // Remove the platform badge from the DOM
  useEffect(() => {
    const kill = () => {
      const b = document.getElementById("emergent-badge");
      if (b) b.parentNode && b.parentNode.removeChild(b);
    };
    kill();
    const obs = new MutationObserver(kill);
    obs.observe(document.body || document.documentElement, { childList: true, subtree: false });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(PROFILE_KEY);
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch {}
    }
    setLoaded(true);
  }, []);

  const handleSetup = (profileData) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
    setProfile(profileData);
    setEditing(false);
  };

  const handleEditProfile = () => {
    setEditing(true);
  };

  if (!loaded) return null;

  const language = profile?.language || localStorage.getItem("warroom_lang") || "EN";

  return (
    <div className="App">
      {!profile || editing ? (
        <SetupScreen onComplete={handleSetup} initialProfile={editing ? profile : null} />
      ) : (
        <div className="relative">
          {activeTab === "warroom" ? (
            <WarRoom profile={profile} onEditProfile={handleEditProfile} />
          ) : (
            <DailyChecklist language={language} />
          )}
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} language={language} />
        </div>
      )}
    </div>
  );
}

export default App;
