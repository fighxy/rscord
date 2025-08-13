import { useAuth } from "../auth/store";
import { useNavigate } from "react-router-dom";
import { NotificationCenter } from "../notifications/components/NotificationCenter";
import { ConnectionStatus } from "../events/components/ConnectionStatus";

export function GuildBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <div className="guild-pill" title="Home">🏠</div>
      <div className="guild-pill" title="New">＋</div>
      
      {/* Информация о пользователе и кнопка выхода */}
      <div style={{ 
        marginTop: "auto", 
        padding: "8px", 
        borderTop: "1px solid var(--border-200)",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
                     {user && (
               <div style={{
                 fontSize: "12px",
                 color: "var(--text-500)",
                 textAlign: "center",
                 padding: "4px"
               }}>
                 {user.displayName}
               </div>
             )}
             
             {/* Центр уведомлений */}
             <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
               <NotificationCenter />
             </div>
             
             {/* Статус подключения */}
             <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
               <ConnectionStatus />
             </div>
             
             <button
               onClick={handleLogout}
               style={{
                 background: "none",
                 border: "none",
                 color: "var(--text-400)",
                 cursor: "pointer",
                 padding: "4px 8px",
                 borderRadius: "4px",
                 fontSize: "12px"
               }}
               title="Выйти"
             >
               🚪
             </button>
      </div>
    </>
  );
}


