import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage.tsx";
import AuthGate from "./components/AuthGate.tsx";
import CreatorShell from "./components/CreatorShell.tsx";
import GiftPage from "./pages/GiftPage.tsx";

interface AuthState {
  token: string;
  phone: string;
  credits: number;
}

type AppView = "landing" | "auth" | "creator";

export default function App() {
  // Public gift share page — no auth needed
  const giftMatch = window.location.pathname.match(/^\/gift\/([^/]+)/);
  if (giftMatch) {
    return <GiftPage shareId={giftMatch[1]} />;
  }

  const [auth, setAuth] = useState<AuthState | null>(() => {
    const saved = sessionStorage.getItem("lm_auth");
    return saved ? JSON.parse(saved) as AuthState : null;
  });
  const [view, setView] = useState<AppView>(auth ? "creator" : "landing");

  function handleAuth(token: string, phone: string, credits: number) {
    const state = { token, phone, credits };
    setAuth(state);
    sessionStorage.setItem("lm_auth", JSON.stringify(state));
    setView("creator");
  }

  function updateCredits(credits: number) {
    if (!auth) return;
    const updated = { ...auth, credits };
    setAuth(updated);
    sessionStorage.setItem("lm_auth", JSON.stringify(updated));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const externalId = params.get("ext") ?? sessionStorage.getItem("lm_pending_payment");
    if (!externalId || !auth) return;
    sessionStorage.removeItem("lm_pending_payment");
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
