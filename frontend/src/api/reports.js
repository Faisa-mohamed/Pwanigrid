import api from "./client";
export const getHealth = async () => (await api.get("/api/health", { timeout: 5000 })).data;
export const getDashboard = async () => (await api.get("/api/dashboard")).data;
export const getReportSummary = async ({ from = "", to = "" } = {}) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return (await api.get("/api/reports/summary", { params })).data;
};
