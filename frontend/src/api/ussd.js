import api from "./client";
export async function getUssdStatus() { return (await api.get("/api/ussd/admin/status")).data; }
export async function listUssdPurchases(status = "") { return (await api.get("/api/ussd/admin/purchases", { params: status ? { status } : {} })).data; }
export async function listUssdActivity() { return (await api.get("/api/ussd/admin/activity")).data; }
export async function authorizeUssdCustomer(phone, meterId) { return (await api.post("/api/ussd/admin/customers", { phone, meterId })).data; }
