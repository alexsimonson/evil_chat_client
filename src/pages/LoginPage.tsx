import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api";

export function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("alex@test.com");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("password");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        // Signup
        const { user } = await api.signup(email, username, password);
        // After signup, log them in automatically
        await login(email, password);
      }
    } catch (e: any) {
      setErr(e?.message ?? (mode === "login" ? "LOGIN_FAILED" : "SIGNUP_FAILED"));
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

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
          {isSignup ? "Create your account" : "Login to test the MVP."}
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

          {isSignup && (
            <div>
              <label style={{ marginBottom: "6px", fontWeight: 500 }}>
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          )}

          <div>
            <label style={{ marginBottom: "6px", fontWeight: 500 }}>
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
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
            {busy 
              ? (isSignup ? "Creating account..." : "Logging in...") 
              : (isSignup ? "Sign Up" : "Login")
            }
          </button>

          <div style={{ textAlign: "center", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? "login" : "signup");
                setErr(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#007bff",
                cursor: "pointer",
                textDecoration: "underline",
                fontSize: "0.9rem",
                padding: "4px",
              }}
            >
              {isSignup 
                ? "Already have an account? Login" 
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
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
