import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';
  showBorder?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showBorder = false, 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
    xxl: 'w-32 h-32',
    xxxl: 'w-40 h-40'
  };

  const borderStyle = showBorder ? {
    border: '2px solid var(--discord-blurple)'
  } : {};

  return (
    <div 
      className={`${sizeClasses[size]} rounded-lg shadow-lg ${className}`}
      style={{ 
        background: 'var(--background-primary)',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <img 
        src="/icons/icon.png" 
        alt="RSCord Logo" 
        className="w-full h-full object-contain"
        style={{ 
          filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))',
          ...borderStyle
        }}
        onError={(e) => {
          console.error('Failed to load logo:', e);
          // Fallback to text if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.textContent = 'RSCord';
          fallback.className = `text-2xl font-bold ${sizeClasses[size]} flex items-center justify-center`;
          fallback.style.color = 'var(--discord-blurple)';
          target.parentNode?.appendChild(fallback);
        }}
      />
    </div>
  );
};
