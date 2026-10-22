import api from "./client";
export async function listTokens({ search = "", status = "" } = {}) {
  const params = {};
  if (search.trim()) params.search = search.trim();
  if (status) params.status = status;
  return (await api.get("/api/tokens", { params })).data;
}
export async function createToken(payload) { return (await api.post("/api/tokens", payload)).data; }
export async function revokeToken(tokenId) { return (await api.post(`/api/tokens/${encodeURIComponent(tokenId)}/revoke`)).data; }
