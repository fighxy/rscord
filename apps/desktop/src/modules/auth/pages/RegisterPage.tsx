import { useState } from "react";
import "../../../styles/theme.css";
import { useAuth } from "../store";
import { authAPI } from "../api";
import { Link, useNavigate } from "react-router-dom";
import { AuthError } from "../components/AuthError";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    if (!email || !displayName || !password || !confirmPassword) {
      setError("Все поля обязательны для заполнения");
      return false;
    }
    
    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return false;
    }
    
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
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
      // Регистрация пользователя
      const registerResponse = await authAPI.register({
        email,
        display_name: displayName,
        password
      });
      
      // После успешной регистрации сразу выполняем вход
      const loginResponse = await authAPI.login({ email, password });
      
      // Сохраняем токен и информацию о пользователе
      setToken(loginResponse.access_token);
      setUser({
        id: registerResponse.user.id,
        email: registerResponse.user.email,
        displayName: registerResponse.user.display_name
      });
      
      // Перенаправляем на главную страницу
      navigate("/");
    } catch (error: any) {
      setError(error.message || "Ошибка при регистрации. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <form onSubmit={submit} style={{ display: "grid", gap: 8, width: 360 }}>
        <h1 className="brand-title">PIDORD</h1>
        <h3 style={{ margin: 0, color: "var(--text-500)" }}>Создать аккаунт</h3>
        
        <AuthError error={error} />
        
        <input 
          placeholder="Email" 
          type="email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <input 
          placeholder="Имя пользователя" 
          value={displayName} 
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={isLoading}
        />
        <input 
          placeholder="Пароль" 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />
        <input 
          placeholder="Подтвердите пароль" 
          type="password" 
          value={confirmPassword} 
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.7 : 1 }}
        >
          {isLoading ? "Регистрация..." : "Зарегистрироваться"}
        </button>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <span style={{ color: "var(--text-500)" }}>Уже есть аккаунт? </span>
          <Link to="/login" style={{ color: "var(--primary-500)" }}>Войти</Link>
        </div>
      </form>
    </div>
  );
}