import { useState } from "react";
import AuthGate from "./components/AuthGate.tsx";
import WizardShell from "./components/wizard/WizardShell.tsx";

interface AuthState {
  token: string;
  phone: string;
  credits: number;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const saved = sessionStorage.getItem("kreasi_auth");
    return saved ? JSON.parse(saved) as AuthState : null;
  });

  function handleAuth(token: string, phone: string, credits: number) {
    const state = { token, phone, credits };
    setAuth(state);
    sessionStorage.setItem("kreasi_auth", JSON.stringify(state));
  }

  function updateCredits(credits: number) {
    if (!auth) return;
    const updated = { ...auth, credits };
    setAuth(updated);
    sessionStorage.setItem("kreasi_auth", JSON.stringify(updated));
  }

  if (!auth) {
    return <AuthGate onAuth={handleAuth} />;
  }

  return (
    <WizardShell
      token={auth.token}
      phone={auth.phone}
      credits={auth.credits}
      onCreditsUpdate={updateCredits}
      onTopUp={() => {
        // TODO: open credits modal
        console.log("Top up credits");
      }}
    />
  );
}
