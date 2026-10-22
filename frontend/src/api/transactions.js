import api from "./client";
export async function listTransactions({ search = "", status = "" } = {}) {
  const params = {};
  if (search.trim()) params.search = search.trim();
  if (status) params.status = status;
  return (await api.get("/api/transactions", { params })).data;
}
