import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("alex@test.com");
  const [password, setPassword] = useState("password");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setErr(e?.message ?? "LOGIN_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1>evil_chat_dev</h1>
      <p style={{ opacity: 0.8 }}>Login to test the MVP.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 8 }}
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 8 }}
            type="password"
            autoComplete="current-password"
          />
        </label>

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button disabled={busy} style={{ padding: 10 }}>
          {busy ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
