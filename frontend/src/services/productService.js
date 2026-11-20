import { api } from "./api";

export const productService = {
  list: (shopId) => api.get(shopId ? `/products?shop_id=${shopId}` : "/products"),
  myProducts: () => api.get("/products/my-products"),
  getMyShop: () => api.get("/shops/my-shop"),
  get: (id) => api.get(`/products/${id}`),
  // formData contains: name, price, category, stock, description, image (file)
  create: (formData) => api.post("/products", formData),
  update: (id, formData) => api.put(`/products/${id}`, formData),
  updateStock: (id, stock) => api.patch(`/products/${id}/stock`, { stock }),
  remove: (id) => api.delete(`/products/${id}`),
};

export const CATEGORIES = [
  "cars",
  "playstation",
  "books and comics",
  "jeserys",
  "anime",
];

export const formatPrice = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);