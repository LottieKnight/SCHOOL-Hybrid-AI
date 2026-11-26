"use client";


import { useAuth } from "../hooks/useAuth";

export default function Home() {
  const { user, login, logout } = useAuth();

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-bg)",
      color: "var(--color-text)"
    }}>
      <div className="glass-card">
        <h1 style={{ color: "var(--color-primary)", fontSize: "2rem", marginBottom: "1rem" }}>
          Welcome to SCHOOL Academic Platform
        </h1>
        <p style={{ marginBottom: "1rem" }}>
          This is the new premium UI built with vanilla CSS, dark mode, and glassmorphism.
        </p>
        <a href="/gradebook" className="glass-card" style={{ display: "inline-block", padding: "0.5rem 1rem", color: "var(--color-secondary)" }}>
          Go to Real‑time Gradebook
        </a>
        <div style={{ marginTop: "1rem" }}>
          {user ? (
            <>
              <p>Logged in as {user.name}</p>
              <button onClick={logout} style={{ marginTop: "0.5rem" }}>Logout</button>
            </>
          ) : (
            <button onClick={login}>Login (Mock)</button>
          )}
        </div>
      </div>
    </div>
  );
}
