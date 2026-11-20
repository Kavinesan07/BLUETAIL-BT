import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { imageUrl } from "../services/api";
import { CATEGORIES, formatPrice, productService } from "../services/productService";

export default function MyProducts() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Search and stock filter
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  // Inline stock edit states: { [productId]: stockValue }
  const [stockEdits, setStockEdits] = useState({});
  const [savingStockId, setSavingStockId] = useState(null);

  // Edit Product Modal state
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    stock: "",
    category: "",
    description: "",
  });
  const [editFile, setEditFile] = useState(null);
  const [editPreview, setEditPreview] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // Deleting product state
  const [deletingId, setDeletingId] = useState(null);

  function notifySuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  // Load products and shop information
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    Promise.allSettled([
      productService.myProducts(),
      productService.getMyShop(),
    ])
      .then(([prodRes, shopRes]) => {
        if (!isMounted) return;

        if (prodRes.status === "fulfilled") {
          setProducts(prodRes.value || []);
        } else {
          setError(prodRes.reason?.message || "Failed to load products.");
        }

        if (shopRes.status === "fulfilled") {
          setShop(shopRes.value);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter products by search and stock filter
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q));

      let matchesStock = true;
      if (stockFilter === "in_stock") matchesStock = p.stock > 5;
      else if (stockFilter === "low_stock") matchesStock = p.stock > 0 && p.stock <= 5;
      else if (stockFilter === "out_of_stock") matchesStock = p.stock <= 0;

      return matchesSearch && matchesStock;
    });
  }, [products, search, stockFilter]);

  // Quick Inline Stock Update (PATCH /products/{id}/stock)
  async function handleUpdateStock(productId) {
    const newStock = stockEdits[productId];
    if (newStock === undefined || newStock === "") return;
    const num = Number(newStock);
    if (isNaN(num) || num < 0) {
      alert("Stock must be a non-negative number.");
      return;
    }

    setSavingStockId(productId);
    setError("");

    try {
      const updated = await productService.updateStock(productId, num);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: updated.stock } : p))
      );
      setStockEdits((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      notifySuccess(`Updated stock for "${updated.name}" to ${updated.stock}.`);
    } catch (err) {
      setError(err.message || "Failed to update stock.");
    } finally {
      setSavingStockId(null);
    }
  }

  // Delete product (DELETE /products/{id})
  async function handleDeleteProduct(p) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${p.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(p.id);
    setError("");

    try {
      await productService.remove(p.id);
      setProducts((prev) => prev.filter((item) => item.id !== p.id));
      notifySuccess(`Product "${p.name}" deleted successfully.`);
    } catch (err) {
      setError(err.message || "Failed to delete product.");
    } finally {
      setDeletingId(null);
    }
  }

  // Open Edit Modal
  function handleOpenEdit(p) {
    setEditingProduct(p);
    setEditForm({
      name: p.name || "",
      price: p.price ?? "",
      stock: p.stock ?? "",
      category: p.category || CATEGORIES[0],
      description: p.description || "",
    });
    setEditFile(null);
    setEditPreview(p.image_url ? imageUrl(p.image_url) : "");
    setEditError("");
  }

  function handleCloseEdit() {
    setEditingProduct(null);
    setEditFile(null);
    setEditPreview("");
    setEditError("");
  }

  function handleEditFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setEditError("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setEditError("Image file size must be less than 2 MB.");
      return;
    }
    setEditError("");
    setEditFile(file);
    setEditPreview(URL.createObjectURL(file));
  }

  // Submit Edit (PUT /products/{id})
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editForm.name.trim()) {
      setEditError("Product name is required.");
      return;
    }
    if (!(Number(editForm.price) > 0)) {
      setEditError("Price must be greater than 0.");
      return;
    }
    if (!(Number(editForm.stock) >= 0) || editForm.stock === "") {
      setEditError("Stock count cannot be negative.");
      return;
    }

    setEditSubmitting(true);
    setEditError("");

    try {
      const data = new FormData();
      data.append("name", editForm.name.trim());
      data.append("price", editForm.price);
      data.append("stock", editForm.stock);
      data.append("category", editForm.category);
      data.append("description", editForm.description.trim());
      if (editFile) {
        data.append("image", editFile);
      }

      const updated = await productService.update(editingProduct.id, data);
      setProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
      notifySuccess(`Product "${updated.name}" updated successfully.`);
      handleCloseEdit();
    } catch (err) {
      setEditError(err.message || "Failed to update product.");
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="content wide my-products-page">
        {/* Top Header Breadcrumb & Actions */}
        <div className="my-products-header">
          <div>
            <div className="header-badges">
              <span className="account-badge">Shop Management</span>
              <span className="role-tag">
                {user?.role === 2 ? "⚡ Super Admin View" : "🏪 Shop Owner"}
              </span>
            </div>
            <h1 className="page-title">My Products</h1>
            <p className="hint">
              Manage your shop's inventory, edit product details, adjust real-time stock, and remove items.
            </p>
          </div>

          <div className="header-cta-group">
            <Link to="/admin/add-product" className="primary link-btn">
              + Add New Product
            </Link>
          </div>
        </div>

        {/* Shop Overview Info Banner */}
        {shop && (
          <div className="shop-info-card">
            <div className="shop-info-left">
              <div className="shop-avatar-box">🏪</div>
              <div>
                <h2>{shop.name}</h2>
                <p className="shop-desc">{shop.description || "Active Shop on ShopNest"}</p>
                <div className="shop-meta-row">
                  <span>Shop ID: <strong>#{shop.id}</strong></span>
                  <span>Owner: <strong>{user?.username}</strong></span>
                  <span className="status-badge active">● Live</span>
                </div>
              </div>
            </div>

            <div className="shop-info-stats">
              <div className="stat-box">
                <span className="stat-num">{products.length}</span>
                <span className="stat-label">Total Products</span>
              </div>
              <div className="stat-box">
                <span className="stat-num">
                  {products.filter((p) => p.stock > 0).length}
                </span>
                <span className="stat-label">In Stock</span>
              </div>
              <div className="stat-box">
                <span className="stat-num text-danger">
                  {products.filter((p) => p.stock <= 0).length}
                </span>
                <span className="stat-label">Out of Stock</span>
              </div>
            </div>
          </div>
        )}

        {/* Success & Error Feedback Banners */}
        {successMsg && (
          <div className="feedback-banner success" role="status">
            ✅ {successMsg}
          </div>
        )}

        {error && (
          <div className="feedback-banner error" role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="inventory-toolbar">
          <div className="search-box">
            <span className="search-box-icon">🔍</span>
            <input
              type="search"
              placeholder="Filter by product name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter my products"
            />
          </div>

          <div className="filter-group">
            <span className="filter-label">Stock Status:</span>
            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip ${stockFilter === "all" ? "active" : ""}`}
                onClick={() => setStockFilter("all")}
              >
                All ({products.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${stockFilter === "in_stock" ? "active" : ""}`}
                onClick={() => setStockFilter("in_stock")}
              >
                In Stock ({products.filter((p) => p.stock > 5).length})
              </button>
              <button
                type="button"
                className={`filter-chip ${stockFilter === "low_stock" ? "active" : ""}`}
                onClick={() => setStockFilter("low_stock")}
              >
                Low Stock ({products.filter((p) => p.stock > 0 && p.stock <= 5).length})
              </button>
              <button
                type="button"
                className={`filter-chip ${stockFilter === "out_of_stock" ? "active" : ""}`}
                onClick={() => setStockFilter("out_of_stock")}
              >
                Out of Stock ({products.filter((p) => p.stock <= 0).length})
              </button>
            </div>
          </div>
        </div>

        {/* Products Content: Loading / Empty / Table & Cards */}
        {loading ? (
          <div className="inventory-loading">
            <p>Loading your products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="inventory-empty">
            <div className="empty-icon">📦</div>
            <h3>
              {products.length === 0
                ? "No products in your shop yet"
                : "No products match your filter criteria"}
            </h3>
            <p className="hint">
              {products.length === 0
                ? "Get started by adding your first product to start selling on ShopNest."
                : "Try clearing your search query or changing the stock filter."}
            </p>
            {products.length === 0 ? (
              <Link to="/admin/add-product" className="primary link-btn">
                + Add Your First Product
              </Link>
            ) : (
              <button
                type="button"
                className="ghost dark small"
                onClick={() => {
                  setSearch("");
                  setStockFilter("all");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th style={{ width: "80px" }}>Image</th>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th style={{ minWidth: "220px" }}>Stock & Quick Update</th>
                  <th style={{ textAlign: "right", minWidth: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = p.stock > 0 && p.stock <= 5;
                  const draftStock = stockEdits[p.id] !== undefined ? stockEdits[p.id] : p.stock;
                  const isSavingStock = savingStockId === p.id;
                  const isDeleting = deletingId === p.id;

                  return (
                    <tr key={p.id}>
                      {/* Product Thumbnail */}
                      <td>
                        <Link to={`/product/${p.id}`} className="table-thumb-link">
                          {p.image_url ? (
                            <img
                              src={imageUrl(p.image_url)}
                              alt={p.name}
                              className="table-thumb"
                            />
                          ) : (
                            <span className="table-thumb-placeholder">🚗</span>
                          )}
                        </Link>
                      </td>

                      {/* Product Details */}
                      <td>
                        <Link to={`/product/${p.id}`} className="product-table-title">
                          {p.name}
                        </Link>
                        <p className="product-table-desc">
                          {p.description ? p.description.slice(0, 90) + (p.description.length > 90 ? "..." : "") : "No description provided."}
                        </p>
                        <span className="product-id-tag">ID: #{p.id}</span>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="category-tag">{p.category}</span>
                      </td>

                      {/* Price */}
                      <td>
                        <span className="product-table-price">{formatPrice(p.price)}</span>
                      </td>

                      {/* Stock & Quick Update */}
                      <td>
                        <div className="stock-cell">
                          <span
                            className={`stock-indicator-badge ${
                              isOutOfStock
                                ? "out"
                                : isLowStock
                                ? "low"
                                : "in"
                            }`}
                          >
                            {isOutOfStock
                              ? "Out of Stock"
                              : isLowStock
                              ? `Low Stock (${p.stock})`
                              : `In Stock (${p.stock})`}
                          </span>

                          <div className="quick-stock-form">
                            <input
                              type="number"
                              min="0"
                              className="stock-input"
                              value={draftStock}
                              onChange={(e) =>
                                setStockEdits((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value,
                                }))
                              }
                              aria-label={`Update stock for ${p.name}`}
                            />
                            <button
                              type="button"
                              className="stock-save-btn"
                              disabled={isSavingStock || String(draftStock) === String(p.stock)}
                              onClick={() => handleUpdateStock(p.id)}
                              title="Save stock change"
                            >
                              {isSavingStock ? "..." : "Update"}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Action Buttons: Edit & Delete */}
                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions-row">
                          <button
                            type="button"
                            className="btn-action edit"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit product details"
                          >
                            ✏️ Edit
                          </button>

                          <button
                            type="button"
                            className="btn-action delete"
                            disabled={isDeleting}
                            onClick={() => handleDeleteProduct(p)}
                            title="Delete product"
                          >
                            {isDeleting ? "Deleting..." : "🗑️ Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="modal-backdrop" onClick={handleCloseEdit}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div>
                <span className="account-badge">Edit Product</span>
                <h2 id="modal-title" className="modal-title">
                  Edit "{editingProduct.name}"
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseEdit}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {editError && <div className="feedback-banner error">{editError}</div>}

            <form onSubmit={handleSaveEdit} className="modal-form">
              <div className="field">
                <label htmlFor="edit-name">Product Name *</label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="row-2">
                <div className="field">
                  <label htmlFor="edit-price">Price (₹) *</label>
                  <input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-stock">Stock Level *</label>
                  <input
                    id="edit-stock"
                    type="number"
                    min="0"
                    required
                    value={editForm.stock}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, stock: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="edit-category">Category *</label>
                <select
                  id="edit-category"
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="edit-description">Description</label>
                <textarea
                  id="edit-description"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="edit-image">Product Image (optional replacement)</label>
                <input
                  id="edit-image"
                  type="file"
                  accept="image/*"
                  onChange={handleEditFileChange}
                />
                {editPreview && (
                  <div className="edit-image-preview-box">
                    <img
                      src={editPreview}
                      alt="Preview"
                      className="edit-image-preview"
                    />
                    <span className="hint">
                      {editFile ? "New image selected" : "Current image"}
                    </span>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost dark"
                  onClick={handleCloseEdit}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? "Saving Changes..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
