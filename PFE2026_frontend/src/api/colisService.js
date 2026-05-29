import { api } from "./client.js";

const colisService = {
  getAll: async () => (await api.get("/colis")).data,
  getOne: async (id) => (await api.get(`/colis/${id}`)).data,
  getNotifications: async () => (await api.get("/colis/notifications")).data,
  markNotificationRead: async (id) => (await api.post(`/colis/notifications/${id}/read`)).data,
  markAllNotificationsRead: async () => (await api.post("/colis/notifications/read-all")).data,
  create: async (payload) => (await api.post("/colis", payload)).data,
  update: async (id, payload) => (await api.put(`/colis/${id}`, payload)).data,

  // ✅ le nom utilisé dans Dashboard.jsx
  delete: async (id) => (await api.delete(`/colis/${id}`)).data,
};

// alias optionnel si un autre fichier utilise remove
colisService.remove = colisService.delete;

export default colisService;
