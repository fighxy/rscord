import { useState } from "react";
import "../../../styles/theme.css";
import axios from "axios";
import { useAuth } from "../store";
import { Link } from "react-router-dom";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const setToken = useAuth((s) => s.setToken);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Регистрация пользователя
      await axios.post("http://127.0.0.1:14702/auth/register", {
        email, 
        display_name: displayName, 
        password 
      });
      
      // После успешной регистрации сразу выполняем вход
      const loginRes = await axios.post("http://127.0.0.1:14702/auth/login", { email, password });
      setToken(loginRes.data.access_token);
      window.location.replace("/");
    } catch (error) {
      console.error("Registration error:", error);
      alert("Ошибка при регистрации. Пожалуйста, попробуйте снова.");
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <form onSubmit={submit} style={{ display: "grid", gap: 8, width: 360 }}>
        <h1 className="brand-title">PIDORD</h1>
        <h3 style={{ margin: 0, color: "var(--text-500)" }}>Создать аккаунт</h3>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Имя пользователя" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Зарегистрироваться</button>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <span style={{ color: "var(--text-500)" }}>Уже есть аккаунт? </span>
          <Link to="/login" style={{ color: "var(--primary-500)" }}>Войти</Link>
        </div>
      </form>
    </div>
  );
}