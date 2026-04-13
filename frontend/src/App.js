import React, { useState, useEffect } from "react";
import "./App.css";
import SetupScreen from "./components/SetupScreen";
import WarRoom from "./components/WarRoom";

const PROFILE_KEY = "warroom_profile";

function App() {
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);

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
  };

  const handleEditProfile = () => {
    setProfile(null);
    localStorage.removeItem(PROFILE_KEY);
  };

  if (!loaded) return null;

  return (
    <div className="App">
      {!profile ? (
        <SetupScreen onComplete={handleSetup} />
      ) : (
        <WarRoom profile={profile} onEditProfile={handleEditProfile} />
      )}
    </div>
  );
}

export default App;
