import { Navigate, Route, Routes } from "react-router-dom"

import { AdminRoute } from "@/components/auth/admin-route"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminPage } from "@/pages/admin-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { InviteAcceptPage } from "@/pages/invite-accept-page"
import { LoginPage } from "@/pages/login-page"
import { SettingsPage } from "@/pages/settings-page"
import { UpgradePage } from "@/pages/upgrade-page"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/upgrade" element={<UpgradePage />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
