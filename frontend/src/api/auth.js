import api from "./client";

export async function loginRequest(username, password) {
  const res = await api.post("/api/auth/login", { username, password });
  return res.data; // { token, username }
}

export async function meRequest() {
  const res = await api.get("/api/auth/me");
  return res.data; // { username, role }
}
