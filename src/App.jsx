import { Navigate, Route, Routes } from "react-router-dom"

import { AdminRoute } from "@/components/auth/admin-route"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminPage } from "@/pages/admin-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { LoginPage } from "@/pages/login-page"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
