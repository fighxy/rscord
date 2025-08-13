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
                border: "0.5px solid var(--border-200)",
                color: "var(--text-400)",
                cursor: "pointer",
                padding: "8px 12px",
                borderRadius: "0px",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.2s ease",
                minWidth: "60px"
              }}
              title="Выйти из аккаунта"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-600)";
                e.currentTarget.style.borderColor = "var(--border-300)";
                e.currentTarget.style.color = "var(--text-300)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = "var(--border-200)";
                e.currentTarget.style.color = "var(--text-400)";
              }}
            >
              <span style={{ fontSize: "16px" }}>🚪</span>
              <span style={{ fontSize: "10px", lineHeight: "1" }}>Выйти</span>
            </button>
      </div>
    </>
  );
}


