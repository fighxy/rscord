import { useState } from "react";
import "../../../styles/theme.css";
import { useAuth } from "../store";
import { authAPI } from "../api";
import { Link, useNavigate } from "react-router-dom";
import { AuthError } from "../components/AuthError";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    if (!email || !password) {
      setError("Все поля обязательны для заполнения");
      return false;
    }
    
    if (!email.includes('@')) {
      setError("Введите корректный email");
      return false;
    }
    
    return true;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await authAPI.login({ email, password });
      
      // Сохраняем токен
      setToken(response.access_token);
      
      // Получаем информацию о пользователе
      const userInfo = await authAPI.getCurrentUser();
      setUser({
        id: userInfo.id,
        email: userInfo.email,
        displayName: userInfo.display_name
      });
      
      navigate("/");
    } catch (error: any) {
      setError(error.message || "Ошибка при входе. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <form onSubmit={submit} style={{ display: "grid", gap: 8, width: 360 }}>
        <h1 className="brand-title">PIDORD</h1>
        <h3 style={{ margin: 0, color: "var(--text-500)" }}>Войти в аккаунт</h3>
        
        <AuthError error={error} />
        
        <input 
          placeholder="Email" 
          type="email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <input 
          placeholder="Пароль" 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.7 : 1 }}
        >
          {isLoading ? "Вход..." : "Войти"}
        </button>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <span style={{ color: "var(--text-500)" }}>Нет аккаунта? </span>
          <Link to="/register" style={{ color: "var(--primary-500)" }}>Зарегистрироваться</Link>
        </div>
      </form>
    </div>
  );
}


