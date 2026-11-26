export const launchStyles = `
.growvelt-launch-splash {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 100vh;
  height: 100svh;
  z-index: 2147483000;
  display: none;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  color: #111827;
  opacity: 1;
  visibility: hidden;
  pointer-events: none;
  animation: growvelt-launch-failsafe 8s linear forwards;
}
html[data-theme="dark"] .growvelt-launch-splash { background: #090d18; color: #f8fafc; }
html[data-growvelt-launch-pending="true"] .growvelt-launch-splash {
  display: flex;
  visibility: visible;
  pointer-events: auto;
}
html[data-growvelt-launch-closing="true"] .growvelt-launch-splash {
  opacity: 0;
  visibility: visible;
  pointer-events: none;
  transition: opacity 160ms ease-out;
}
.growvelt-launch-lockup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.growvelt-launch-mark {
  position: relative;
  display: block;
  flex: 0 0 88px;
  width: 88px;
  height: 88px;
  overflow: hidden;
  border-radius: 20px;
  filter: drop-shadow(0 9px 22px rgba(131, 43, 251, .23));
  isolation: isolate;
}
html[data-growvelt-launch-pending="true"] .growvelt-launch-mark {
  background-image: url("/pwa/icon-any-512x512.png");
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}
.growvelt-launch-name {
  margin: 0;
  font: 700 20px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: -.02em;
}
@keyframes growvelt-launch-failsafe {
  0%, 97.5% { opacity: 1; visibility: visible; }
  100% { opacity: 0; visibility: hidden; pointer-events: none; }
}
@media (prefers-reduced-motion: reduce) {
  .growvelt-launch-splash { animation-name: growvelt-launch-failsafe-reduced; }
  html[data-growvelt-launch-closing="true"] .growvelt-launch-splash { transition: none; }
}
@keyframes growvelt-launch-failsafe-reduced {
  0%, 99.99% { opacity: 1; visibility: visible; }
  100% { opacity: 1; visibility: hidden; pointer-events: none; }
}
`;
