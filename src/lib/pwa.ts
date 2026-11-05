/** Register the BeyondSAT service worker (browser only). */
export function registerPwa(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  /* A worker left over from an earlier visit serves cached /src/styles.css and
     the landing redesign never appears. Dev always reads from Vite. */
  if (import.meta.env.DEV) {
    void (async () => {
      const hadController = navigator.serviceWorker.controller != null;
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if (hadController && sessionStorage.getItem("bs-dev-sw-cleared") !== "1") {
        sessionStorage.setItem("bs-dev-sw-cleared", "1");
        window.location.reload();
      }
    })();
    return;
  }

  const register = () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[pwa] service worker registration failed", err);
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
