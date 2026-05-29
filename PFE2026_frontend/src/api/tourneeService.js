import { api } from "./client.js";

const generateAI = async (executionDate) => {
  const res = await api.post(
    "/admin/tournees/generate-ai",
    {},
    {
      timeout: 300000,
      params: { execution_date: executionDate },
    }
  );
  return res.data;
};

const getAll = async (executionDate) => {
  const res = await api.get("/admin/tournees/", {
    params: { execution_date: executionDate },
  });
  return res.data;
};

const getRestants = async (executionDate) => {
  const res = await api.get("/admin/tournees/restants", {
    params: { execution_date: executionDate },
  });
  return res.data;
};

const accept = async (id) => {
  const res = await api.post(`/admin/tournees/${id}/accept`);
  return res.data;
};

const refuse = async (id, reason = "Proposition non adaptée") => {
  const res = await api.post(`/admin/tournees/${id}/refuse`, {
    reason,
  });
  return res.data;
};

const getAccepted = async () => {
  const res = await api.get("/admin/tournees/accepted");
  return res.data;
};


export default {
  generateAI,
  getAll,
  getRestants,
  accept,
  refuse,
  getAccepted,
};
