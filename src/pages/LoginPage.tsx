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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      backgroundColor: "inherit",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "420px",
        fontFamily: "system-ui",
      }}>
        <h1 style={{ textAlign: "center", margin: "0 0 8px 0" }}>evil_chat_dev</h1>
        <p style={{ opacity: 0.8, textAlign: "center", marginBottom: "32px" }}>
          Login to test the MVP.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ marginBottom: "6px", fontWeight: 500 }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ marginBottom: "6px", fontWeight: 500 }}>
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </div>

          {err && (
            <div style={{
              color: "crimson",
              padding: "12px",
              backgroundColor: "rgba(220, 20, 60, 0.1)",
              borderRadius: "4px",
              fontSize: "0.9rem",
            }}>
              {err}
            </div>
          )}

          <button
            disabled={busy}
            style={{
              padding: "12px",
              fontSize: "1rem",
              minHeight: "44px",
            }}
          >
            {busy ? "Logging in..." : "Login"}
          </button>
        </form>

        <style>{`
          @media (max-width: 480px) {
            div {
              padding: 10px;
            }
            form {
              gap: 12px;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
