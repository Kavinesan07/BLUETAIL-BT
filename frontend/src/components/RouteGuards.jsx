import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Only logged-in users may see these pages
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Only logged-out users may see these pages (login, register)
export function GuestRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}

// Only admin users (role === 1) may see and access admin pages (e.g. Add Product)
export function AdminRoute() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 1) return <Navigate to="/" replace />;
  return <Outlet />;
}
