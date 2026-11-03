import { Link } from "react-router-dom";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-col brand-col">
          <Link to="/" className="footer-logo">
            Bluetail
          </Link>
          <p className="footer-desc">
            Your destination for top-quality toys, collectible cars, and summer & winter favorites. Premium products, hassle-free shopping, and reliable delivery.
          </p>
          <div className="footer-badges">
            <span className="footer-badge">🚚 Fast Nationwide Shipping</span>
            <span className="footer-badge">🔒 100% Secure Checkout</span>
            <span className="footer-badge">✨ Quality Guaranteed</span>
          </div>
        </div>

        <div className="footer-col">
          <h3>Quick Links</h3>
          <ul className="footer-links">
            <li><Link to="/">Shop Catalog</Link></li>
            <li><Link to="/cart">Shopping Cart</Link></li>
            <li><Link to="/orders">My Orders</Link></li>
            <li><Link to="/address">Saved Addresses</Link></li>
            <li><Link to="/account">My Account</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Customer Support</h3>
          <ul className="footer-links">
            <li><a href="#help" onClick={(e) => e.preventDefault()}>Help & FAQ</a></li>
            <li><a href="#tracking" onClick={(e) => e.preventDefault()}>Track Shipment</a></li>
            <li><a href="#returns" onClick={(e) => e.preventDefault()}>Returns & Refunds</a></li>
            <li><a href="#support" onClick={(e) => e.preventDefault()}>Customer Service</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Contact Us</h3>
          <p className="footer-contact-item">📧 <strong>Email:</strong> support@bluetail.com</p>
          <p className="footer-contact-item">📞 <strong>Phone:</strong> +91 8760129697</p>
          <p className="footer-contact-item">📍 <strong>Location:</strong> theni, India</p>
          <p className="footer-hours">🕒 Mon - Sat: 9:00 AM – 7:00 PM IST</p>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <p>© {currentYear} Bluetail Inc. All rights reserved.</p>
          <div className="footer-legal">
            <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <span>•</span>
            <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            <span>•</span>
            <a href="#cookies" onClick={(e) => e.preventDefault()}>Cookie Preferences</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

