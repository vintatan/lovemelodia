import { useState } from "react";
import LandingPage from "./components/LandingPage.tsx";
import AuthGate from "./components/AuthGate.tsx";
import CreatorShell from "./components/CreatorShell.tsx";

interface AuthState {
  token: string;
  phone: string;
  credits: number;
}

type AppView = "landing" | "auth" | "creator";

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const saved = sessionStorage.getItem("kreasi_auth");
    return saved ? JSON.parse(saved) as AuthState : null;
  });
  const [view, setView] = useState<AppView>(auth ? "creator" : "landing");

  function handleAuth(token: string, phone: string, credits: number) {
    const state = { token, phone, credits };
    setAuth(state);
    sessionStorage.setItem("kreasi_auth", JSON.stringify(state));
    setView("creator");
  }

  function updateCredits(credits: number) {
    if (!auth) return;
    const updated = { ...auth, credits };
    setAuth(updated);
    sessionStorage.setItem("kreasi_auth", JSON.stringify(updated));
  }

  if (auth && view === "creator") {
    return (
      <CreatorShell
        token={auth.token}
        phone={auth.phone}
        credits={auth.credits}
        onCreditsUpdate={updateCredits}
      />
    );
  }

  if (view === "auth") {
    return <AuthGate onAuth={handleAuth} />;
  }

  return <LandingPage onStart={() => setView("auth")} />;
}
