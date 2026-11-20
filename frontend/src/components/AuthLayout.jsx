import { Link } from "react-router-dom";

export default function AuthLayout({ children }) {
  return (
    <main className="auth">
      <section className="brand">
        <Link to="/" className="brand-logo-link" title="Bluetail Home">
          <img src="/logo.png" alt="Bluetail" className="brand-logo-img" />
        </Link>
        <p>Your destination for top-quality toys, collectible cars, and seasonal favorites.</p>
      </section>
      <section className="panel">{children}</section>
    </main>
  );
}
