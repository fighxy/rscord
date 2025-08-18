import React from 'react';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  variant?: 'default' | 'minimal' | 'floating' | 'sidebar';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'default', 
  size = 'md',
  showLabel = false,
  className = ''
}) => {
  const { theme, setTheme, effectiveTheme } = useTheme();

  const themes = [
    { key: 'light' as const, icon: Sun, label: 'Светлая' },
    { key: 'dark' as const, icon: Moon, label: 'Темная' },
    { key: 'system' as const, icon: Monitor, label: 'Система' }
  ];

  const currentThemeIndex = themes.findIndex(t => t.key === theme);
  const nextTheme = themes[(currentThemeIndex + 1) % themes.length];

  const handleToggle = () => {
    setTheme(nextTheme.key);
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  // Icon size classes
  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  if (variant === 'minimal') {
    const CurrentIcon = themes.find(t => t.key === theme)?.icon || Monitor;
    
    return (
      <button
        onClick={handleToggle}
        className={`
          ${sizeClasses[size]}
          relative inline-flex items-center justify-center
          rounded-lg
          bg-white/5 backdrop-blur-sm
          border border-white/10
          text-gray-300 hover:text-white
          transition-all duration-300 ease-out
          hover:bg-white/10 hover:border-white/20
          hover:scale-105 active:scale-95
          group
          ${className}
        `}
        title={`Текущая тема: ${themes.find(t => t.key === theme)?.label}. Переключить на: ${nextTheme.label}`}
      >
        <CurrentIcon className={`${iconSizeClasses[size]} transition-transform duration-300 group-hover:rotate-12`} />
        
        {/* Гlow effect */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
      </button>
    );
  }

  if (variant === 'floating') {
    const CurrentIcon = themes.find(t => t.key === theme)?.icon || Monitor;
    
    return (
      <div className={`fixed top-4 right-4 z-50 ${className}`}>
        <button
          onClick={handleToggle}
          className={`
            ${sizeClasses[size]}
            relative inline-flex items-center justify-center
            rounded-full
            bg-black/20 backdrop-blur-md
            border border-white/10
            text-white/80 hover:text-white
            transition-all duration-500 ease-out
            hover:bg-white/10 hover:border-white/20
            hover:scale-110 active:scale-95
            shadow-lg hover:shadow-xl
            group
          `}
          title={`Переключить тему`}
        >
          <CurrentIcon className={`${iconSizeClasses[size]} transition-all duration-300 group-hover:rotate-180`} />
          
          {/* Animated ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-border opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0.5 rounded-full bg-black/40 backdrop-blur-md" />
          <CurrentIcon className={`${iconSizeClasses[size]} relative z-10 transition-all duration-300 group-hover:rotate-180`} />
        </button>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={`flex items-center gap-2 p-2 ${className}`}>
        <Palette className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-300 flex-1">Тема</span>
        <div className="flex items-center gap-1">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            const isActive = theme === themeOption.key;
            
            return (
              <button
                key={themeOption.key}
                onClick={() => setTheme(themeOption.key)}
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center
                  transition-all duration-300
                  ${isActive 
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30' 
                    : 'bg-white/5 text-gray-400 hover:text-gray-300 hover:bg-white/10 border border-transparent'
                  }
                `}
                title={themeOption.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Default variant - dropdown style
  const CurrentIcon = themes.find(t => t.key === theme)?.icon || Monitor;
  
  return (
    <div className={`relative group ${className}`}>
      <button
        onClick={handleToggle}
        className={`
          ${sizeClasses[size]}
          relative inline-flex items-center justify-center
          rounded-lg
          bg-white/10 backdrop-blur-sm
          border border-white/20
          text-gray-200 hover:text-white
          transition-all duration-300 ease-out
          hover:bg-white/20 hover:border-white/30
          hover:scale-105 active:scale-95
          shadow-lg hover:shadow-xl
          group
        `}
        title={`Тема: ${themes.find(t => t.key === theme)?.label}`}
      >
        <CurrentIcon className={`${iconSizeClasses[size]} transition-transform duration-300 group-hover:rotate-12`} />
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </button>

      {showLabel && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          {themes.find(t => t.key === theme)?.label}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;