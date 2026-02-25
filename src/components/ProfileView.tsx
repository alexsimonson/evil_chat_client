import { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import type { User } from "../types";

type ProfileViewProps = {
  userId: string;
  onClose: () => void;
};

export function ProfileView({ userId, onClose }: ProfileViewProps) {
  const { user: currentUser, setUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    loadProfile();
  }, [userId]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const { user } = await api.getUserProfile(userId);
      setProfile(user);
      setEditUsername(user.username);
      setEditDisplayName(user.displayName ?? "");
      setEditEmail(user.email);
    } catch (e: any) {
      setError(e?.message ?? "FAILED_TO_LOAD_PROFILE");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    
    setSaving(true);
    setError(null);
    try {
      const updates: any = {};
      if (editUsername !== profile.username) updates.username = editUsername;
      if (editDisplayName !== (profile.displayName ?? "")) updates.displayName = editDisplayName;
      if (editEmail !== profile.email) updates.email = editEmail;

      if (Object.keys(updates).length > 0) {
        const { user: updatedUser } = await api.updateProfile(updates);
        setProfile(updatedUser);
        setUser(updatedUser); // Update the global auth state
      }
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? "FAILED_TO_UPDATE_PROFILE");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (profile) {
      setEditUsername(profile.username);
      setEditDisplayName(profile.displayName ?? "");
      setEditEmail(profile.email);
    }
    setEditing(false);
    setError(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0 }}>User Profile</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "0",
              width: "32px",
              height: "32px",
              lineHeight: "32px",
            }}
          >
            ×
          </button>
        </div>

        {loading && <div>Loading profile...</div>}

        {error && (
          <div
            style={{
              color: "crimson",
              padding: "12px",
              backgroundColor: "rgba(220, 20, 60, 0.1)",
              borderRadius: "4px",
              fontSize: "0.9rem",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {profile && !loading && (
          <>
            {!editing ? (
              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: "4px", fontSize: "0.9rem", color: "#666" }}>
                    Username
                  </label>
                  <div style={{ fontSize: "1rem" }}>{profile.username}</div>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: "4px", fontSize: "0.9rem", color: "#666" }}>
                    Display Name
                  </label>
                  <div style={{ fontSize: "1rem" }}>{profile.displayName || <em style={{ color: "#999" }}>Not set</em>}</div>
                </div>

                {isOwnProfile && (
                  <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: "4px", fontSize: "0.9rem", color: "#666" }}>
                      Email
                    </label>
                    <div style={{ fontSize: "1rem" }}>{profile.email}</div>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: "4px", fontSize: "0.9rem", color: "#666" }}>
                    User ID
                  </label>
                  <div style={{ fontSize: "0.85rem", fontFamily: "monospace", color: "#666" }}>{profile.id}</div>
                </div>

                {isOwnProfile && (
                  <div style={{ marginTop: "8px" }}>
                    <button
                      onClick={() => setEditing(true)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        fontSize: "1rem",
                      }}
                    >
                      Edit Profile
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
                style={{ display: "grid", gap: "16px" }}
              >
                <div>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: "6px" }}>
                    Username
                  </label>
                  <input
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: "6px" }}>
                    Display Name
                  </label>
                  <input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    style={{ width: "100%" }}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 500, marginBottom: "6px" }}>
                    Email
                  </label>
                  <input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    type="email"
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "12px",
                      fontSize: "1rem",
                    }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "12px",
                      fontSize: "1rem",
                      backgroundColor: "#6c757d",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
