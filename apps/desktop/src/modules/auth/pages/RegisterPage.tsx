import { useState } from "react";
import "../../../styles/theme.css";
import { useAuth } from "../store";
import { authAPI } from "../api";
import { Link, useNavigate } from "react-router-dom";
import { AuthError } from "../components/AuthError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="grid place-items-center h-screen bg-discord-darker">
      <form onSubmit={submit} className="grid gap-4 w-90 max-w-md p-8 bg-discord-dark rounded-lg border border-gray-700">
        <h1 className="text-3xl font-bold text-center text-white">RSCORD</h1>
        <h3 className="text-center text-gray-400 m-0">Создать аккаунт</h3>
        
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
          placeholder="Имя пользователя" 
          value={displayName} 
          onChange={(e) => setDisplayName(e.target.value)}
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
        <Input 
          placeholder="Подтвердите пароль" 
          type="password" 
          value={confirmPassword} 
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-discord-blurple focus:border-transparent"
        />
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-discord-blurple hover:bg-blue-600 disabled:opacity-70"
        >
          {isLoading ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
        <div className="text-center mt-2">
          <span className="text-gray-400">Уже есть аккаунт? </span>
          <Link to="/login" className="text-discord-blurple hover:text-blue-400">Войти</Link>
        </div>
      </form>
    </div>
  );
}