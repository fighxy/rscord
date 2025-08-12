import { useState } from "react";
import "../../../styles/theme.css";
import axios from "axios";
import { useAuth } from "../store";
import { Link } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const setToken = useAuth((s) => s.setToken);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await axios.post("http://127.0.0.1:14702/auth/login", { email, password });
    setToken(res.data.access_token);
    window.location.replace("/");
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <form onSubmit={submit} style={{ display: "grid", gap: 8, width: 360 }}>
        <h1 className="brand-title">PIDORD</h1>
        <h3 style={{ margin: 0, color: "var(--text-500)" }}>Sign in to continue</h3>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Login</button>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <span style={{ color: "var(--text-500)" }}>Нет аккаунта? </span>
          <Link to="/register" style={{ color: "var(--primary-500)" }}>Зарегистрироваться</Link>
        </div>
      </form>
    </div>
  );
}


