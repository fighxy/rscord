interface AuthErrorProps {
  error: string;
}

export function AuthError({ error }: AuthErrorProps) {
  if (!error) return null;

  return (
    <div style={{ 
      padding: "8px 12px", 
      backgroundColor: "var(--error-100)", 
      color: "var(--error-600)",
      borderRadius: "4px",
      fontSize: "14px",
      marginBottom: "8px"
    }}>
      {error}
    </div>
  );
}
