import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";


export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="topbar">
      <Link to="/" className="logo-brand" title="Bluetail Home">
        <img src="/logo.png" alt="Bluetail" className="logo-img" />
      </Link>

      <nav className="topbar-right">
        <NavLink to="/" end className="nav-link">Shop</NavLink>
        <NavLink to="/cart" className="nav-link">
          Cart{count > 0 && <span className="badge">{count}</span>}
        </NavLink>

        {isAuthenticated ? (
          <>
            <NavLink to="/orders" className="nav-link">My orders</NavLink>
            
            {/* Show "My Products" and "Add product" for Shop Owners (role 1) and Super Admin (role 2) */}
            {(user?.role === 1 || user?.role === 2) && (
              <>
                <NavLink to="/admin/products" className="nav-link">My Products</NavLink>
                <NavLink to="/admin/add-product" className="nav-link">Add product</NavLink>
              </>
            )}

            <Link to="/account" className="who nav-account" title="My Account">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.username} className="nav-avatar" />
              ) : (
                <span className="nav-avatar-fallback">
                  {user?.username?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
              <span className="nav-username">{user?.username}</span>
            </Link>
            <button className="ghost" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Log in</Link>
            <Link to="/register" className="ghost link-btn">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
