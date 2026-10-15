# Notas del proyecto — App de Mantenimiento Chan Chan Amaryl

PWA (app instalable desde el navegador) para registrar actividades de mantenimiento,
historial de fallas, solicitudes y requerimientos de materiales. Publicada en
GitHub Pages: https://bladimirea28-spec.github.io/app-mantenimiento-chanchan/

Responsable: Bladimir (bladimirea28-spec)

## Estructura de archivos

```
index.html            → Solo el HTML de las pantallas (+ script mínimo del modo oscuro)
manifest.json         → Datos de instalación de la PWA (nombre, ícono, colores)
sw.js                 → Service worker: caché para uso sin internet
icon-192.png / icon-512.png → Íconos de la app
css/estilos.css       → Todos los estilos (colores, botones, tarjetas, modo oscuro)
img/logo.png          → Logo Chan Chan Amaryl (antes estaba incrustado en base64)
datos/equipos.js      → Catálogo de equipos (EQUIPOS) — 154 equipos con código CECO
datos/materiales.js   → Catálogo de materiales (CATALOGO_MATERIALES) — 1748 materiales
js/config.js          → ID de dispositivo, indicador de carga, URL del Apps Script
                        (DEFAULT_SYNC_URL), llamarServidor(), modo oscuro
js/almacenamiento.js  → Base de datos local del celular (IndexedDB)
js/navegacion-login.js→ Cambio de pantallas, login, técnico responsable,
                        autoregistro, registro de operadores, campos "Otros"
js/actividades.js     → Autocompletado de equipos, Actividades de Mantenimiento,
                        duración automática, integrantes, evidencia fotográfica
js/fallas.js          → Historial de Fallas y Fallas Abiertas (ver/resolver)
js/solicitudes.js     → Solicitud de actividad (jefes) y solicitud generada por admin
js/requerimientos.js  → Requerimientos de materiales, borrador local, mis requerimientos
js/sincronizacion.js  → Envío de registros a Google Sheets
js/admin.js           → Panel de administración, análisis por período y gráficos,
                        modal, PIN, ver/editar/eliminar actividades y requerimientos
js/inicio.js          → Toast, indicador de conexión y arranque de la app (iniciar())
```

## Reglas importantes al editar

1. **El orden de los `<script>` en index.html importa.** Primero los datos, luego
   los módulos, y `js/inicio.js` siempre al final (arranca la app).
2. Todos los archivos JS comparten variables y funciones globales (no son módulos ES).
   No declarar dos veces la misma variable (`let`/`const`) en archivos distintos.
3. Si agregas un archivo nuevo: añádelo en index.html **y** en la lista
   `ARCHIVOS_BASE` de `sw.js`.
4. Cada vez que publiques cambios, sube la versión en `sw.js`
   (`mantenimiento-chanchan-v2` → `v3`…) para que los celulares tomen la versión nueva.
5. Para actualizar catálogos (equipos/materiales) solo se toca la carpeta `datos/`.

## Backend actual

- Google Sheet **BD_Mantenimiento_ChanChan** + Apps Script desplegado como aplicación web.
- Pestañas principales: ACTIVIDADES_MTTO, HISTORIAL_FALLAS, USUARIOS.
- Fotos se suben a Drive y se guarda el link en la hoja.
- La URL del Apps Script está en `js/config.js` (`DEFAULT_SYNC_URL`).

## Pendiente / próximos pasos

- Migración pedida por el jefe: app + base de datos 100 % Microsoft
  (Power Apps + Dataverse). Tablas "Actividades Mantenimiento" e "Historial Fallas"
  ya creadas en el entorno personal de Dataverse.
- Flujo de Power Automate "Recibir Registro App Mantenimiento": corregir campos con
  el método de Expresión (`triggerBody()?['registro']?['campo']`), agregar Fotos,
  agregar paso Respuesta `{"ok": true}`, probar y cambiar la URL en `js/config.js`.
- Regla aprendida en Power Automate: guardar después de cada bloque agregado.

## Historial

- 2026-10-04: index.html (466 KB, 4079 líneas) dividido en archivos separados
  (CSS, 10 módulos JS, catálogos de datos y logo como PNG). Funcionamiento verificado
  igual al original. index.html quedó en ~67 KB.
