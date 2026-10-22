import api from "./client";

const enc = encodeURIComponent;

export async function listMeters({ search = "", status = "" } = {}) {
  const params = {};
  if (search.trim()) params.search = search.trim();
  if (status) params.status = status;
  return (await api.get("/api/meters", { params })).data;
}

export const getMeter = async (meterId) => (await api.get(`/api/meters/${enc(meterId)}`)).data;

export const registerMeter = async (name, location) =>
  (await api.post("/api/meters", { name, location })).data;

export const setMeterStatus = async (meterId, status) =>
  (await api.patch(`/api/meters/${enc(meterId)}/status`, { status })).data;

export const getMeterHistory = async (meterId) =>
  (await api.get(`/api/meters/${enc(meterId)}/history`)).data; // { tokens, transactions }
