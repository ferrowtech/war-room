import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
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
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DAILY_LIMIT = 3;

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
const IntelligenceReport = ({ text, imagePreview }) => {
  const { displayed, typing } = useTypewriter(text);
  return (
    <div className="intel-report p-5 mt-4 relative" data-testid="intelligence-report">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#4fc3f7]/20">
        <Zap size={14} color="#4fc3f7" strokeWidth={1.5} />
        <span className="font-heading text-xs text-[#4fc3f7] tracking-[0.3em]">
          INTELLIGENCE REPORT
        </span>
        {typing && (
          <div className="ml-auto flex gap-1">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        )}
      </div>

      {imagePreview && (
        <div className="mb-3 border border-[#37474f]">
          <img
            src={imagePreview}
            alt="Mission attachment"
            className="w-full max-h-32 object-cover opacity-70"
          />
          <p className="text-[10px] text-[#37474f] font-heading px-2 py-1 tracking-widest">
            ATTACHED VISUAL
          </p>
        </div>
      )}

      <p className="font-report text-[#b3e5fc] text-sm leading-relaxed whitespace-pre-wrap">
        {displayed}
        {typing && <span className="typewriter-cursor" />}
      </p>
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
const ProfilePanel = ({ profile, isOpen, onClose }) => {
  const troopIcon =
    profile.troopType === "Tank"
      ? "⚔️"
      : profile.troopType === "Aircraft"
      ? "✈️"
      : "🚀";

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        data-testid="profile-panel"
        className={`panel-mobile md:relative md:translate-x-0 md:w-56 md:flex-shrink-0 hud-panel z-50 md:z-auto flex flex-col ${
          isOpen ? "open" : ""
        }`}
        style={{ minHeight: 0 }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#4fc3f7]/20">
          <div className="flex items-center gap-1.5">
            <User size={12} color="#4fc3f7" strokeWidth={1.5} />
            <span className="font-heading text-[10px] text-[#4fc3f7] tracking-[0.3em]">
              COMMANDER
            </span>
          </div>
          <button
            className="md:hidden text-[#37474f] hover:text-[#4fc3f7]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Server */}
          <div>
            <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">
              SERVER
            </p>
            <p className="font-heading text-lg text-white">
              #{profile.server}
            </p>
          </div>

          <div className="h-px bg-[#37474f]/40" />

          {/* Troop type */}
          <div>
            <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">
              TROOP TYPE
            </p>
            <div className="flex items-center gap-2">
              <span className="text-base">{troopIcon}</span>
              <span className="font-heading text-sm text-[#4fc3f7]">
                {profile.troopType.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="h-px bg-[#37474f]/40" />

          {/* Furnace level */}
          <div>
            <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-1">
              FURNACE LEVEL
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#37474f]/40">
                <div
                  className="h-full bg-[#4fc3f7]"
                  style={{ width: `${(profile.furnaceLevel / 20) * 100}%` }}
                />
              </div>
              <span className="font-heading text-sm text-white w-5 text-right">
                {profile.furnaceLevel}
              </span>
            </div>
          </div>

          <div className="h-px bg-[#37474f]/40" />

          {/* Heroes */}
          <div>
            <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-2">
              🏔️ HEROES
            </p>
            <div className="space-y-1.5">
              {profile.heroes.filter((h) => h.trim()).map((hero, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ChevronRight size={10} color="#4fc3f7" />
                  <span className="font-heading text-xs text-[#b3e5fc]">
                    {hero}
                  </span>
                </div>
              ))}
              {profile.heroes.filter((h) => h.trim()).length === 0 && (
                <span className="font-heading text-[10px] text-[#37474f]">
                  No heroes set
                </span>
              )}
            </div>
          </div>

          {/* Troop counter info */}
          <div className="h-px bg-[#37474f]/40" />
          <div>
            <p className="font-heading text-[9px] text-[#37474f] tracking-[0.3em] mb-2">
              COUNTER INTEL
            </p>
            <div
              className="p-2 border border-[#37474f]/40"
              style={{ background: "rgba(55,71,79,0.1)" }}
            >
              {profile.troopType === "Tank" && (
                <>
                  <p className="font-heading text-[9px] text-green-400 mb-1">
                    ✓ BEATS: Missile
                  </p>
                  <p className="font-heading text-[9px] text-[#ff6f00]">
                    ✗ WEAK TO: Aircraft
                  </p>
                </>
              )}
              {profile.troopType === "Aircraft" && (
                <>
                  <p className="font-heading text-[9px] text-green-400 mb-1">
                    ✓ BEATS: Tank
                  </p>
                  <p className="font-heading text-[9px] text-[#ff6f00]">
                    ✗ WEAK TO: Missile
                  </p>
                </>
              )}
              {profile.troopType === "Missile" && (
                <>
                  <p className="font-heading text-[9px] text-green-400 mb-1">
                    ✓ BEATS: Aircraft
                  </p>
                  <p className="font-heading text-[9px] text-[#ff6f00]">
                    ✗ WEAK TO: Tank
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Mission Bar ─────────────────────────────────────────────────
const MissionBar = ({ remaining }) => {
  const isLow = remaining <= 1;
  return (
    <div
      data-testid="missions-remaining-counter"
      className={`flex items-center justify-between px-4 py-2.5 border-t ${
        isLow ? "border-[#ff6f00]/40 mission-low" : "border-[#4fc3f7]/10"
      }`}
      style={{
        background: isLow
          ? "rgba(255,111,0,0.05)"
          : "rgba(10,14,26,0.95)",
      }}
    >
      <div className="flex items-center gap-2">
        <Shield
          size={12}
          color={isLow ? "#ff6f00" : "#4fc3f7"}
          strokeWidth={1.5}
        />
        <span
          className={`font-heading text-xs tracking-[0.25em] ${
            isLow ? "text-[#ff6f00]" : "text-[#4fc3f7]"
          }`}
        >
          MISSIONS REMAINING:
        </span>
      </div>
      <span
        className={`font-heading text-sm font-bold ${
          isLow ? "text-glow-orange" : "text-glow-cyan"
        }`}
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
  const [question, setQuestion] = useState("");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState(getRemainingMissions);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const reportRef = useRef(null);
  const fileInputRef = useRef(null);

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
        server: String(profile.server),
        troop_type: profile.troopType,
        furnace_level: Number(profile.furnaceLevel),
        heroes: profile.heroes,
        ...(uploadedImage ? { image_base64: uploadedImage } : {}),
      };

      const res = await axios.post(`${API}/brief`, payload);
      const newRemaining = consumeMission();
      setRemaining(newRemaining);
      setResponse(res.data.response);
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
        profile={profile}
        onEditProfile={onEditProfile}
        onTogglePanel={() => setPanelOpen((v) => !v)}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left Panel */}
        <ProfilePanel
          profile={profile}
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
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
              <IntelligenceReport text={response} imagePreview={null} />
            </div>
          )}

          {/* Empty state */}
          {!response && remaining > 0 && (
            <div className="flex flex-col items-center justify-center flex-1 py-12 opacity-20">
              <span className="text-4xl mb-3">⚔️</span>
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
