const CACHE_NAME = "mantenimiento-chanchan-v5";
const ARCHIVOS_BASE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./css/estilos.css",
  "./img/logo.png",
  "./datos/equipos.js",
  "./datos/materiales.js",
  "./js/config.js",
  "./js/almacenamiento.js",
  "./js/navegacion-login.js",
  "./js/actividades.js",
  "./js/fallas.js",
  "./js/solicitudes.js",
  "./js/requerimientos.js",
  "./js/sincronizacion.js",
  "./js/admin.js",
  "./js/inicio.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_BASE))
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

self.addEventListener("fetch", (event) => {
  // Los envíos al servidor (POST al Apps Script) no se guardan en caché:
  // pasan directo a internet como siempre.
  if (event.request.method !== "GET") return;

  // Estrategia: intenta la red primero (para no quedarte con versión vieja
  // si hay internet), y si falla (sin señal), usa lo que haya en caché.
  event.respondWith(
    fetch(event.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(event.request))
  );
});
