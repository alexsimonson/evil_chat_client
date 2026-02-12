import { useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./pages/AppShell";

export default function App() {
  const { state } = useAuth();

  if (state.status === "loading") return <div style={{ padding: 20 }}>Loading...</div>;
  if (state.status === "anon") return <LoginPage />;

  return <AppShell />;
}
