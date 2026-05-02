import { useState, useEffect } from "react";
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const externalId = params.get("ext") ?? sessionStorage.getItem("kreasi_pending_payment");
    if (!externalId || !auth) return;
    sessionStorage.removeItem("kreasi_pending_payment");
    window.history.replaceState({}, "", window.location.pathname);
    fetch("/api/credits/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ externalId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { status?: string; credits?: number } | null) => {
        if (data?.status === "PAID" && typeof data.credits === "number") {
          updateCredits(data.credits);
        }
      })
      .catch(() => {});
  }, [auth?.token]);

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
    return <AuthGate onAuth={handleAuth} onBack={() => setView("landing")} />;
  }

  return <LandingPage onStart={() => setView("auth")} />;
}
