import { api } from "./api";

export const orderService = {
  // POST /orders/create  (body: user_id, address_id, items)
  create: (data) => api.post("/orders/create", data),

  // GET /orders?user_id=2  (all orders of one user) or GET /orders (all orders)
  list: (userId) => api.get(`/orders${userId ? `?user_id=${userId}` : ""}`),

  // GET /orders/5  (one order with its items and address)
  get: (id) => api.get(`/orders/${id}`),
};