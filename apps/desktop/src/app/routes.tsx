import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LoginPage from "../modules/auth/pages/LoginPage";
import HomePage from "../modules/home/HomePage";
import { AuthGuard } from "../modules/auth/guards/AuthGuard";

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/", element: <AuthGuard><HomePage /></AuthGuard> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}


