export const PLAN_CAPABILITIES = {
  base: {
    maxMembers: 1,
    maxWalletsPerUser: 1,
    maxTradesPerUser: 3,
    canCreateWallets: false,
    teamMode: false,
  },
  pro: {
    maxMembers: 1,
    maxWalletsPerUser: 10,
    maxTradesPerUser: null,
    canCreateWallets: true,
    teamMode: false,
  },
  team: {
    maxMembers: 5,
    maxWalletsPerUser: 30,
    maxTradesPerUser: null,
    canCreateWallets: true,
    teamMode: true,
  },
  enterprise: {
    maxMembers: 20,
    maxWalletsPerUser: 100,
    maxTradesPerUser: null,
    canCreateWallets: true,
    teamMode: true,
  },
}

export function getPlanCapabilities(plan) {
  return PLAN_CAPABILITIES[plan] ?? PLAN_CAPABILITIES.base
}
