/* ============ MÓDULO: CHECKLIST DIARIO DE EQUIPOS ============
   Los formatos (puntos a revisar, equipos, horómetro o km) están en
   datos/checklists.js. Cada checklist lleno se guarda primero en el
   celular (almacén "checklists") y se sube al sincronizar, igual que las
   actividades y fallas. */

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
fotosTemp.checklist = [];

let chkPlantilla = null;      // formato que se está llenando
let chkRespuestas = [];       // un objeto por punto: {seccion, item, detalle, marca, obs}
let chkUtilizar = "";         // "SI" / "NO"
let chkUltimaLectura = null;  // {lectura, fecha} del equipo elegido

/* ---------- Fechas y semanas ---------- */
function indiceDiaSemana(fecha){ return (fecha.getDay() + 6) % 7; } // lunes = 0

function lunesDe(fecha){
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - indiceDiaSemana(d));
  return d;
}

/* Semana ISO, por ejemplo "2026-S42" (la semana empieza el lunes). */
function semanaISO(fecha){
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicioAnio) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(semana).padStart(2, "0")}`;
}

function fechaCorta(d){ return d.toLocaleDateString("es-PE", { day:"2-digit", month:"2-digit" }); }

function parsearFechaPE(texto){
  const p = String(texto || "").split("/");
  return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]) : null;
}

/* ---------- Equipos ---------- */
function plantillaPorId(id){ return CHECKLISTS.find(p => p.id === id) || null; }

function equiposDePlantilla(p){
  return EQUIPOS.filter(e => p.filtroEquipos.test(e.desc));
}

function claveEquipo(codigo, nombre){
  return codigo ? String(codigo) : String(nombre || "").trim().toUpperCase();
}

/* "VL001- TRIMOTO MAVILA 1 - CAMPO" → "Campo" (el área va al final). */
function areaDeEquipo(desc){
  const partes = String(desc || "").split(/\s+-\s+/);
  if(partes.length < 2) return "";
  const area = partes[partes.length - 1].trim().toLowerCase();
  return area.replace(/(^|\s)\S/g, letra => letra.toUpperCase());
}

function equipoSeleccionado(){
  const valor = document.getElementById("chk-equipo").value;
  if(!valor) return null;
  if(valor === "__otro"){
    const texto = document.getElementById("chk-equipo-otro").value.trim();
    if(!texto) return null;
    return { codigo:"", nombre:texto, area:"", clave:claveEquipo("", texto) };
  }
  const e = EQUIPOS.find(x => x.codigo === valor);
  return e ? { codigo:e.codigo, nombre:e.desc, area:areaDeEquipo(e.desc), clave:claveEquipo(e.codigo) } : null;
}

/* ---------- Horómetro / km del día anterior ---------- */
function leerCacheLecturas(){
  try{ return JSON.parse(localStorage.getItem("cache_lecturas") || "{}"); }catch(e){ return {}; }
}

/* Trae del servidor el último horómetro/km de cada equipo (si hay internet).
   Va por detrás (sin tapar la pantalla) y como mucho cada 5 minutos: lo que
   se llena en este celular ya cuenta desde el almacén local. */
async function actualizarCacheLecturas(){
  if(!navigator.onLine || !tokenSesion()) return;
  const ultima = Number(localStorage.getItem("cache_lecturas_ts") || 0);
  if(Date.now() - ultima < 5 * 60 * 1000) return;
  const resp = await llamarServidor({ tipo:"lecturas_equipos" }, { silencioso:true });
  if(resp && resp.ok && resp.lecturas){
    try{
      localStorage.setItem("cache_lecturas", JSON.stringify(resp.lecturas));
      localStorage.setItem("cache_lecturas_ts", String(Date.now()));
    }catch(e){}
  }
}

async function ultimaLecturaDe(clave){
  let mejor = leerCacheLecturas()[clave] || null;
  const locales = await leerStore("checklists");
  locales.filter(r => r.equipo_clave === clave && r.lectura != null).forEach(r => {
    if(!mejor || Number(r.lectura) > Number(mejor.lectura)) mejor = { lectura:Number(r.lectura), fecha:r.fecha };
  });
  return mejor;
}

/* ---------- Pantalla: elegir checklist ---------- */
async function abrirChecklists(){
  const sesion = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  document.getElementById("checklist-plantillas").innerHTML = CHECKLISTS.map(p => {
    const nItems = p.secciones.reduce((n, s) => n + s.items.length, 0);
    return `
    <button class="modulo-btn" onclick="abrirFormChecklist(${jsArg(p.id)})">
      <div class="modulo-icono morado">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3h6v3H9zM6 6h12v15H6z"/><path d="M9 12l2 2 4-4"/></svg>
      </div>
      <div class="modulo-txt">
        <div class="titulo-lg">${esc(p.nombre)}</div>
        <div class="subtexto">${esc(p.codigo)} · ${nItems} puntos · ${esc(p.lectura.etiqueta)}</div>
      </div>
      <div class="modulo-flecha"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>`;
  }).join("");
  const puedeVerSemana = sesion.rol === "admin" || sesion.rol === "tecnico" || sesion.es_jefe_area;
  document.getElementById("btn-checklist-semanal").style.display = puedeVerSemana ? "flex" : "none";
  irA("pantalla-checklists");
  renderChecklistsRecientes();
  actualizarCacheLecturas();
}

async function renderChecklistsRecientes(){
  const cont = document.getElementById("checklist-recientes");
  const sesion = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  const registros = (await leerStore("checklists")).filter(r => !sesion.dni || r.dni === sesion.dni).slice(0, 8);
  if(registros.length === 0){
    cont.innerHTML = `<div class="subtexto">Todavía no llenas ningún checklist en este celular.</div>`;
    return;
  }
  cont.innerHTML = registros.map(r => `
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${esc(r.nombre_formato)} · ${esc(r.equipo)}</div>
          <div class="subtexto" style="margin-top:2px;">${esc(r.dia)} ${esc(r.fecha)} · ${esc(r.lectura)} ${esc(r.lectura_unidad)}</div>
        </div>
        <span class="badge ${r.sincronizado ? "" : "pendiente"}">${r.sincronizado ? "Sincronizado" : "Pendiente"}</span>
      </div>
      <div class="badge-fila" style="margin-top:8px;">
        ${r.nc ? `<span class="badge criticidad-alta">${r.nc} NC</span>` : `<span class="badge criticidad-baja">Sin NC</span>`}
        ${r.observados ? `<span class="badge criticidad-media">${r.observados} observado(s)</span>` : ""}
        ${r.puede_utilizar === "NO" ? `<span class="badge criticidad-alta">No se puede utilizar</span>` : ""}
      </div>
    </div>`).join("");
}

/* ---------- Pantalla: llenar checklist ---------- */
function abrirFormChecklist(idPlantilla){
  const p = plantillaPorId(idPlantilla);
  if(!p) return;
  chkPlantilla = p;
  chkUtilizar = "";
  chkUltimaLectura = null;
  fotosTemp.checklist = [];
  renderFotoPreviews("checklist", "chk-foto-previews");

  document.getElementById("chk-titulo").textContent = p.nombre;
  document.getElementById("chk-formato-info").innerHTML = `
    <div style="font-weight:800;font-size:14px;">${esc(p.titulo)}</div>
    <div class="subtexto" style="margin-top:2px;">${esc(p.codigo)} · ${esc(new Date().toLocaleDateString("es-PE", { weekday:"long", day:"2-digit", month:"long" }))}</div>`;

  const equipos = equiposDePlantilla(p);
  document.getElementById("chk-equipo").innerHTML =
    `<option value="">${equipos.length ? "Selecciona el equipo" : "Elige una opción"}</option>` +
    equipos.map(e => `<option value="${esc(e.codigo)}">${esc(e.codigo)} - ${esc(e.desc)}</option>`).join("") +
    `<option value="__otro">Otro (escribir)</option>`;
  const otro = document.getElementById("chk-equipo-otro");
  otro.value = "";
  if(equipos.length === 0){
    document.getElementById("chk-equipo").value = "__otro";
    otro.style.display = "block";
  }else{
    otro.style.display = "none";
  }

  document.getElementById("chk-campo-turno").style.display = p.pideTurno ? "block" : "none";
  document.getElementById("chk-turno").value = "";

  const tractores = equiposDePlantilla(plantillaPorId("tractor") || { filtroEquipos:/^$/ });
  document.getElementById("chk-campo-tractor").style.display = p.pideTractor ? "block" : "none";
  document.getElementById("chk-tractor").innerHTML = `<option value="">Selecciona el tractor</option>` +
    tractores.map(e => `<option value="${esc(e.codigo + " - " + e.desc)}">${esc(e.codigo)} - ${esc(e.desc)}</option>`).join("") +
    `<option value="__otro">Otro (escribir)</option>`;
  document.getElementById("chk-tractor-otro").value = "";
  document.getElementById("chk-tractor-otro").style.display = "none";

  document.getElementById("chk-lectura-label").textContent = `${p.lectura.etiqueta} (${p.lectura.unidad})`;
  document.getElementById("chk-lectura").value = "";
  document.getElementById("chk-lectura-ayuda").textContent = "";
  document.getElementById("chk-lectura-ayuda").classList.remove("alerta");
  document.getElementById("chk-confirmar-lectura").style.display = "none";
  document.getElementById("chk-confirmar-lectura-check").checked = false;

  document.getElementById("chk-leyenda").innerHTML = p.marcas
    .map(m => `<span><b class="chk-pill marca-${m}">${m}</b> ${esc(NOMBRES_MARCAS[m])}</span>`).join("");

  chkRespuestas = [];
  let html = "";
  p.secciones.forEach(s => {
    if(s.nombre) html += `<div class="chk-seccion">${esc(s.nombre)}</div>`;
    s.items.forEach(it => {
      const i = chkRespuestas.length;
      chkRespuestas.push({ seccion:s.nombre, item:it.texto, detalle:it.detalle || "", marca:"", obs:"" });
      html += `
        <div class="chk-item" id="chk-item-${i}">
          <div class="chk-item-texto">${esc(it.texto)}${it.detalle ? `<div class="chk-item-detalle">${esc(it.detalle)}</div>` : ""}</div>
          <div class="chk-marcas">
            ${p.marcas.map(m => `<button type="button" data-marca="${m}" title="${esc(NOMBRES_MARCAS[m])}" onclick="marcarItemChecklist(${i}, '${m}')">${m}</button>`).join("")}
          </div>
          <textarea class="chk-obs" id="chk-obs-${i}" rows="2" placeholder="¿Qué encontraste?" style="display:none;" oninput="chkRespuestas[${i}].obs = this.value"></textarea>
        </div>`;
    });
  });
  document.getElementById("chk-items").innerHTML = html;

  document.getElementById("chk-observaciones").value = "";
  document.querySelectorAll(".chk-utilizar button").forEach(b => b.classList.remove("activo", "marca-C", "marca-NC"));
  document.getElementById("chk-error").classList.remove("activo");
  irA("pantalla-form-checklist");
}

function marcarItemChecklist(i, marca){
  chkRespuestas[i].marca = marca;
  const caja = document.getElementById("chk-item-" + i);
  caja.classList.remove("falta");
  caja.querySelectorAll(".chk-marcas button").forEach(b => {
    b.classList.remove("activo", "marca-C", "marca-NC", "marca-O", "marca-NA");
    if(b.dataset.marca === marca) b.classList.add("activo", "marca-" + marca);
  });
  const obs = document.getElementById("chk-obs-" + i);
  const pideObs = marca === "NC" || marca === "O";
  obs.style.display = pideObs ? "block" : "none";
  obs.placeholder = marca === "NC" ? "¿Qué falla encontraste? (obligatorio)" : "¿Qué observaste?";
}

function marcarRestoConforme(){
  chkRespuestas.forEach((r, i) => { if(!r.marca) marcarItemChecklist(i, "C"); });
}

function elegirUtilizarChecklist(valor){
  chkUtilizar = valor;
  document.querySelectorAll(".chk-utilizar button").forEach(b => {
    b.classList.remove("activo", "marca-C", "marca-NC");
    if(b.dataset.valor === valor) b.classList.add("activo", valor === "SI" ? "marca-C" : "marca-NC");
  });
}

async function cambioEquipoChecklist(){
  const sel = document.getElementById("chk-equipo");
  document.getElementById("chk-equipo-otro").style.display = sel.value === "__otro" ? "block" : "none";
  const eq = equipoSeleccionado();
  chkUltimaLectura = eq ? await ultimaLecturaDe(eq.clave) : null;
  revisarLecturaChecklist();
}

/* Avisa si el horómetro/km es menor que el último registrado (casi siempre
   es un error de tipeo). Se puede confirmar si de verdad es correcto. */
function revisarLecturaChecklist(){
  const ayuda = document.getElementById("chk-lectura-ayuda");
  const confirmar = document.getElementById("chk-confirmar-lectura");
  const unidad = chkPlantilla ? chkPlantilla.lectura.unidad : "";
  const valor = parseFloat(document.getElementById("chk-lectura").value);
  ayuda.classList.remove("alerta");
  confirmar.style.display = "none";
  if(!chkUltimaLectura){
    ayuda.textContent = equipoSeleccionado() ? "Es el primer registro de este equipo." : "";
    return;
  }
  ayuda.textContent = `Último registrado: ${chkUltimaLectura.lectura} ${unidad} (${chkUltimaLectura.fecha || "sin fecha"})`;
  if(!isNaN(valor) && valor < Number(chkUltimaLectura.lectura)){
    ayuda.textContent = `Ojo: es menor que el último registrado (${chkUltimaLectura.lectura} ${unidad} el ${chkUltimaLectura.fecha || "—"}). Revisa que esté bien escrito.`;
    ayuda.classList.add("alerta");
    confirmar.style.display = "flex";
  }
}

function errorChecklist(mensaje){
  const el = document.getElementById("chk-error");
  el.textContent = mensaje;
  el.classList.add("activo");
  mostrarToast(mensaje, false);
}

async function guardarChecklist(){
  const p = chkPlantilla;
  if(!p) return;
  document.getElementById("chk-error").classList.remove("activo");

  const eq = equipoSeleccionado();
  if(!eq) return errorChecklist("Elige el equipo que estás revisando.");
  const turno = document.getElementById("chk-turno").value;
  if(p.pideTurno && !turno) return errorChecklist("Elige el turno.");

  let tractor = "";
  if(p.pideTractor){
    tractor = document.getElementById("chk-tractor").value;
    if(tractor === "__otro") tractor = document.getElementById("chk-tractor-otro").value.trim();
    if(!tractor) return errorChecklist("Indica con qué tractor trabaja el implemento.");
  }

  const lecturaTexto = document.getElementById("chk-lectura").value.trim();
  const lectura = parseFloat(lecturaTexto);
  if(lecturaTexto === "" || isNaN(lectura) || lectura < 0){
    return errorChecklist(`Escribe el ${p.lectura.etiqueta.toLowerCase()} de hoy.`);
  }
  if(chkUltimaLectura && lectura < Number(chkUltimaLectura.lectura) && !document.getElementById("chk-confirmar-lectura-check").checked){
    revisarLecturaChecklist();
    return errorChecklist(`El ${p.lectura.etiqueta.toLowerCase()} es menor que el último registrado. Corrígelo o confirma que es correcto.`);
  }

  const faltantes = chkRespuestas.map((r, i) => r.marca ? -1 : i).filter(i => i >= 0);
  if(faltantes.length){
    faltantes.forEach(i => document.getElementById("chk-item-" + i).classList.add("falta"));
    document.getElementById("chk-item-" + faltantes[0]).scrollIntoView({ behavior:"smooth", block:"center" });
    return errorChecklist(`Falta marcar ${faltantes.length} punto(s).`);
  }
  const ncSinObs = chkRespuestas.findIndex(r => r.marca === "NC" && !r.obs.trim());
  if(ncSinObs >= 0){
    document.getElementById("chk-item-" + ncSinObs).scrollIntoView({ behavior:"smooth", block:"center" });
    document.getElementById("chk-obs-" + ncSinObs).focus();
    return errorChecklist("Escribe qué falla encontraste en cada punto No conforme (NC).");
  }
  if(!chkUtilizar) return errorChecklist("Responde si el equipo se puede utilizar.");

  const sesion = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  const ahora = new Date();
  const registro = {
    id: "CHK-" + ahora.getTime() + "-" + Math.random().toString(16).slice(2, 6),
    plantilla: p.id, codigo_formato: p.codigo, nombre_formato: p.nombre,
    equipo_codigo: eq.codigo, equipo: eq.nombre, equipo_clave: eq.clave, area: eq.area,
    turno: p.pideTurno ? turno : "", tractor,
    fecha: fechaPE(ahora),
    hora: ahora.toTimeString().slice(0, 5),
    semana: semanaISO(ahora), dia: DIAS_SEMANA[indiceDiaSemana(ahora)],
    lectura, lectura_tipo: p.lectura.tipo, lectura_unidad: p.lectura.unidad,
    respuestas: chkRespuestas.map(r => ({ seccion:r.seccion, item:r.item, marca:r.marca, obs:r.obs.trim() })),
    nc: chkRespuestas.filter(r => r.marca === "NC").length,
    observados: chkRespuestas.filter(r => r.marca === "O").length,
    puede_utilizar: chkUtilizar,
    observaciones: document.getElementById("chk-observaciones").value.trim(),
    fotos: [...fotosTemp.checklist],
    usuario: sesion.nombre || "—", dni: sesion.dni || "—", rol: sesion.rol || "",
    creado: ahora.getTime(),
    sincronizado: false
  };

  await guardarEnStore("checklists", registro);
  mostrarToast("Checklist guardado" + (navigator.onLine ? "" : " (pendiente de sincronizar)"), true);

  if(registro.nc > 0 || registro.puede_utilizar === "NO"){
    avisarFallaAutomatica(registro);
  }else{
    abrirChecklists();
  }
  if(navigator.onLine) sincronizarTodo();
}

/* ---------- NC o "No se puede utilizar" → alerta automática ----------
   La falla la crea el servidor al sincronizar (no depende de que el
   operador acepte), así le llega al técnico en Alertas / Fallas abiertas. */
function avisarFallaAutomatica(registro){
  const motivo = registro.puede_utilizar === "NO"
    ? "Marcaste que el equipo <b>no se puede utilizar</b>."
    : `Encontraste <b>${registro.nc} punto(s) No conforme</b>.`;
  abrirModal(`
    <div class="modal-titulo"><span>Se avisará a mantenimiento</span><button class="modal-cerrar" onclick="cerrarModal(); abrirChecklists();">×</button></div>
    <p class="subtexto">${motivo} Al sincronizar se crea automáticamente una alerta de falla para que un técnico la corrija.${navigator.onLine ? "" : " Ahora no tienes señal: se enviará cuando vuelva la conexión."}</p>
    <button class="btn btn-primario" style="margin-top:14px;" onclick="cerrarModal(); abrirChecklists();">Entendido</button>
  `);
}

/* ---------- Vista semanal (técnicos, admins y jefes de área) ---------- */
let semanaChecklist = null; // lo último que se mostró, para el Excel

function abrirChecklistSemanal(){
  document.getElementById("sem-plantilla").innerHTML = CHECKLISTS
    .map(p => `<option value="${esc(p.id)}">${esc(p.nombre)} (${esc(p.codigo)})</option>`).join("");
  const hoy = new Date();
  document.getElementById("sem-fecha").value =
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  document.getElementById("sem-resultado").innerHTML = "";
  llenarEquiposSemanal();
  irA("pantalla-checklist-semanal");
}

async function llenarEquiposSemanal(){
  const p = plantillaPorId(document.getElementById("sem-plantilla").value);
  if(!p) return;
  const opciones = equiposDePlantilla(p).map(e => ({ clave:claveEquipo(e.codigo), texto:`${e.codigo} - ${e.desc}` }));
  // Equipos escritos a mano en checklists de este celular.
  (await leerStore("checklists")).filter(r => r.plantilla === p.id && !r.equipo_codigo).forEach(r => {
    if(!opciones.some(o => o.clave === r.equipo_clave)) opciones.push({ clave:r.equipo_clave, texto:r.equipo });
  });
  document.getElementById("sem-equipo").innerHTML = opciones.length
    ? opciones.map(o => `<option value="${esc(o.clave)}">${esc(o.texto)}</option>`).join("")
    : `<option value="">(Todavía no hay equipos con este checklist)</option>`;
}

/* Fila del servidor (hoja CHECKLISTS) → mismo formato que un registro local. */
function checklistDesdeServidor(f){
  let respuestas = f.RESPUESTAS;
  if(!Array.isArray(respuestas)){ try{ respuestas = JSON.parse(f.RESPUESTAS_JSON || "[]"); }catch(e){ respuestas = []; } }
  return {
    id:f.ID_CHECKLIST, plantilla:f.PLANTILLA, fecha:String(f.FECHA || ""), dia:f.DIA, semana:f.SEMANA,
    equipo_clave:String(f.EQUIPO_CLAVE || ""), equipo:f.EQUIPO, equipo_codigo:f.EQUIPO_CODIGO, area:f.AREA,
    turno:f.TURNO, tractor:f.TRACTOR, lectura:f.LECTURA, lectura_unidad:f.LECTURA_TIPO === "km" ? "km" : "h",
    respuestas, puede_utilizar:f.PUEDE_UTILIZAR, observaciones:f.OBSERVACIONES,
    fotos:String(f.FOTOS || "").split("|").map(s => s.trim()).filter(Boolean),
    usuario:f.USUARIO, dni:String(f.DNI || ""), sincronizado:true
  };
}

async function verSemanaChecklist(){
  const p = plantillaPorId(document.getElementById("sem-plantilla").value);
  const clave = document.getElementById("sem-equipo").value;
  const fechaTexto = document.getElementById("sem-fecha").value;
  const cont = document.getElementById("sem-resultado");
  if(!p || !clave || !fechaTexto){ cont.innerHTML = `<div class="subtexto">Elige el formato, el equipo y la semana.</div>`; return; }

  const [a, m, d] = fechaTexto.split("-").map(Number);
  const lunes = lunesDe(new Date(a, m - 1, d));
  const semana = semanaISO(lunes);
  cont.innerHTML = `<div class="subtexto">Cargando...</div>`;

  let registros = [], vistos = [], aviso = "";
  const resp = navigator.onLine ? await llamarServidor({ tipo:"listado_checklists", plantilla:p.id, semana }) : null;
  if(resp && resp.ok){
    registros = (resp.checklists || []).map(checklistDesdeServidor);
    vistos = (resp.vistos_buenos || []).filter(v => String(v.EQUIPO_CLAVE) === clave);
  }else{
    aviso = "No se pudo conectar con el servidor: solo se muestran los checklists guardados en este celular.";
  }
  (await leerStore("checklists")).forEach(r => {
    if(r.plantilla === p.id && r.semana === semana && !registros.some(x => x.id === r.id)) registros.push(r);
  });
  registros = registros.filter(r => r.equipo_clave === clave);

  const dias = DIAS_SEMANA.map((nombre, i) => {
    const fecha = new Date(lunes); fecha.setDate(lunes.getDate() + i);
    const fechaDelDia = fechaPE(fecha);
    return { nombre, fecha, registros: registros.filter(r => mismaFechaPE(r.fecha, fechaDelDia)).sort((x, y) => (x.turno > y.turno ? 1 : -1)) };
  });
  const equipoTexto = document.getElementById("sem-equipo").selectedOptions[0].text;
  semanaChecklist = { plantilla:p, clave, equipoTexto, semana, lunes, dias, vistos, registros };
  renderSemanaChecklist(aviso);
}

function marcaDelDia(dia, item){
  return dia.registros.map(r => {
    const resp = (r.respuestas || []).find(x => x.item === item);
    return resp ? resp.marca : "";
  }).filter(Boolean);
}

function renderSemanaChecklist(aviso){
  const s = semanaChecklist;
  const p = s.plantilla;
  const sesion = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  const cont = document.getElementById("sem-resultado");
  const domingo = new Date(s.lunes); domingo.setDate(s.lunes.getDate() + 6);
  const area = (s.registros.find(r => r.area) || {}).area || areaDeEquipo(s.equipoTexto);

  let html = aviso ? `<div class="tarjeta chk-aviso">${esc(aviso)}</div>` : "";
  html += `
    <div class="tarjeta" style="margin-bottom:12px;">
      <div style="font-weight:800;">${esc(p.titulo)}</div>
      <div class="subtexto">${esc(p.codigo)} · ${esc(s.equipoTexto)}${area ? " · " + esc(area) : ""}</div>
      <div class="subtexto">Semana ${esc(s.semana.split("-S")[1])}: del ${esc(fechaCorta(s.lunes))} al ${esc(fechaCorta(domingo))}</div>
    </div>`;

  if(s.registros.length === 0){
    cont.innerHTML = html + `<div class="vacio"><div class="subtexto">No hay checklists de este equipo en esa semana.</div></div>`;
    return;
  }

  const celda = marcas => marcas.length
    ? marcas.map(m => `<span class="chk-pill marca-${esc(m)}">${esc(m)}</span>`).join(" ")
    : `<span class="chk-vacio">—</span>`;
  const filaExtra = (titulo, valorDe) =>
    `<tr class="chk-fila-extra"><th>${titulo}</th>${s.dias.map(d => `<td>${d.registros.map(valorDe).map(esc).join("<br>") || "—"}</td>`).join("")}</tr>`;

  html += `<div class="chk-tabla-scroll"><table class="chk-tabla"><thead><tr><th>Aspecto a revisar</th>` +
    s.dias.map(d => `<th>${d.nombre.slice(0, 3)}<br><small>${fechaCorta(d.fecha)}</small></th>`).join("") + `</tr></thead><tbody>`;
  p.secciones.forEach(sec => {
    if(sec.nombre) html += `<tr class="chk-fila-seccion"><td colspan="8">${esc(sec.nombre)}</td></tr>`;
    sec.items.forEach(it => {
      html += `<tr><th>${esc(it.texto)}</th>${s.dias.map(d => `<td>${celda(marcaDelDia(d, it.texto))}</td>`).join("")}</tr>`;
    });
  });
  html += filaExtra(esc(p.lectura.etiqueta), r => `${r.lectura} ${r.lectura_unidad || p.lectura.unidad}`);
  if(p.pideTurno) html += filaExtra("Turno", r => r.turno || "—");
  if(p.pideTractor) html += filaExtra("Tractor", r => r.tractor || "—");
  html += filaExtra("Responsable", r => r.usuario || "—");
  html += `<tr class="chk-fila-extra"><th>¿Se puede utilizar?</th>${s.dias.map(d =>
    `<td>${d.registros.map(r => `<span class="chk-pill ${r.puede_utilizar === "NO" ? "marca-NC" : "marca-C"}">${esc(r.puede_utilizar)}</span>`).join(" ") || "—"}</td>`).join("")}</tr>`;
  html += `</tbody></table></div>`;

  const notas = [];
  s.dias.forEach(d => d.registros.forEach(r => {
    (r.respuestas || []).filter(x => x.obs).forEach(x => notas.push(`<b>${esc(d.nombre)}</b> · ${esc(x.item)} (${esc(x.marca)}): ${esc(x.obs)}`));
    if(r.observaciones) notas.push(`<b>${esc(d.nombre)}</b> · General: ${esc(r.observaciones)}`);
  }));
  const fotos = s.registros.flatMap(r => r.fotos || []);
  html += `<div class="tarjeta" style="margin-top:12px;">
      <div style="font-weight:700;font-size:13.5px;margin-bottom:6px;">Observaciones</div>
      ${notas.length ? notas.map(n => `<div class="subtexto" style="margin-bottom:4px;">${n}</div>`).join("") : `<div class="subtexto">Sin observaciones.</div>`}
      ${fotos.length ? fotosHtmlAdmin(fotos.join("|"), 56) : ""}
    </div>`;

  const vb = tipo => s.vistos.find(v => v.TIPO === tipo);
  const lineaVb = (tipo, titulo, puede) => {
    const v = vb(tipo);
    if(v) return `<div class="chk-vb ok">✓ <b>${esc(titulo)}:</b> ${esc(v.NOMBRE)} · ${esc(v.FECHA)}</div>`;
    return `<div class="chk-vb"><b>${esc(titulo)}:</b> pendiente
      ${puede ? `<button class="btn btn-secundario chk-btn-vb" onclick="darVistoBuenoChecklist(${jsArg(tipo)})">Dar visto bueno</button>` : ""}</div>`;
  };
  html += `<div class="tarjeta" style="margin-top:12px;">
      <div style="font-weight:700;font-size:13.5px;margin-bottom:8px;">Visto bueno de la semana</div>
      ${lineaVb("area", "Supervisor responsable del área", sesion.rol === "admin" || sesion.es_jefe_area)}
      ${lineaVb("mantenimiento", "Supervisor de mantenimiento", sesion.rol === "admin")}
    </div>
    <button class="btn btn-primario" style="margin-top:14px;" onclick="exportarSemanaChecklistExcel()">⬇ Descargar Excel de la semana</button>`;
  cont.innerHTML = html;
}

async function darVistoBuenoChecklist(tipo){
  const s = semanaChecklist;
  if(!s) return;
  if(!navigator.onLine){ mostrarToast("Necesitas internet para dar el visto bueno", false); return; }
  const resp = await llamarServidor({
    tipo:"visto_bueno_checklist", plantilla:s.plantilla.id, semana:s.semana,
    equipo_clave:s.clave, equipo:s.equipoTexto, tipo_vb:tipo
  });
  mostrarToast((resp && resp.mensaje) || "No se pudo guardar el visto bueno", !!(resp && resp.ok));
  if(resp && resp.ok) verSemanaChecklist();
}

/* Excel con el mismo orden que la hoja en papel: puntos × días. */
async function exportarSemanaChecklistExcel(){
  const s = semanaChecklist;
  if(!s) return;
  try{ await asegurarXLSX(); }catch(e){ mostrarToast(e.message, false); return; }
  const p = s.plantilla;
  const domingo = new Date(s.lunes); domingo.setDate(s.lunes.getDate() + 6);
  const unir = (lista) => lista.filter(Boolean).join(" / ");
  const filas = [
    ["TALLER DE MANTENIMIENTO Y OPERACIONES", "", "", "", "", "", "", "", p.codigo],
    [p.titulo.toUpperCase()],
    [],
    ["Equipo:", s.equipoTexto],
    ["Semana:", `${s.semana} (del ${fechaPE(s.lunes)} al ${fechaPE(domingo)})`],
    ["Leyenda:", p.marcas.map(m => `${m} = ${NOMBRES_MARCAS[m]}`).join("   ")],
    [],
    ["ASPECTO A REVISAR", ...s.dias.map(d => `${d.nombre.toUpperCase()} ${fechaCorta(d.fecha)}`), "OBSERVACIÓN"]
  ];
  p.secciones.forEach(sec => {
    if(sec.nombre) filas.push([sec.nombre.toUpperCase()]);
    sec.items.forEach(it => {
      const obs = s.dias.flatMap(d => d.registros.map(r => {
        const x = (r.respuestas || []).find(y => y.item === it.texto);
        return x && x.obs ? `${d.nombre.slice(0, 3)}: ${x.obs}` : "";
      }));
      filas.push([it.texto, ...s.dias.map(d => unir(marcaDelDia(d, it.texto))), unir(obs)]);
    });
  });
  filas.push([`${p.lectura.etiqueta.toUpperCase()} (${p.lectura.unidad})`, ...s.dias.map(d => unir(d.registros.map(r => String(r.lectura))))]);
  if(p.pideTurno) filas.push(["TURNO", ...s.dias.map(d => unir(d.registros.map(r => r.turno)))]);
  if(p.pideTractor) filas.push(["TRACTOR", ...s.dias.map(d => unir(d.registros.map(r => r.tractor)))]);
  filas.push(["RESPONSABLE", ...s.dias.map(d => unir(d.registros.map(r => r.usuario)))]);
  filas.push(["DNI DE LA PERSONA RESPONSABLE", ...s.dias.map(d => unir(d.registros.map(r => r.dni)))]);
  filas.push(["¿EL EQUIPO SE PUEDE UTILIZAR?", ...s.dias.map(d => unir(d.registros.map(r => r.puede_utilizar)))]);
  filas.push([]);
  const generales = s.dias.flatMap(d => d.registros.filter(r => r.observaciones).map(r => `${d.nombre}: ${r.observaciones}`));
  filas.push(["OBSERVACIONES:", generales.join(" | ")]);
  filas.push([]);
  const vb = tipo => s.vistos.find(v => v.TIPO === tipo);
  filas.push(["VISTO BUENO SUPERVISOR RESPONSABLE:", vb("area") ? `${vb("area").NOMBRE} (${vb("area").FECHA})` : "Pendiente"]);
  filas.push(["VISTO BUENO SUPERVISOR MANTENIMIENTO:", vb("mantenimiento") ? `${vb("mantenimiento").NOMBRE} (${vb("mantenimiento").FECHA})` : "Pendiente"]);

  const hoja = XLSX.utils.aoa_to_sheet(filas);
  hoja["!cols"] = [{ wch:48 }, ...s.dias.map(() => ({ wch:14 })), { wch:50 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Checklist");
  const nombreArchivo = `Checklist_${p.nombre}_${s.equipoTexto.split(" - ")[0]}_${s.semana}`.replace(/[^\w\-]+/g, "_");
  XLSX.writeFile(libro, nombreArchivo + ".xlsx");
}
