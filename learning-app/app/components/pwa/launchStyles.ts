export const launchStyles = `
.growvelt-launch-splash {
  position: fixed;
  inset: 0;
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
  transform: translateY(-4vh);
}
.growvelt-launch-mark {
  position: relative;
  width: 88px;
  height: 88px;
  overflow: hidden;
  border-radius: 20px;
  filter: drop-shadow(0 9px 22px rgba(131, 43, 251, .23));
  isolation: isolate;
}
.growvelt-launch-mark img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.growvelt-launch-mark::after {
  position: absolute;
  inset: -65% -35%;
  z-index: 1;
  content: "";
  pointer-events: none;
  background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,0) 45%, rgba(255,255,255,.28) 50%, rgba(255,255,255,0) 55%, transparent 60%);
  transform: translateX(-72%);
  animation: growvelt-launch-sheen 1100ms ease-in-out 1 180ms both;
}
.growvelt-launch-name {
  margin: 0;
  font: 600 20px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: -.02em;
}
@keyframes growvelt-launch-sheen {
  to { transform: translateX(72%); }
}
@keyframes growvelt-launch-failsafe {
  0%, 97.5% { opacity: 1; visibility: visible; }
  100% { opacity: 0; visibility: hidden; pointer-events: none; }
}
@media (prefers-reduced-motion: reduce) {
  .growvelt-launch-mark::after { animation: none; }
  .growvelt-launch-splash { animation-name: growvelt-launch-failsafe-reduced; }
  html[data-growvelt-launch-closing="true"] .growvelt-launch-splash { transition: none; }
}
@keyframes growvelt-launch-failsafe-reduced {
  0%, 99.99% { opacity: 1; visibility: visible; }
  100% { opacity: 1; visibility: hidden; pointer-events: none; }
}
`;
