import { PropsWithChildren, useEffect } from "react";
import { useAuth } from "../store";

export function AuthGuard({ children }: PropsWithChildren) {
  const token = useAuth((s) => s.token);
  useEffect(() => {
    if (!token) {
      window.location.replace("/login");
    }
  }, [token]);
  if (!token) return null;
  return <>{children}</>;
}


