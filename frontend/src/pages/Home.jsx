import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import { CATEGORIES, productService } from "../services/productService";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    productService
      .list()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, search, category]);

  return (
    <div className="app-shell">
      <div className="christmas-header">
        <video
          className="christmas-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          ref={(video) => {
            if (video) {
              video.muted = true;
              video.defaultMuted = true;
              const p = video.play();
              if (p !== undefined) {
                p.catch(() => {});
              }
            }
          }}
        >
          <source
            src="/Santa_sleigh_animation_in_winter_1080p.mp4"
            type="video/mp4"
          />
          Your browser does not support the video tag.
        </video>

        <div className="header-content">
          <Navbar />

          <section className="hero">
            <h1>Welcome to Winter and Summer</h1>
            <div className="search-wrap">
              <input
                className="search"
                type="search"
                placeholder="Search for products, brands..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search products"
              />
              <span className="search-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
            </div>
          </section>
        </div>
      </div>

      <main className="content wide">
        <div className="chips">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? "active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {loading && <p className="hint">Loading products...</p>}

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="empty">
            <h2>No products found</h2>
            <p>Try a different search or category.</p>
          </div>
        )}

        <div className="grid">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
