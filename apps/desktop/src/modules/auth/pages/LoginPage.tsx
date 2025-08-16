import { useState } from "react";
import "../../../styles/theme.css";
import { useAuth } from "../store";
import { authAPI } from "../api";
import { Link, useNavigate } from "react-router-dom";
import { AuthError } from "../components/AuthError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      
      // Сохраняем токен и пользователя
      setToken(response.access_token);
      
      // Получаем информацию о пользователе
      try {
        const userInfo = await authAPI.getCurrentUser();
        setUser({
          id: userInfo.id,
          email: userInfo.email,
          displayName: userInfo.display_name
        });
      } catch (userError) {
        console.warn("Не удалось получить информацию о пользователе:", userError);
        // Создаем базовую информацию о пользователе из email
        setUser({
          id: "temp-" + Date.now(),
          email: email,
          displayName: email.split('@')[0]
        });
      }
      
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.message || "Ошибка при входе. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid place-items-center h-screen bg-discord-darker">
      <form onSubmit={submit} className="grid gap-4 w-90 max-w-md p-8 bg-discord-dark rounded-lg border border-gray-700">
        <h1 className="text-3xl font-bold text-center text-white">RSCORD</h1>
        <h3 className="text-center text-gray-400 m-0">Войти в аккаунт</h3>
        
        <AuthError error={error} />
        
        <Input 
          placeholder="Email" 
          type="email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
        />
        <Input 
          placeholder="Пароль" 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
        />
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-discord-blurple hover:bg-blue-600 disabled:opacity-70"
        >
          {isLoading ? "Вход..." : "Войти"}
        </Button>
        <div className="text-center mt-2">
          <span className="text-gray-400">Нет аккаунта? </span>
          <Link to="/register" className="text-discord-blurple hover:text-blue-400">Зарегистрироваться</Link>
        </div>
      </form>
    </div>
  );
}


