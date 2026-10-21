/* ============ MÓDULO: CONTROL DE MANTENIMIENTO ============
   Une los checklists diarios (km / horómetro) con los planes de
   mantenimiento preventivo del Excel "CONTROL DE MANTENIMIENTO"
   (datos/planes-mantenimiento.js). Calcula para cada unidad el próximo PM
   y avisa cuando falta poco (AVISO_POR_CONTROL) o ya se pasó.

   Misma lógica que la hoja EQUIPOS del Excel: el próximo PM es el paso
   siguiente del ciclo y "próximo a" = lectura del último PM + intervalo
   (o fecha del último PM + intervalo en meses). */

/* Cuánto antes avisar: 100 km, 15 horas o 15 días (lo que va por meses).
   El admin puede cambiarlo por unidad en "Punto de partida". */
const AVISO_POR_CONTROL = { KM:100, HR:15, MESES:15 };
const UNIDAD_CONTROL = { KM:"km", HR:"h", MESES:"días" };   // para "faltan …"
const UNIDAD_INTERVALO = { KM:"km", HR:"h", MESES:"meses" }; // para "cada …"

/* Un solo paquete de datos para la ficha de cada equipo y el dashboard:
   punto de partida, mantenimientos, lecturas, fallas y checklists recientes. */
let controlDatos = { parametros:[], mantenimientos:[], lecturas:{}, fallas:[], checklists:[], actualizado:null };
let mtoTipo = "Preventivo";
let mtoMateriales = [];
let mtoInspeccion = [];
fotosTemp.mantenimiento = [];

/* ---------- Utilidades ---------- */
function sesionActual(){ try{ return JSON.parse(localStorage.getItem("sesion_activa") || "{}"); }catch(e){ return {}; } }

/* "15/10/2026" o "15/10/2026 08:30" → Date */
function fechaDesdePE(texto){
  const m = String(texto || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}
function isoDesdePE(texto){
  const d = fechaDesdePE(texto);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
}
function peDesdeIso(iso){
  const p = String(iso || "").split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "";
}
function hoyIso(){ return isoDesdePE(fechaPE(new Date())); }
function sumarMeses(fecha, meses){ const d = new Date(fecha); d.setMonth(d.getMonth() + Number(meses)); return d; }
function miles(n){ return Number(n).toLocaleString("es-PE", { maximumFractionDigits:1 }); }
function equipoMtto(codigo){ return EQUIPOS_MTTO.find(e => e.codigo === String(codigo)) || null; }
function pasoDelCiclo(plan, pm){ return (plan.ciclo || []).findIndex(c => c.paso === pm || c.mantenimiento === pm); }

/* ---------- Datos: servidor + lo guardado en el celular ---------- */
function mantenimientoDesdeServidor(f){
  return {
    id:f.ID_MANTENIMIENTO, fecha:String(f.FECHA || ""), codigo:String(f.CODIGO || ""), equipo:f.EQUIPO,
    plan:f.PLAN, control:f.CONTROL, lectura:f.LECTURA, tipo:f.TIPO,
    pm:f.MANTENIMIENTO_REALIZADO === "CORRECTIVO" ? "" : f.MANTENIMIENTO_REALIZADO, n_ot:f.N_OT,
    tecnico:f.TECNICO, dni:String(f.DNI || ""), hora_inicio:f.HORA_INICIO, hora_fin:f.HORA_FIN,
    costo:Number(f.COSTO) || 0, cambios_fuera_plan:f.CAMBIOS_FUERA_PLAN, observaciones:f.OBSERVACIONES,
    trabajo:f.TRABAJO_REALIZADO, falla_id:f.FALLA_RELACIONADA, materiales:f.MATERIALES || [],
    inspeccion:f.INSPECCION || [], fotos:String(f.FOTOS || "").split("|").map(s => s.trim()).filter(Boolean),
    vb_nombre:f.VB_NOMBRE, vb_fecha:f.VB_FECHA, sincronizado:true
  };
}

async function cargarControlMantenimiento(silencioso){
  await asegurarPlanesMtto();
  let deServidor = null;
  if(navigator.onLine && tokenSesion()){
    const resp = await llamarServidor({ tipo:"control_mantenimiento" }, { silencioso:!!silencioso });
    if(resp && resp.ok){
      deServidor = { parametros:resp.parametros || [], mantenimientos:(resp.mantenimientos || []).map(mantenimientoDesdeServidor),
                     lecturas:resp.lecturas || {}, fallas:resp.fallas || [], checklists:resp.checklists || [],
                     actualizado:new Date().toLocaleString("es-PE"), ts:Date.now() };
      try{ localStorage.setItem("cache_control_mtto", JSON.stringify(deServidor)); }catch(e){}
    }
  }
  if(!deServidor){
    try{ deServidor = JSON.parse(localStorage.getItem("cache_control_mtto") || "null"); }catch(e){ deServidor = null; }
  }
  controlDatos = deServidor || { parametros:[], mantenimientos:[], lecturas:{}, actualizado:null };
  controlDatos.fallas = controlDatos.fallas || [];
  controlDatos.checklists = (controlDatos.checklists || []).slice();

  // Lo que todavía no llegó al servidor también cuenta. Lo que ya se envió
  // lo trae el servidor (así, si un admin borró un registro, este celular no
  // lo sigue usando con su copia antigua).
  const nuevoParaServidor = r => !deServidor || !r.sincronizado || (deServidor.ts && r.creado > deServidor.ts);
  (await leerStore("mantenimientos")).filter(nuevoParaServidor).forEach(m => {
    if(!controlDatos.mantenimientos.some(x => x.id === m.id)) controlDatos.mantenimientos.push(m);
  });
  const anotar = (clave, valor, fecha, origen) => {
    const n = Number(valor);
    if(!clave || isNaN(n)) return;
    const actual = controlDatos.lecturas[clave];
    if(!actual || n > Number(actual.lectura)) controlDatos.lecturas[clave] = { lectura:n, fecha, origen };
  };
  (await leerStore("checklists")).filter(nuevoParaServidor).forEach(c => {
    anotar(c.equipo_clave, c.lectura, c.fecha, "Checklist");
    if(!controlDatos.checklists.some(x => x.id === c.id)) controlDatos.checklists.push({
      id:c.id, fecha:c.fecha, hora:c.hora, plantilla:c.plantilla, codigo_formato:c.codigo_formato,
      equipo_codigo:c.equipo_codigo, equipo:c.equipo, equipo_clave:c.equipo_clave, turno:c.turno,
      lectura:c.lectura, lectura_tipo:c.lectura_tipo, nc:c.nc || 0, observados:c.observados || 0,
      puede_utilizar:c.puede_utilizar, observaciones:c.observaciones, usuario:c.usuario,
      hallazgos:(c.respuestas || []).filter(x => x.marca === "NC" || x.marca === "O"), pendiente:!c.sincronizado
    });
  });
  controlDatos.mantenimientos.forEach(m => { if(m.lectura !== "" && m.lectura != null) anotar(m.codigo, m.lectura, m.fecha, "Mantenimiento"); });
  return controlDatos;
}

/* ---------- Estado de cada unidad ---------- */
function ordenarMantenimientos(lista){
  return lista.slice().sort((a, b) => ((fechaDesdePE(a.fecha) || 0) - (fechaDesdePE(b.fecha) || 0)) || (Number(a.lectura) - Number(b.lectura)));
}

function estadoUnidad(eq){
  const plan = PLANES_MTTO[eq.plan] || { ciclo:[] };
  const ciclo = plan.ciclo;
  const params = controlDatos.parametros.find(p => String(p.CODIGO) === eq.codigo) || null;
  const delEquipo = ordenarMantenimientos(controlDatos.mantenimientos.filter(m => m.codigo === eq.codigo));
  const preventivos = delEquipo.filter(m => m.tipo === "Preventivo");
  const ultimo = preventivos[preventivos.length - 1];
  const lect = controlDatos.lecturas[eq.codigo] || null;
  const aviso = params && params.AVISO !== "" && params.AVISO != null ? Number(params.AVISO) : AVISO_POR_CONTROL[eq.control];

  let base = null;
  if(ultimo){
    base = { pm:ultimo.pm, lectura:Number(ultimo.lectura) || 0, fecha:fechaDesdePE(ultimo.fecha), origen:"Registrado en la app" };
  }else if(params && params.ULTIMO_PM){
    const ninguno = params.ULTIMO_PM === "NINGUNO";
    let lecturaBase = Number(ninguno ? params.LECTURA_INICIAL : params.LECTURA_ULTIMO_PM) || 0;
    // Sin ningún preventivo y todavía antes del primer intervalo: el PM1 toca
    // en el intervalo exacto (ej. 250 h), no 250 h después de hoy.
    if(ninguno && lecturaBase < Number(eq.intervalo)) lecturaBase = 0;
    base = {
      pm: ninguno ? "" : params.ULTIMO_PM,
      lectura: lecturaBase,
      fecha: fechaDesdePE(ninguno ? params.FECHA_INICIAL : params.FECHA_ULTIMO_PM),
      origen:"Punto de partida"
    };
  }

  const r = { eq, plan, params, ultimo, base, lect, aviso, historial:delEquipo, unidad:UNIDAD_CONTROL[eq.control] || "" };
  const idx = base && base.pm ? pasoDelCiclo(plan, base.pm) : -1;
  r.proximo = ciclo.length ? ciclo[(idx + 1) % ciclo.length].paso : "—";

  if(!base){ r.estado = "SIN REGISTRO"; return r; }
  if(eq.control === "MESES"){
    if(!base.fecha){ r.estado = "SIN REGISTRO"; return r; }
    r.proximaFecha = sumarMeses(base.fecha, eq.intervalo);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    r.falta = Math.ceil((r.proximaFecha - hoy) / 86400000);
    r.proximoTexto = fechaPE(r.proximaFecha);
  }else{
    r.proximoA = base.lectura + Number(eq.intervalo);
    r.actual = Math.max(lect ? Number(lect.lectura) : base.lectura, base.lectura);
    r.falta = Math.round((r.proximoA - r.actual) * 10) / 10;
    r.proximoTexto = `${miles(r.proximoA)} ${r.unidad}`;
  }
  r.estado = r.falta <= 0 ? "VENCIDO" : (r.falta <= aviso ? "PRÓXIMO" : "AL DÍA");
  return r;
}

function estadosDeUnidades(){ return EQUIPOS_MTTO.map(estadoUnidad); }

const CLASE_ESTADO = { "VENCIDO":"vencido", "PRÓXIMO":"proximo", "AL DÍA":"aldia", "SIN REGISTRO":"sinregistro" };

function textoFalta(r){
  if(r.falta == null) return "";
  if(r.falta <= 0) return `vencido hace ${miles(Math.abs(r.falta))} ${r.unidad}`;
  return `faltan ${miles(r.falta)} ${r.unidad}`;
}

/* ---------- Aviso en el inicio ---------- */
async function actualizarAlertaMantenimiento(refrescar){
  const s = sesionActual();
  const el = document.getElementById("alerta-mantenimiento");
  if(!el) return;
  if(!(s.rol === "admin" || s.rol === "tecnico" || s.es_jefe_area)){ el.style.display = "none"; return; }
  try{ await asegurarPlanesMtto(); }catch(e){ return; }
  // El aviso del inicio se refresca por detrás, sin tapar la pantalla.
  if(refrescar) await cargarControlMantenimiento(true);
  else if(!controlDatos.actualizado){
    try{ const c = JSON.parse(localStorage.getItem("cache_control_mtto") || "null"); if(c) controlDatos = c; }catch(e){}
  }
  const estados = estadosDeUnidades();
  const vencidas = estados.filter(r => r.estado === "VENCIDO");
  const proximas = estados.filter(r => r.estado === "PRÓXIMO");
  const sub = document.getElementById("menu-subtexto-control");
  if(sub) sub.textContent = vencidas.length + proximas.length
    ? `${vencidas.length} vencido(s) · ${proximas.length} próximo(s)`
    : "Preventivos por horómetro / km y correctivos";
  if(!vencidas.length && !proximas.length){ el.style.display = "none"; return; }
  const nombres = vencidas.concat(proximas).slice(0, 3).map(r => `${r.eq.codigo} (${r.proximo.split(" - ")[0]})`).join(", ");
  el.className = "alerta-mtto " + (vencidas.length ? "vencido" : "proximo");
  el.innerHTML = `<span class="alerta-mtto-icono">🔔</span><span><b>${vencidas.length ? `${vencidas.length} mantenimiento(s) vencido(s)` : ""}${vencidas.length && proximas.length ? " · " : ""}${proximas.length ? `${proximas.length} próximo(s)` : ""}</b><br><small>${esc(nombres)}${vencidas.length + proximas.length > 3 ? "…" : ""} — toca para ver</small></span>`;
  el.style.display = "flex";
}

/* ---------- Pantalla: estado de unidades ---------- */
async function abrirControlUnidades(){
  const s = sesionActual();
  document.getElementById("btn-mtto-registrar").style.display = (s.rol === "admin" || s.rol === "tecnico") ? "flex" : "none";
  document.getElementById("btn-mtto-partida").style.display = s.rol === "admin" ? "flex" : "none";
  document.getElementById("btn-mtto-qr").style.display = s.rol === "admin" ? "flex" : "none";
  irA("pantalla-control-unidades");
  document.getElementById("mtto-lista-unidades").innerHTML = `<div class="subtexto">Cargando...</div>`;
  await cargarControlMantenimiento();
  renderControlUnidades();
  actualizarAlertaMantenimiento(false);
}

function renderControlUnidades(){
  const estados = estadosDeUnidades();
  const filtro = document.getElementById("mtto-filtro").value;
  const cuenta = e => estados.filter(r => r.estado === e).length;
  document.getElementById("mtto-resumen").innerHTML = ["VENCIDO", "PRÓXIMO", "AL DÍA", "SIN REGISTRO"]
    .map(e => `<div class="mtto-chip ${CLASE_ESTADO[e]}"><b>${cuenta(e)}</b>${e === "SIN REGISTRO" ? "Sin registro" : e.charAt(0) + e.slice(1).toLowerCase()}</div>`).join("");
  document.getElementById("mtto-aviso").innerHTML = controlDatos.actualizado ? "" :
    `<div class="tarjeta chk-aviso">Sin conexión con el servidor: se muestra lo guardado en este celular.</div>`;

  const orden = { "VENCIDO":0, "PRÓXIMO":1, "AL DÍA":2, "SIN REGISTRO":3 };
  const lista = estados
    .filter(r => !filtro || (filtro === "alerta" ? (r.estado === "VENCIDO" || r.estado === "PRÓXIMO") : r.estado === filtro))
    .sort((a, b) => (orden[a.estado] - orden[b.estado]) || ((a.falta ?? 1e9) - (b.falta ?? 1e9)));
  const s = sesionActual();
  const puedeRegistrar = s.rol === "admin" || s.rol === "tecnico";
  document.getElementById("mtto-lista-unidades").innerHTML = lista.length ? lista.map(r => {
    const e = r.eq;
    const lectura = r.lect ? `${miles(r.lect.lectura)} ${r.unidad === "días" ? "" : r.unidad} · ${esc(r.lect.origen)} ${esc(String(r.lect.fecha).slice(0, 10))}` : "Sin lecturas todavía";
    return `
    <div class="registro-item mtto-unidad ${CLASE_ESTADO[r.estado]}">
      <div class="fila1">
        <div>
          <div style="font-weight:800;font-size:14px;">${esc(e.codigo)} · ${esc(e.descripcion)}</div>
          <div class="subtexto" style="margin-top:2px;">${esc(e.plan)} · cada ${miles(e.intervalo)} ${esc(UNIDAD_INTERVALO[e.control])}</div>
        </div>
        <span class="badge mtto-estado ${CLASE_ESTADO[r.estado]}">${esc(r.estado)}</span>
      </div>
      <div class="mtto-datos">
        <div><span>Próximo</span><b>${esc(r.proximo)}</b>${r.proximoTexto ? ` a ${esc(r.proximoTexto)}` : ""}</div>
        ${r.falta != null ? `<div><span>Falta</span><b>${esc(textoFalta(r))}</b></div>` : ""}
        ${e.control !== "MESES" ? `<div><span>Lectura actual</span>${lectura}</div>` : ""}
        <div><span>Último PM</span>${r.base ? `${esc(r.base.pm || "Ninguno")}${e.control !== "MESES" ? ` a ${miles(r.base.lectura)} ${r.unidad}` : ""}${r.base.fecha ? ` · ${fechaPE(r.base.fecha)}` : ""}` : "Falta cargar el punto de partida"}</div>
      </div>
      ${(() => { const n = fallasDeEquipo(e.codigo).filter(fallaAbierta).length; return n ? `<div class="mtto-pendientes" onclick="abrirFichaEquipo(${jsArg(e.codigo)})">⚠ ${n} pendiente(s) por corregir — toca para ver</div>` : ""; })()}
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button type="button" class="btn btn-secundario mtto-btn" onclick="abrirFichaEquipo(${jsArg(e.codigo)})">Ver ficha</button>
        ${puedeRegistrar ? `<button type="button" class="btn btn-primario mtto-btn" onclick="abrirFormMantenimiento(${jsArg(e.codigo)})">Registrar</button>` : ""}
      </div>
    </div>`;
  }).join("") : `<div class="vacio"><div class="subtexto">No hay unidades para este filtro.</div></div>`;
}

/* ---------- Fallas y checklists de una unidad ---------- */
/* "04101 - VL001- TRIMOTO…" → "04101" (también si la hoja quitó el cero). */
function codigoDeTextoEquipo(texto){
  const m = String(texto || "").match(/^\s*(\d{3,5})\b/);
  return m ? m[1].padStart(5, "0") : "";
}
function fallaAbierta(f){ return String(f.ESTADO || "Abierta") !== "Resuelta"; }
function diasDesdeTexto(fechaTexto){
  const f = fechaDesdePE(fechaTexto);
  if(!f) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((hoy - f) / 86400000);
}
function haceTexto(fechaTexto){
  const d = diasDesdeTexto(fechaTexto);
  return d == null ? "" : d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
}
/* Ordena por fecha (y hora) de la más reciente a la más antigua. */
function masRecientesPrimero(lista, campoFecha, campoHora){
  const valor = x => { const f = fechaDesdePE(x[campoFecha]); return (f ? f.getTime() : 0) + (campoHora && x[campoHora] ? Number(String(x[campoHora]).replace(":", "")) : 0); };
  return lista.slice().sort((a, b) => valor(b) - valor(a));
}
function fallasDeEquipo(codigo){ return controlDatos.fallas.filter(f => codigoDeTextoEquipo(f.EQUIPO) === codigo); }
function checklistsDeEquipo(codigo){
  return masRecientesPrimero(controlDatos.checklists.filter(c => String(c.equipo_clave || c.equipo_codigo) === codigo), "fecha", "hora");
}
function puedeAtender(s){ return s.rol === "admin" || s.rol === "tecnico"; }

/* Tarjeta de una falla pendiente, con sus acciones (resolver o correctivo). */
function htmlFallaPendiente(f, codigo, s){
  const hallazgo = /hallazgo|no conformidad/i.test(f.TIPO_FALLA || "");
  return `
    <div class="ficha-falla ${String(f.CRITICIDAD).toLowerCase() === "alta" ? "alta" : ""}">
      <div class="fila1">
        <div style="font-weight:700;font-size:13px;">${hallazgo ? "🔎 " : "⚠️ "}${esc(f.TIPO_FALLA || "Falla")}</div>
        <span class="badge ${claseEstadoFalla(f.ESTADO || "Abierta")}">${esc(f.ESTADO || "Abierta")}</span>
      </div>
      <div class="subtexto">${esc(f.ID_FALLA || "")} · ${esc(f.FECHA || "")} (${esc(haceTexto(f.FECHA))})${f.TECNICO_RESPONSABLE ? " · " + esc(f.TECNICO_RESPONSABLE) : " · sin técnico asignado"}</div>
      <div class="desc" style="margin-top:6px;white-space:pre-line;">${esc(f.DESCRIPCION || "")}</div>
      ${puedeAtender(s) && f.CLAVE ? `<div class="ficha-acciones">
        <button class="btn btn-primario mtto-btn" onclick="resolverFallaDesdeFicha(${jsArg(f.CLAVE)}, ${jsArg(codigo)})">✔ Resolver</button>
        ${equipoMtto(codigo) ? `<button class="btn btn-secundario mtto-btn" onclick="cerrarModal();abrirFormMantenimiento(${jsArg(codigo)}, { correctivo:true, falla:${jsArg(f.ID_FALLA)} })">🔧 Correctivo</button>` : ""}
      </div>` : ""}
    </div>`;
}

/* ---------- Ficha del equipo: todo de una unidad en un solo lugar ---------- */
function verUnidadMantenimiento(codigo){ abrirFichaEquipo(codigo); }

function abrirFichaEquipo(codigo){
  const eq = equipoMtto(codigo);
  if(!eq) return;
  const r = estadoUnidad(eq);
  const s = sesionActual();
  const fallas = masRecientesPrimero(fallasDeEquipo(codigo), "FECHA");
  const pendientes = fallas.filter(fallaAbierta);
  const resueltas = fallas.filter(f => !fallaAbierta(f)).slice(0, 3);
  const checklists = checklistsDeEquipo(codigo);
  const lectura = r.lect ? `${miles(r.lect.lectura)} ${r.unidad === "días" ? "" : r.unidad}` : "—";

  const htmlChecklist = c => `
    <div class="ficha-chk">
      <div class="fila1">
        <div><b>${esc(c.fecha)}</b> ${esc(c.hora || "")} · ${c.lectura !== "" && c.lectura != null ? esc(miles(c.lectura)) + " " + esc(c.lectura_tipo === "km" ? "km" : "h") : "—"}</div>
        <div class="badge-fila">
          ${c.nc ? `<span class="badge criticidad-alta">${c.nc} NC</span>` : ""}
          ${c.observados ? `<span class="badge criticidad-media">${c.observados} obs.</span>` : ""}
          ${c.puede_utilizar === "NO" ? `<span class="badge criticidad-alta">No usar</span>` : ""}
          ${!c.nc && !c.observados && c.puede_utilizar !== "NO" ? `<span class="badge criticidad-baja">Todo conforme</span>` : ""}
          ${c.pendiente ? `<span class="badge pendiente">Pendiente</span>` : ""}
        </div>
      </div>
      <div class="subtexto">${esc(c.usuario || "—")}${c.turno ? " · " + esc(c.turno) : ""}</div>
      ${(c.hallazgos || []).map(x => `<div class="ficha-hallazgo"><span class="chk-pill marca-${esc(x.marca)}">${esc(x.marca)}</span><span>${esc(x.item)}${x.obs ? ` — <i>${esc(x.obs)}</i>` : ""}</span></div>`).join("")}
      ${c.observaciones ? `<div class="subtexto" style="margin-top:4px;">Obs.: ${esc(c.observaciones)}</div>` : ""}
    </div>`;

  const filas = r.historial.slice().reverse().map(m => `
    <div class="registro-item" style="box-shadow:none;">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:13.5px;">${esc(m.tipo === "Preventivo" ? m.pm : "Correctivo")} · ${esc(m.fecha)}</div>
          <div class="subtexto">${m.lectura !== "" && m.lectura != null ? esc(miles(m.lectura)) + " " + esc(r.unidad) + " · " : ""}${esc(m.n_ot || "OT pendiente")} · ${esc(m.tecnico || "—")} · S/ ${(Number(m.costo) || 0).toFixed(2)}</div>
        </div>
        <span class="badge ${m.sincronizado ? (m.vb_nombre ? "criticidad-baja" : "") : "pendiente"}">${m.sincronizado ? (m.vb_nombre ? "✓ V°B° " + esc(primerNombre(m.vb_nombre)) : "Falta V°B°") : "Pendiente de enviar"}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
        <button class="btn btn-secundario mtto-btn" onclick="verMantenimiento(${jsArg(m.id)})">Ver</button>
        ${m.tipo === "Preventivo" ? `<button class="btn btn-secundario mtto-btn" onclick="exportarFormatoMantenimiento(${jsArg(m.id)})">⬇ Formato Excel</button>` : ""}
        ${s.rol === "admin" && m.sincronizado && !m.vb_nombre ? `<button class="btn btn-secundario mtto-btn" onclick="darVistoBuenoMantenimiento(${jsArg(m.id)}, ${jsArg(codigo)})">Dar V°B°</button>` : ""}
      </div>
    </div>`).join("");

  abrirModal(`
    <div class="modal-titulo"><span>${esc(eq.codigo)} · ${esc(eq.descripcion)}</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <div class="ficha-cabecera ${CLASE_ESTADO[r.estado]}">
      <span class="badge mtto-estado ${CLASE_ESTADO[r.estado]}">${esc(r.estado)}</span>
      <span class="subtexto">${esc(eq.plan)} · ${esc(eq.area)} · criticidad ${esc(eq.criticidad)}</span>
    </div>
    <div class="ficha-kpis">
      <div><span>${eq.control === "MESES" ? "Último PM" : "Lectura actual"}</span><b>${eq.control === "MESES" ? esc(r.base && r.base.fecha ? fechaPE(r.base.fecha) : "—") : esc(lectura)}</b>${r.lect && eq.control !== "MESES" ? `<small>${esc(r.lect.origen)} · ${esc(String(r.lect.fecha).slice(0, 10))}</small>` : ""}</div>
      <div><span>Próximo</span><b>${esc(String(r.proximo).split(" - ")[0])}</b><small>${r.falta != null ? esc(textoFalta(r)) : "falta punto de partida"}</small></div>
      <div class="${pendientes.length ? "alerta" : ""}"><span>Pendientes</span><b>${pendientes.length}</b><small>${pendientes.length ? "por corregir" : "nada pendiente"}</small></div>
    </div>
    <div class="ficha-acciones" style="margin-top:10px;">
      ${puedeAtender(s) ? `<button class="btn btn-primario mtto-btn" onclick="cerrarModal();abrirFormMantenimiento(${jsArg(codigo)})">🔧 Registrar mantenimiento</button>` : ""}
      <button class="btn btn-secundario mtto-btn" onclick="mostrarQrEquipo(${jsArg(codigo)})">▦ Código QR</button>
    </div>

    <div class="ficha-titulo">⚠ Pendientes por corregir (${pendientes.length})</div>
    ${pendientes.length ? pendientes.map(f => htmlFallaPendiente(f, codigo, s)).join("")
      : `<div class="subtexto">Sin fallas ni hallazgos abiertos. 👍</div>`}

    <div class="ficha-titulo">📋 Checklists diarios (${checklists.length} en los últimos 4 meses)</div>
    ${checklists.length ? checklists.slice(0, 5).map(htmlChecklist).join("") + (checklists.length > 5 ? `<div class="subtexto">… y ${checklists.length - 5} más.</div>` : "")
      : `<div class="subtexto">Todavía no hay checklists de esta unidad.</div>`}

    <div class="ficha-titulo">🔧 Mantenimientos (${r.historial.length})</div>
    ${filas || `<div class="subtexto">Todavía no hay mantenimientos registrados.</div>`}
    <div class="ficha-nota">V°B° = firma de revisión del supervisor. Es solo la aprobación: el mantenimiento ya cuenta en el control, el dashboard y Power Apps desde que se registra.</div>

    ${resueltas.length ? `<div class="ficha-titulo">✔ Fallas resueltas recientes</div>
      ${resueltas.map(f => `<div class="ficha-chk"><div class="fila1"><div><b>${esc(f.ID_FALLA || "")}</b> · ${esc(f.FECHA || "")}</div><span class="badge estado-resuelta">Resuelta</span></div>
        <div class="subtexto">${esc(String(f.DESCRIPCION || "").slice(0, 120))}</div>
        ${f.ACCION_CORRECTIVA ? `<div class="subtexto"><b>Acción:</b> ${esc(f.ACCION_CORRECTIVA)}${f.RESUELTO_POR ? " · " + esc(f.RESUELTO_POR) : ""}</div>` : ""}</div>`).join("")}` : ""}

    <button class="btn btn-primario" style="margin-top:14px;" onclick="cerrarModal()">Cerrar</button>
    <div class="subtexto" style="text-align:center;margin-top:8px;">${controlDatos.actualizado ? "Actualizado: " + esc(controlDatos.actualizado) : "Sin conexión: datos guardados en el celular."}</div>
  `);
}

/* Abre "Resolver falla" con la falla elegida y, al terminar, vuelve a la ficha. */
function resolverFallaDesdeFicha(clave, codigo){
  const f = controlDatos.fallas.find(x => x.CLAVE === clave);
  if(!f) return;
  cerrarModal();
  abrirResolverFallaObjeto(f, () => abrirFichaEquipo(codigo));
}

function verMantenimiento(id){
  const m = controlDatos.mantenimientos.find(x => x.id === id);
  if(!m) return;
  const materiales = (m.materiales || []).map(x => `<div class="modal-fila" style="display:flex;justify-content:space-between;gap:8px;">
      <span>${esc(x.descripcion)} <small class="subtexto">${esc(x.sistema)}</small></span>
      <span style="white-space:nowrap;">${x.cambiado === "NO" ? "No cambiado" : `${esc(x.cantidad_usada)} ${esc(x.unidad)}`}</span></div>`).join("");
  const inspeccion = (m.inspeccion || []).map(x => `<div class="modal-fila" style="display:flex;gap:8px;">
      <span class="chk-pill ${x.resultado === "NO OK" ? "marca-NC" : "marca-C"}">${x.resultado === "NO OK" ? "NO OK" : "OK"}</span>
      <div style="flex:1;">${esc(x.sistema)} · ${esc(x.tarea)}${x.obs ? `<div class="subtexto">${esc(x.obs)}</div>` : ""}</div></div>`).join("");
  abrirModal(`
    <div class="modal-titulo"><span>${esc(m.tipo === "Preventivo" ? m.pm : "Correctivo")}</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <div class="modal-fila"><b>Unidad</b>${esc(m.codigo)} · ${esc(m.equipo)}</div>
    <div class="modal-fila"><b>Fecha · OT</b>${esc(m.fecha)} · ${esc(m.n_ot || "pendiente de sincronizar")}</div>
    <div class="modal-fila"><b>Lectura</b>${esc(m.lectura)}</div>
    <div class="modal-fila"><b>Técnico</b>${esc(m.tecnico || "—")}${m.hora_inicio ? ` · ${esc(m.hora_inicio)} – ${esc(m.hora_fin)}` : ""}</div>
    ${m.trabajo ? `<div class="modal-fila"><b>Trabajo realizado</b>${esc(m.trabajo)}</div>` : ""}
    ${m.cambios_fuera_plan ? `<div class="modal-fila"><b>Cambios fuera del plan</b>${esc(m.cambios_fuera_plan)}</div>` : ""}
    ${m.observaciones ? `<div class="modal-fila"><b>Observaciones</b>${esc(m.observaciones)}</div>` : ""}
    <div class="modal-fila"><b>Costo de materiales</b>S/ ${(Number(m.costo) || 0).toFixed(2)}</div>
    ${m.vb_nombre ? `<div class="modal-fila"><b>Visto bueno</b>${esc(m.vb_nombre)} · ${esc(m.vb_fecha)}</div>` : ""}
    ${materiales ? `<div style="font-weight:700;font-size:13.5px;margin-top:12px;">Materiales</div>${materiales}` : ""}
    ${inspeccion ? `<div style="font-weight:700;font-size:13.5px;margin-top:12px;">Inspección</div>${inspeccion}` : ""}
    ${(m.fotos || []).length ? fotosHtmlAdmin(m.fotos.join("|"), 70) : ""}
    <button class="btn btn-primario" style="margin-top:14px;" onclick="verUnidadMantenimiento(${jsArg(m.codigo)})">Volver</button>
  `);
}

async function darVistoBuenoMantenimiento(id, codigo){
  const resp = await llamarServidor({ tipo:"visto_bueno_mantenimiento", id });
  mostrarToast((resp && resp.mensaje) || "No se pudo registrar", !!(resp && resp.ok));
  if(resp && resp.ok){ await cargarControlMantenimiento(); verUnidadMantenimiento(codigo); }
}

/* ---------- Pantalla: registrar mantenimiento ---------- */
/* opciones.correctivo: abrir directo como correctivo; opciones.falla: la
   falla (N°) que ese correctivo resuelve (viene de la ficha del equipo). */
let mtoFallaElegida = "";
async function abrirFormMantenimiento(codigo, opciones){
  opciones = opciones || {};
  mtoFallaElegida = opciones.falla || "";
  try{ await Promise.all([asegurarPlanesMtto(), asegurarMateriales()]); }catch(e){ mostrarToast(e.message, false); return; }
  document.getElementById("mto-equipo").innerHTML = `<option value="">Selecciona la unidad</option>` +
    EQUIPOS_MTTO.map(e => `<option value="${esc(e.codigo)}">${esc(e.codigo)} - ${esc(e.descripcion)}</option>`).join("");
  document.getElementById("mto-equipo").value = codigo || "";
  document.getElementById("mto-fecha").value = hoyIso();
  ["mto-lectura", "mto-hora-inicio", "mto-hora-fin", "mto-trabajo", "mto-cambios", "mto-observaciones", "mto-material-nuevo"]
    .forEach(id => { document.getElementById(id).value = ""; });
  document.getElementById("mto-cerrar-falla").checked = true;
  document.getElementById("mto-error").classList.remove("activo");
  fotosTemp.mantenimiento = [];
  renderFotoPreviews("mantenimiento", "mto-foto-previews");
  const lista = document.getElementById("mto-lista-materiales");
  if(!lista.childElementCount){
    lista.innerHTML = CATALOGO_MATERIALES.map(m => `<option value="${esc(m.nombre)}"></option>`).join("");
  }
  mtoTipo = opciones.correctivo ? "Correctivo" : "Preventivo";
  elegirTipoMantenimiento(mtoTipo, true);
  irA("pantalla-form-mantenimiento");
  cambioEquipoMantenimiento();
}

function elegirTipoMantenimiento(tipo, sinRecargar){
  mtoTipo = tipo;
  document.querySelectorAll(".mtto-tipo button").forEach(b => {
    b.classList.remove("activo", "marca-C", "marca-O");
    if(b.dataset.valor === tipo) b.classList.add("activo", tipo === "Preventivo" ? "marca-C" : "marca-O");
  });
  const preventivo = tipo === "Preventivo";
  document.getElementById("mto-campo-pm").style.display = preventivo ? "block" : "none";
  document.getElementById("mto-bloque-inspeccion").style.display = preventivo ? "block" : "none";
  document.getElementById("mto-bloque-correctivo").style.display = preventivo ? "none" : "block";
  document.getElementById("mto-titulo-materiales").textContent = preventivo ? "Materiales a cambiar (según plan)" : "Materiales usados";
  if(!sinRecargar){ renderPlanMantenimiento(); if(!preventivo) cargarFallasParaCorrectivo(); }
}

async function cambioEquipoMantenimiento(){
  const eq = equipoMtto(document.getElementById("mto-equipo").value);
  const info = document.getElementById("mto-info-unidad");
  const selPm = document.getElementById("mto-pm");
  if(!eq){ info.style.display = "none"; selPm.innerHTML = ""; renderPlanMantenimiento(); return; }
  if(!controlDatos.actualizado && !controlDatos.mantenimientos.length) await cargarControlMantenimiento();
  const r = estadoUnidad(eq);
  info.style.display = "block";
  info.innerHTML = `<div class="fila1"><b>${esc(eq.plan)}</b><span class="badge mtto-estado ${CLASE_ESTADO[r.estado]}">${esc(r.estado)}</span></div>
    <div class="subtexto" style="margin-top:4px;">Le toca: <b>${esc(r.proximo)}</b>${r.proximoTexto ? " a " + esc(r.proximoTexto) : ""}${r.falta != null ? " · " + esc(textoFalta(r)) : ""}</div>
    ${r.lect && eq.control !== "MESES" ? `<div class="subtexto">Última lectura: ${miles(r.lect.lectura)} ${esc(r.unidad)} (${esc(String(r.lect.fecha).slice(0, 10))})</div>` : ""}`;
  const plan = PLANES_MTTO[eq.plan] || { ciclo:[] };
  selPm.innerHTML = plan.ciclo.map(c => `<option value="${esc(c.paso)}" ${c.paso === r.proximo ? "selected" : ""}>${esc(c.paso)}${c.paso === r.proximo ? " (le toca)" : ""}</option>`).join("");
  document.getElementById("mto-lectura-label").textContent = eq.control === "KM" ? "Kilometraje real (km)" : (eq.control === "HR" ? "Horómetro real (h)" : "Horómetro / km (opcional)");
  document.getElementById("mto-lectura").placeholder = r.lect ? String(r.lect.lectura) : "";
  renderPlanMantenimiento();
  if(mtoTipo === "Correctivo") cargarFallasParaCorrectivo();
}

function renderPlanMantenimiento(){
  const eq = equipoMtto(document.getElementById("mto-equipo").value);
  const ayuda = document.getElementById("mto-pm-ayuda");
  mtoMateriales = mtoMateriales.filter(m => m.extra);
  mtoInspeccion = [];
  if(eq && mtoTipo === "Preventivo"){
    const plan = PLANES_MTTO[eq.plan] || { ciclo:[], materiales:{}, inspeccion:{} };
    const pm = document.getElementById("mto-pm").value;
    const paso = plan.ciclo.find(c => c.paso === pm);
    const clave = paso ? paso.mantenimiento : pm;
    const delPlan = (plan.materiales[clave] || []).map(m => ({
      sistema:m.sistema, descripcion:m.descripcion, cantidad_plan:m.cantidad, unidad:m.unidad, precio:m.precio,
      cambiado:"SI", cantidad_usada:m.cantidad, extra:false
    }));
    mtoMateriales = delPlan.concat(mtoMateriales);
    mtoInspeccion = (plan.inspeccion[clave] || []).map(t => ({ sistema:t.sistema, actividad:t.actividad, tarea:t.tarea, resultado:"", obs:"" }));
    ayuda.textContent = `${delPlan.length} material(es) y ${mtoInspeccion.length} tarea(s) de inspección según el plan.`;
  }else{
    ayuda.textContent = "";
  }
  renderMaterialesMantenimiento();
  renderInspeccionMantenimiento();
}

function renderMaterialesMantenimiento(){
  const cont = document.getElementById("mto-materiales");
  cont.innerHTML = mtoMateriales.length ? mtoMateriales.map((m, i) => `
    <div class="mtto-material ${m.cambiado === "NO" ? "no-cambiado" : ""}">
      <div class="mtto-material-texto">
        <b>${esc(m.descripcion)}</b>
        <small>${esc(m.sistema || "")}${m.cantidad_plan !== "" && m.cantidad_plan != null ? ` · plan: ${esc(m.cantidad_plan)} ${esc(m.unidad)}` : ""} · S/ ${(Number(m.precio) || 0).toFixed(2)}</small>
      </div>
      <div class="mtto-material-controles">
        ${m.extra ? "" : `<div class="chk-marcas mtto-sino">
          <button type="button" class="${m.cambiado === "SI" ? "activo marca-C" : ""}" onclick="cambiarMaterialMantenimiento(${i}, 'cambiado', 'SI')">SÍ</button>
          <button type="button" class="${m.cambiado === "NO" ? "activo marca-NC" : ""}" onclick="cambiarMaterialMantenimiento(${i}, 'cambiado', 'NO')">NO</button>
        </div>`}
        <input type="number" step="0.01" min="0" value="${esc(m.cantidad_usada)}" ${m.cambiado === "NO" ? "disabled" : ""}
          title="Cantidad usada" oninput="cambiarMaterialMantenimiento(${i}, 'cantidad_usada', this.value, true)">
        <span class="mtto-unidad-txt">${esc(m.unidad)}</span>
        ${m.extra ? `<button type="button" class="mtto-quitar" onclick="quitarMaterialMantenimiento(${i})">✕</button>` : ""}
      </div>
    </div>`).join("") : `<div class="subtexto">${mtoTipo === "Preventivo" ? "Elige la unidad y el mantenimiento." : "Agrega los materiales que usaste."}</div>`;
  actualizarCostoMantenimiento();
}

function cambiarMaterialMantenimiento(i, campo, valor, sinRepintar){
  mtoMateriales[i][campo] = valor;
  if(sinRepintar) actualizarCostoMantenimiento(); else renderMaterialesMantenimiento();
}

function quitarMaterialMantenimiento(i){ mtoMateriales.splice(i, 1); renderMaterialesMantenimiento(); }

function agregarMaterialMantenimiento(){
  if(typeof CATALOGO_MATERIALES === "undefined") return;
  const input = document.getElementById("mto-material-nuevo");
  const nombre = input.value.trim();
  if(!nombre) return;
  const cat = CATALOGO_MATERIALES.find(m => m.nombre === nombre);
  mtoMateriales.push({
    sistema: mtoTipo === "Preventivo" ? "FUERA DEL PLAN" : "CORRECTIVO", descripcion:nombre,
    cantidad_plan:"", unidad: cat ? cat.um : "UND", precio: cat ? cat.precio : 0,
    cambiado:"SI", cantidad_usada:1, extra:true, codigo: cat ? cat.codigo : ""
  });
  input.value = "";
  renderMaterialesMantenimiento();
}

function costoMantenimiento(){
  return mtoMateriales.reduce((s, m) => s + (m.cambiado === "NO" ? 0 : (Number(m.cantidad_usada) || 0) * (Number(m.precio) || 0)), 0);
}
function actualizarCostoMantenimiento(){ document.getElementById("mto-costo").textContent = `S/ ${costoMantenimiento().toFixed(2)}`; }

function renderInspeccionMantenimiento(){
  const cont = document.getElementById("mto-inspeccion");
  let sistema = null;
  cont.innerHTML = mtoInspeccion.map((t, i) => {
    const cabecera = t.sistema !== sistema ? `<div class="chk-seccion">${esc(sistema = t.sistema)}</div>` : "";
    return `${cabecera}<div class="chk-item" id="mto-ins-${i}">
      <div class="chk-item-texto">${esc(t.tarea)}<div class="chk-item-detalle">${esc(t.actividad)}</div></div>
      <div class="chk-marcas">
        <button type="button" data-res="OK" onclick="marcarInspeccion(${i}, 'OK')">OK</button>
        <button type="button" data-res="NO OK" onclick="marcarInspeccion(${i}, 'NO OK')">NO OK</button>
      </div>
      <textarea class="chk-obs" id="mto-ins-obs-${i}" rows="2" placeholder="¿Qué encontraste? (obligatorio)" style="display:none;" oninput="mtoInspeccion[${i}].obs = this.value"></textarea>
    </div>`;
  }).join("");
}

function marcarInspeccion(i, res){
  mtoInspeccion[i].resultado = res;
  const caja = document.getElementById("mto-ins-" + i);
  caja.classList.remove("falta");
  caja.querySelectorAll(".chk-marcas button").forEach(b => {
    b.classList.remove("activo", "marca-C", "marca-NC");
    if(b.dataset.res === res) b.classList.add("activo", res === "OK" ? "marca-C" : "marca-NC");
  });
  document.getElementById("mto-ins-obs-" + i).style.display = res === "NO OK" ? "block" : "none";
}

function marcarInspeccionOk(){ mtoInspeccion.forEach((t, i) => { if(!t.resultado) marcarInspeccion(i, "OK"); }); }

async function cargarFallasParaCorrectivo(){
  const sel = document.getElementById("mto-falla");
  const codigo = document.getElementById("mto-equipo").value;
  sel.innerHTML = `<option value="">Ninguna / sin falla reportada</option>`;
  if(!codigo) return;
  // Las fallas abiertas ya vienen en el control (sin otra espera al servidor).
  let fallas = (controlDatos.fallas || []).filter(f => fallaAbierta(f) && codigoDeTextoEquipo(f.EQUIPO) === codigo);
  if(!fallas.length && navigator.onLine && !controlDatos.actualizado){
    const resp = await llamarServidor({ tipo:"listado_fallas_abiertas" }, { silencioso:true });
    fallas = (resp && resp.ok ? resp.fallas : []).filter(f => codigoDeTextoEquipo(f.EQUIPO) === codigo);
  }
  sel.innerHTML += fallas.map(f => `<option value="${esc(f.ID_FALLA)}">${esc(f.ID_FALLA)} · ${esc(f.FECHA)} · ${esc(String(f.DESCRIPCION || "").slice(0, 60))}</option>`).join("");
  if(mtoFallaElegida && fallas.some(f => f.ID_FALLA === mtoFallaElegida)) sel.value = mtoFallaElegida;
}

function errorMantenimiento(msg){
  const el = document.getElementById("mto-error");
  el.textContent = msg; el.classList.add("activo");
  mostrarToast(msg, false);
}

async function guardarMantenimiento(){
  const eq = equipoMtto(document.getElementById("mto-equipo").value);
  if(!eq) return errorMantenimiento("Elige la unidad.");
  const preventivo = mtoTipo === "Preventivo";
  const pm = document.getElementById("mto-pm").value;
  if(preventivo && !pm) return errorMantenimiento("Elige el mantenimiento realizado.");
  const fechaIso = document.getElementById("mto-fecha").value;
  if(!fechaIso) return errorMantenimiento("Indica la fecha.");
  const lecturaTexto = document.getElementById("mto-lectura").value.trim();
  const lectura = parseFloat(lecturaTexto);
  if(eq.control !== "MESES" && (lecturaTexto === "" || isNaN(lectura) || lectura < 0)){
    return errorMantenimiento(eq.control === "KM" ? "Escribe el kilometraje real." : "Escribe el horómetro real.");
  }
  const trabajo = document.getElementById("mto-trabajo").value.trim();
  if(!preventivo && !trabajo) return errorMantenimiento("Describe el trabajo realizado.");
  if(preventivo){
    const faltan = mtoInspeccion.map((t, i) => t.resultado ? -1 : i).filter(i => i >= 0);
    if(faltan.length){
      faltan.forEach(i => document.getElementById("mto-ins-" + i).classList.add("falta"));
      document.getElementById("mto-ins-" + faltan[0]).scrollIntoView({ behavior:"smooth", block:"center" });
      return errorMantenimiento(`Falta marcar ${faltan.length} tarea(s) de inspección.`);
    }
    const sinObs = mtoInspeccion.findIndex(t => t.resultado === "NO OK" && !String(t.obs).trim());
    if(sinObs >= 0){
      document.getElementById("mto-ins-" + sinObs).scrollIntoView({ behavior:"smooth", block:"center" });
      return errorMantenimiento("Escribe qué encontraste en cada tarea NO OK.");
    }
  }

  const s = sesionActual();
  const ahora = new Date();
  const registro = {
    id:"MTO-" + ahora.getTime() + "-" + Math.random().toString(16).slice(2, 6),
    tipo:mtoTipo, codigo:eq.codigo, equipo:eq.descripcion, area:eq.area, criticidad:eq.criticidad,
    plan:eq.plan, control:eq.control, pm: preventivo ? pm : "",
    fecha:peDesdeIso(fechaIso), lectura: isNaN(lectura) ? "" : lectura,
    hora_inicio:document.getElementById("mto-hora-inicio").value, hora_fin:document.getElementById("mto-hora-fin").value,
    materiales:mtoMateriales.map(m => ({ sistema:m.sistema, descripcion:m.descripcion, cantidad_plan:m.cantidad_plan, unidad:m.unidad,
      precio:Number(m.precio) || 0, cambiado:m.cambiado, cantidad_usada: m.cambiado === "NO" ? 0 : Number(m.cantidad_usada) || 0, extra:!!m.extra })),
    inspeccion: preventivo ? mtoInspeccion.map(t => ({ sistema:t.sistema, actividad:t.actividad, tarea:t.tarea, resultado:t.resultado, obs:String(t.obs || "").trim() })) : [],
    costo:Math.round(costoMantenimiento() * 100) / 100,
    cambios_fuera_plan:document.getElementById("mto-cambios").value.trim(),
    observaciones:document.getElementById("mto-observaciones").value.trim(),
    trabajo, falla_id: preventivo ? "" : document.getElementById("mto-falla").value,
    cerrar_falla: !preventivo && document.getElementById("mto-cerrar-falla").checked,
    fotos:[...fotosTemp.mantenimiento], tecnico:s.nombre || "—", dni:s.dni || "—", n_ot:"",
    creado:ahora.getTime(), sincronizado:false
  };
  await guardarEnStore("mantenimientos", registro);

  let siguiente = "";
  if(preventivo){
    const plan = PLANES_MTTO[eq.plan];
    const idx = pasoDelCiclo(plan, pm);
    const prox = plan.ciclo[(idx + 1) % plan.ciclo.length];
    siguiente = eq.control === "MESES"
      ? `${prox.paso} el ${fechaPE(sumarMeses(fechaDesdePE(registro.fecha), eq.intervalo))}`
      : `${prox.paso} a los ${miles(lectura + Number(eq.intervalo))} ${UNIDAD_CONTROL[eq.control]}`;
  }
  const noOk = registro.inspeccion.filter(t => t.resultado === "NO OK").length;
  abrirModal(`
    <div class="modal-titulo"><span>Mantenimiento guardado</span><button class="modal-cerrar" onclick="cerrarModal(); abrirControlUnidades();">×</button></div>
    <p class="subtexto">${esc(eq.codigo)} · ${esc(preventivo ? pm : "Correctivo")} · ${esc(registro.fecha)}</p>
    ${siguiente ? `<div class="tarjeta" style="margin:12px 0;"><div class="subtexto">Siguiente mantenimiento</div><div style="font-weight:800;font-size:16px;">${esc(siguiente)}</div></div>` : ""}
    ${noOk ? `<p class="subtexto">Se encontraron <b>${noOk} tarea(s) NO OK</b>: al sincronizar se creará una falla para que se corrija.</p>` : ""}
    <p class="subtexto">El N° de OT lo asigna el servidor al sincronizar.</p>
    <button class="btn btn-primario" style="margin-top:12px;" onclick="cerrarModal(); abrirControlUnidades();">Listo</button>
  `);
  if(navigator.onLine) sincronizarTodo();
}

/* ---------- Pantalla: punto de partida (admin) ---------- */
async function abrirPuntoPartida(){
  irA("pantalla-punto-partida");
  const cont = document.getElementById("partida-lista");
  cont.innerHTML = `<div class="subtexto">Cargando...</div>`;
  await cargarControlMantenimiento();
  cont.innerHTML = EQUIPOS_MTTO.map(eq => {
    const p = controlDatos.parametros.find(x => String(x.CODIGO) === eq.codigo) || {};
    const plan = PLANES_MTTO[eq.plan] || { ciclo:[] };
    const porMeses = eq.control === "MESES";
    const u = UNIDAD_CONTROL[eq.control];
    const id = eq.codigo;
    return `
    <div class="tarjeta mtto-partida" style="margin-bottom:12px;">
      <div style="font-weight:800;font-size:14px;">${esc(eq.codigo)} · ${esc(eq.descripcion)}</div>
      <div class="subtexto" style="margin-bottom:10px;">${esc(eq.plan)} · cada ${miles(eq.intervalo)} ${esc(UNIDAD_INTERVALO[eq.control])}${p.USUARIO ? ` · guardado por ${esc(p.USUARIO)}` : ""}</div>
      <div class="fila-2">
        <div class="campo"><label>${porMeses ? "Lectura actual (no aplica)" : `Lectura actual (${u})`}</label>
          <input type="number" step="0.1" min="0" id="pp-lectura-${id}" value="${esc(p.LECTURA_INICIAL ?? "")}" ${porMeses ? "disabled" : ""}></div>
        <div class="campo"><label>Fecha de esa lectura</label><input type="date" id="pp-fecha-${id}" value="${esc(isoDesdePE(p.FECHA_INICIAL) || hoyIso())}"></div>
      </div>
      <div class="campo"><label>Último preventivo que se le hizo</label>
        <select id="pp-pm-${id}">
          <option value="">— Elige —</option>
          <option value="NINGUNO" ${p.ULTIMO_PM === "NINGUNO" ? "selected" : ""}>Ninguno todavía (empieza con ${esc(plan.ciclo[0] ? plan.ciclo[0].paso : "PM1")})</option>
          ${plan.ciclo.map(c => `<option value="${esc(c.paso)}" ${p.ULTIMO_PM === c.paso ? "selected" : ""}>${esc(c.paso)}</option>`).join("")}
        </select></div>
      <div class="fila-2">
        <div class="campo"><label>${porMeses ? "Lectura (no aplica)" : `Se hizo a los (${u})`}</label>
          <input type="number" step="0.1" min="0" id="pp-lectura-pm-${id}" value="${esc(p.LECTURA_ULTIMO_PM ?? "")}" ${porMeses ? "disabled" : ""}></div>
        <div class="campo"><label>Fecha del último preventivo</label><input type="date" id="pp-fecha-pm-${id}" value="${esc(isoDesdePE(p.FECHA_ULTIMO_PM))}"></div>
      </div>
      <div class="campo"><label>Avisar cuando falten (${esc(u)})</label>
        <input type="number" step="1" min="0" id="pp-aviso-${id}" value="${esc(p.AVISO ?? "")}" placeholder="${AVISO_POR_CONTROL[eq.control]} (por defecto)"></div>
      <button class="btn btn-secundario" style="margin-top:0;" onclick="guardarPuntoPartida(${jsArg(id)}, this)">Guardar ${esc(eq.codigo)}</button>
    </div>`;
  }).join("");
}

async function guardarPuntoPartida(codigo, boton){
  const eq = equipoMtto(codigo);
  const v = id => document.getElementById(id + codigo).value.trim();
  const ultimoPm = v("pp-pm-");
  if(!ultimoPm){ mostrarToast("Elige el último preventivo (o 'Ninguno todavía').", false); return; }
  if(eq.control !== "MESES" && v("pp-lectura-") === ""){ mostrarToast("Escribe la lectura actual.", false); return; }
  if(ultimoPm !== "NINGUNO"){
    if(eq.control !== "MESES" && v("pp-lectura-pm-") === ""){ mostrarToast("Escribe a qué lectura se hizo el último preventivo.", false); return; }
    if(eq.control === "MESES" && !v("pp-fecha-pm-")){ mostrarToast("Escribe la fecha del último preventivo.", false); return; }
  }
  if(!navigator.onLine){ mostrarToast("Necesitas internet para guardar el punto de partida.", false); return; }
  boton.disabled = true; boton.textContent = "Guardando...";
  const resp = await llamarServidor({ tipo:"guardar_parametros_unidad", parametros:{
    codigo, equipo:eq.descripcion,
    lectura_inicial: eq.control === "MESES" ? "" : v("pp-lectura-"), fecha_inicial: peDesdeIso(v("pp-fecha-")),
    ultimo_pm: ultimoPm, lectura_ultimo_pm: ultimoPm === "NINGUNO" || eq.control === "MESES" ? "" : v("pp-lectura-pm-"),
    fecha_ultimo_pm: ultimoPm === "NINGUNO" ? "" : peDesdeIso(v("pp-fecha-pm-")), aviso: v("pp-aviso-")
  }});
  boton.disabled = false; boton.textContent = `Guardar ${codigo}`;
  mostrarToast((resp && resp.mensaje) || "No se pudo guardar", !!(resp && resp.ok));
  if(resp && resp.ok){ await cargarControlMantenimiento(); actualizarAlertaMantenimiento(false); }
}
