import { api } from "./client";

const BASE = "/admin/vehicles";

export const getVehicles   = ()          => api.get(BASE + "/");
export const createVehicle = (data)      => api.post(BASE + "/", data);
export const updateVehicle = (id, data)  => api.put(`${BASE}/${id}`, data);
export const deleteVehicle = (id)        => api.delete(`${BASE}/${id}`);
