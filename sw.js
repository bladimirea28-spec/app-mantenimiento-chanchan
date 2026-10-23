// Al publicar, subir este número y VERSION_APP en js/config.js (el mismo).
const CACHE_NAME = "mantenimiento-chanchan-v20";
const ARCHIVOS_BASE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icono-app-192.png",
  "./icono-app-512.png",
  "./css/estilos.css",
  "./img/logo.png",
  "./datos/equipos.js",
  "./datos/materiales.js",
  "./datos/checklists.js",
  "./datos/planes-mantenimiento.js",
  "./plantillas/CONTROL_MANTENIMIENTO.xlsx",
  "./js/config.js",
  "./js/almacenamiento.js",
  "./js/navegacion-login.js",
  "./js/actividades.js",
  "./js/fallas.js",
  "./js/solicitudes.js",
  "./js/requerimientos.js",
  "./js/checklists.js",
  "./js/control-mantenimiento.js",
  "./js/qr-equipos.js",
  "./js/excel-control.js",
  "./js/dashboard-control.js",
  "./js/sincronizacion.js",
  "./js/admin.js",
  "./js/inicio.js",
  // Librerías para exportar a Excel: se cargan solo al exportar, pero se
  // guardan aquí para que también funcionen sin señal.
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    // cache:"reload" = siempre de internet, nunca la copia de unos minutos
    // que guarda el navegador (si no, la versión nueva quedaba con archivos viejos).
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ARCHIVOS_BASE.map((u) => new Request(u, { cache: "reload" }))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

/* Estrategia "rápido primero": la app se abre al instante con lo que ya está
   guardado en el celular y, en segundo plano, se trae la versión nueva de
   cada archivo para la próxima vez. Cuando se publica una versión (cambia
   CACHE_NAME), este archivo se instala solo y deja todo listo.
   Los pedidos al servidor (Apps Script) nunca se guardan: van directo. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("script.google.com") || url.hostname.endsWith("googleusercontent.com")) return;

  const esPagina = req.mode === "navigate";
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const guardado = esPagina
      ? (await cache.match("./index.html")) || (await cache.match("./"))
      : await cache.match(req, { ignoreSearch: true });
    const fresco = esPagina
      ? fetch("./index.html", { cache: "no-cache" })
      : fetch(new Request(req, { cache: "no-cache" }));
    const deRed = fresco.then((resp) => {
      if (resp && (resp.ok || resp.type === "opaque") && !esPagina) cache.put(req, resp.clone());
      if (resp && resp.ok && esPagina) cache.put("./index.html", resp.clone());
      return resp;
    }).catch(() => null);
    if (guardado) {
      event.waitUntil(deRed);
      return guardado;
    }
    return (await deRed) || Response.error();
  })());
});
