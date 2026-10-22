import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Meters from "./pages/Meters";
import MeterDetail from "./pages/MeterDetail";
import Tokens from "./pages/Tokens";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import Ussd from "./pages/Ussd";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route index element={<Overview />} />
                <Route path="meters" element={<Meters />} />
                <Route path="meters/:meterId" element={<MeterDetail />} />
                <Route path="tokens" element={<Tokens />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="reports" element={<Reports />} />
                <Route path="ussd" element={<Ussd />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
