import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RequireAdminAuth() {
  const location = useLocation();
  const hasToken =
    typeof window !== "undefined" &&
    Boolean(window.localStorage.getItem("admin_access_token"));

  if (!hasToken) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/admin/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
