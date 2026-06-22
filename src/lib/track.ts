const TRACKING_URL = 'https://luadepot-admin.vercel.app/api/track'

export function trackPageView(path: string) {
  try {
    fetch(TRACKING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        platform: 'app',
        user_agent: `LuaDepot-App`,
      }),
    })
  } catch {
    // silent fail
  }
}
