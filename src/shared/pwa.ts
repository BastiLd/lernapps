// Registers the service worker (production only) so the apps work offline and can be installed.
export async function registerPWA(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  } catch {
    // Offline support is a bonus — the site works without it.
  }
}
