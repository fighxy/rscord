import { AlertCircle } from "lucide-react";

interface AuthErrorProps {
  error: string;
}

export function AuthError({ error }: AuthErrorProps) {
  if (!error) return null;

  return (
    <div className="flex items-start gap-2 p-3 rounded-md text-sm"
         style={{ 
           backgroundColor: 'rgba(237, 66, 69, 0.1)',
           border: '1px solid rgba(237, 66, 69, 0.3)',
           color: '#f38688'
         }}>
      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
}