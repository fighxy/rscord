interface AuthErrorProps {
  error: string;
}

export function AuthError({ error }: AuthErrorProps) {
  if (!error) return null;

  return (
    <div className="p-3 mb-2 bg-red-900/20 border border-red-800 text-red-300 rounded-md text-sm">
      {error}
    </div>
  );
}
