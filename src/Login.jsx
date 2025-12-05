// src/Login.jsx
import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

export default function Login({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const auth = getAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pwd);
      onSignedIn?.();
    } catch (e) {
      const code = String(e?.code || e?.message || "");
      let msg = "Erreur de connexion.";
      if (code.includes("auth/invalid-email")) msg = "Adresse courriel invalide.";
      else if (code.includes("auth/user-not-found") || code.includes("auth/wrong-password"))
        msg = "Courriel ou mot de passe invalide.";
      else if (code.includes("auth/too-many-requests"))
        msg = "Trop d'essais. Réessayez plus tard.";
      else if (code.includes("auth/operation-not-allowed"))
        msg = "Méthode de connexion désactivée (Email/Password).";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2 className="login-title">Connexion</h2>

        <input
          type="email"
          placeholder="courriel"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          className="login-input"
          autoComplete="email"
          required
        />

        <input
          type="password"
          placeholder="mot de passe"
          value={pwd}
          onChange={(e)=>setPwd(e.target.value)}
          className="login-input"
          autoComplete="current-password"
          required
        />

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        {err && <div className="login-error">Firebase: {err}</div>}
      </form>
    </div>
  );
}
