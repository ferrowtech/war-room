import React, { useState, useEffect } from "react";
import "./App.css";
import SetupScreen from "./components/SetupScreen";
import WarRoom from "./components/WarRoom";

const PROFILE_KEY = "warroom_profile";

function App() {
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

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

  return (
    <div className="App">
      {!profile || editing ? (
        <SetupScreen onComplete={handleSetup} initialProfile={editing ? profile : null} />
      ) : (
        <WarRoom profile={profile} onEditProfile={handleEditProfile} />
      )}
    </div>
  );
}

export default App;
