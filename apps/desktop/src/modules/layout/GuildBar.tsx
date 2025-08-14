import { useAuth } from "../auth/store";
import { useNavigate } from "react-router-dom";
import { NotificationCenter } from "../notifications/components/NotificationCenter";
import { ConnectionStatus } from "../events/components/ConnectionStatus";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function GuildBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {/* Home Server */}
      <Button
        variant="ghost"
        size="icon"
        className="w-12 h-12 bg-discord-blurple hover:bg-blue-600 text-white rounded-full hover:scale-105 transition-all duration-200"
        title="Home"
      >
        🏠
      </Button>
      
      {/* Add Server */}
      <Button
        variant="ghost"
        size="icon"
        className="w-12 h-12 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full hover:scale-105 transition-all duration-200"
        title="New"
      >
        ＋
      </Button>
      
      {/* Separator */}
      <div className="w-8 h-px bg-gray-700 my-2"></div>
      
      {/* User Info and Controls */}
      <div className="mt-auto flex flex-col items-center space-y-3 pt-3 border-t border-gray-800">
        {user && (
          <div className="flex flex-col items-center space-y-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-discord-blurple text-white text-sm font-medium">
                {user.displayName?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="text-xs text-gray-400 text-center px-2 max-w-[3rem] truncate">
              {user.displayName}
            </div>
          </div>
        )}
        
        {/* Notification Center */}
        <div className="flex justify-center">
          <NotificationCenter />
        </div>
        
        {/* Connection Status */}
        <div className="flex justify-center">
          <ConnectionStatus />
        </div>
        
        {/* Logout Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="w-12 h-12 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-full hover:scale-105 transition-all duration-200 group"
          title="Выйти из аккаунта"
        >
          <span className="text-lg">🚪</span>
        </Button>
      </div>
    </>
  );
}


