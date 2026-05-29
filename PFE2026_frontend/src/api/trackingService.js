import { api } from "./client.js";

const getLive = async () => {
  const res = await api.get("/admin/tracking/live");
  return res.data;
};

const getLiveLocations = getLive;

const getCourierPoints = async (courierId, { tourneeId = null, limit = 400 } = {}) => {
  const params = { limit };

  if (tourneeId !== null && tourneeId !== undefined && tourneeId !== "") {
    params.tournee_id = tourneeId;
  }

  const res = await api.get(`/admin/tracking/couriers/${courierId}/points`, {
    params,
  });
  return res.data;
};

export default {
  getLive,
  getLiveLocations,
  getCourierPoints,
};
