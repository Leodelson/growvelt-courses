/** Runs in the document head before theme styles and the React app. */
export const launchBootstrap = `(() => {
  const root = document.documentElement;
  let resolvedTheme = "light";
  try {
    const stored = localStorage.getItem("growvelt-learning-theme");
    const theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
    resolvedTheme = theme === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
  } catch (_) {}

  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", resolvedTheme === "dark" ? "#090d18" : "#f8fafc");

  const standalone = matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true);
  const url = new URL(location.href);
  const queryStartedAt = Number(url.searchParams.get("__gwlaunch"));
  let startedAt = 0;
  try {
    startedAt = Number(sessionStorage.getItem("growvelt-learning-launch-at")) || 0;
    sessionStorage.removeItem("growvelt-learning-launch-at");
  } catch (_) {}
  if (!startedAt && Number.isFinite(queryStartedAt)) startedAt = queryStartedAt;
  if (url.searchParams.has("__gwlaunch")) {
    url.searchParams.delete("__gwlaunch");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }

  const age = Date.now() - startedAt;
  if (!standalone || !startedAt || age < 0 || age >= 8000) return;

  root.dataset.growveltLaunchPending = "true";
  window.setTimeout(() => {
    delete root.dataset.growveltLaunchPending;
    delete root.dataset.growveltLaunchClosing;
  }, Math.max(0, 8000 - age));
})();`;
