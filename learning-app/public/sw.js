const CACHE_VERSION = "v9";
const CACHE_NAME = `growvelt-pwa-${CACHE_VERSION}`;

const ALLOWED_CACHE_PATHS = new Set([
  "/offline.html",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon-96x96.png",
  "/pwa/icon-any-192x192.png",
  "/pwa/icon-any-512x512.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
  "/pwa/icon-maskable-512x512.png",
]);

const PRIVATE_PATH_PREFIXES = [
  "/api/",
  "/auth/",
  "/dashboard/",
  "/instructor/",
  "/company-learning/",
  "/learn/",
  "/payments/",
  "/settings/",
  "/admin/",
  "/certificates/",
  "/verify-certificate/",
  "/ref/",
  "/unsubscribe/",
];

const NEVER_CACHE_PATH_PREFIXES = [
  ...PRIVATE_PATH_PREFIXES,
  "/_next/image",
  "/_next/data",
];

const SUPABASE_HOST_PARTS = ["supabase.co", "supabase.in"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(Array.from(ALLOWED_CACHE_PATHS)))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("growvelt-pwa-") && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  event.waitUntil(showGrowveltPushNotification(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openGrowveltNotificationDestination(event.notification.data?.path));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (isSupabaseRequest(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isNeverCachePath(url.pathname)) {
    return;
  }

  if (url.origin === self.location.origin && ALLOWED_CACHE_PATHS.has(url.pathname)) {
    event.respondWith(handleAllowedAsset(request));
  }
});

function isSupabaseRequest(url) {
  return SUPABASE_HOST_PARTS.some((hostPart) => url.hostname.includes(hostPart));
}

function isNeverCachePath(pathname) {
  return NEVER_CACHE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await cache.match("/offline.html");

    if (offlineResponse) {
      return offlineResponse;
    }

    return new Response("Growvelt is offline. Please reconnect to continue.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function handleAllowedAsset(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

const PUSH_PAYLOAD_MAX_BYTES = 3072;
const PUSH_DEFAULTS = {
  title: "Growvelt",
  body: "You have a new Growvelt update.",
  path: "/dashboard",
  category: "announcements",
  tag: "growvelt-notification",
};
const PUSH_CATEGORIES = new Set([
  "course_updates",
  "enrollment_updates",
  "instructor_updates",
  "announcements",
  "maintenance",
  "promotions",
]);
const PUSH_PATH_PREFIXES = [
  "/dashboard",
  "/updates",
  "/courses",
  "/learn",
  "/instructor",
  "/company-learning",
];

function truncatePushText(value, maximumLength, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return Array.from(normalized).slice(0, maximumLength).join("");
}

function normalizeGrowveltPath(value) {
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return PUSH_DEFAULTS.path;
  }

  try {
    const url = new URL(value, self.location.origin);
    const allowed =
      url.origin === self.location.origin &&
      (url.pathname === "/" ||
        PUSH_PATH_PREFIXES.some(
          (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
        ));

    if (!allowed) return PUSH_DEFAULTS.path;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return PUSH_DEFAULTS.path;
  }
}

function parseGrowveltPushPayload(event) {
  if (!event.data) return PUSH_DEFAULTS;

  try {
    const raw = event.data.text();
    if (new TextEncoder().encode(raw).byteLength > PUSH_PAYLOAD_MAX_BYTES) {
      return PUSH_DEFAULTS;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return PUSH_DEFAULTS;
    }

    return {
      title: truncatePushText(parsed.title, 80, PUSH_DEFAULTS.title),
      body: truncatePushText(parsed.body, 180, PUSH_DEFAULTS.body),
      path: normalizeGrowveltPath(parsed.path),
      category: PUSH_CATEGORIES.has(parsed.category)
        ? parsed.category
        : PUSH_DEFAULTS.category,
      tag: truncatePushText(parsed.tag, 64, PUSH_DEFAULTS.tag),
    };
  } catch {
    return PUSH_DEFAULTS;
  }
}

async function showGrowveltPushNotification(event) {
  const payload = parseGrowveltPushPayload(event);
  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/pwa/icon-any-192x192.png?v=9",
    tag: payload.tag,
    data: {
      path: payload.path,
      category: payload.category,
    },
  });
}

async function openGrowveltNotificationDestination(value) {
  const path = normalizeGrowveltPath(value);
  const targetUrl = new URL(path, self.location.origin);
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  const exactClient = windowClients.find((client) => {
    const clientUrl = new URL(client.url);
    return (
      clientUrl.origin === targetUrl.origin &&
      `${clientUrl.pathname}${clientUrl.search}${clientUrl.hash}` ===
        `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
    );
  });

  if (exactClient) {
    await exactClient.focus();
    return;
  }

  const backgroundClient = windowClients.find((client) => {
    const clientUrl = new URL(client.url);
    return clientUrl.origin === targetUrl.origin && client.visibilityState !== "visible";
  });

  if (backgroundClient) {
    const navigatedClient = await backgroundClient.navigate(targetUrl.href);
    await (navigatedClient ?? backgroundClient).focus();
    return;
  }

  await self.clients.openWindow(path);
}
