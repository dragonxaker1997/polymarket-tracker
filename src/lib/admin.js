const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase()

export function isAdminUser(email) {
  if (!adminEmail || !email) return false

  return email.trim().toLowerCase() === adminEmail
}
