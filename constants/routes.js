export const ROUTES = {
  HOME: '/pages/index/index',
  SEARCH: '/pages/search/search',
  MINE: '/pages/mine/mine',
  LOCAL: '/pages/local/local',
  SOURCE: '/pages/source/source',
  DOWNLOADS: '/pages/downloads/downloads',
  PLAYER: '/pages/player/player',
  SETTINGS: '/pages/settings/settings'
}

export const TAB_ROUTES = [
  ROUTES.HOME,
  ROUTES.SEARCH,
  ROUTES.MINE
]

export function normalizeRoute(route) {
  if (!route) {
    return ''
  }
  return route.startsWith('/') ? route : `/${route}`
}

export function isTabRoute(route) {
  return TAB_ROUTES.includes(normalizeRoute(route))
}

export function goToRoute(route) {
  const url = normalizeRoute(route)
  if (isTabRoute(url)) {
    uni.switchTab({ url })
    return
  }
  uni.navigateTo({ url })
}
