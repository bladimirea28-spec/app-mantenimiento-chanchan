/* ============ EXPORTAR A EXCEL (listo para Power BI) ============
   Cada apartado del panel admin tiene su botón "⬇ Excel" que descarga solo
   lo de esa pantalla (con el filtro que esté puesto). "Exportar todo" junta
   todas las hojas en un solo archivo, sin filtros.

   Reglas para que Power BI lo lea sin arreglos:
   - Una tabla por hoja, empezando en A1, sin títulos ni celdas combinadas.
   - Fechas como fecha real de Excel; números como número.
   - Códigos de equipo y DNI como texto (con su cero adelante: 04101).
   - Los nombres de las columnas no cambian: si se agrega algo, va al final.
   - El nombre del archivo es siempre el mismo (sin la fecha), para
     reemplazarlo en la misma carpeta y darle "Actualizar" en Power BI. */

/* ---------- Conversión de valores ---------- */
function fechaParaExcel(v){
  if(v == null || v === "") return null;
  if(v instanceof Date) return isNaN(v) ? null : v;
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(m){
    // Con zona horaria (ej. "...Z"): la convierte a la hora del celular.
    if(/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)){ const d = new Date(t); return isNaN(d) ? null : d; }
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  return null;
}
function serialExcel(d){
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) / 86400000 + 25569;
}
function numeroParaExcel(v){
  if(v == null || v === "") return null;
  if(typeof v === "number") return isFinite(v) ? v : null;
  const t = String(v).replace(/\s/g, "").replace(/^S\/\.?/i, "").replace(",", ".");
  if(!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
function codigoDeEquipo(texto){
  const m = String(texto || "").match(/^\s*(\d{4,6})\b/);
  return m ? m[1].padStart(5, "0") : "";
}
function listaDeFotos(v){
  if(Array.isArray(v)) return v.filter(Boolean).join(" | ");
  return String(v || "").split("|").map(s => s.trim()).filter(Boolean).join(" | ");
}

/* columnas: [[nombre, tipo]] con tipo: "t" texto, "n" número, "f" fecha, "fh" fecha y hora.
   filas: arreglos de valores en el mismo orden. */
function hojaDeTabla(columnas, filas){
  const hoja = {};
  const anchos = columnas.map(([c]) => Math.max(10, c.length + 2));
  columnas.forEach(([c], j) => { hoja[XLSX.utils.encode_cell({ r:0, c:j })] = { t:"s", v:c }; });
  filas.forEach((fila, i) => {
    columnas.forEach(([, tipo], j) => {
      const v = fila[j];
      let celda = null;
      if(tipo === "f" || tipo === "fh"){
        const d = fechaParaExcel(v);
        if(d) celda = { t:"n", v:serialExcel(d), z:tipo === "f" ? "dd/mm/yyyy" : "dd/mm/yyyy hh:mm" };
        else if(v != null && v !== "") celda = { t:"s", v:String(v) };
      }else if(tipo === "n"){
        const n = numeroParaExcel(v);
        if(n != null) celda = { t:"n", v:n };
        else if(v != null && v !== "") celda = { t:"s", v:String(v) };
      }else if(v != null && v !== ""){
        celda = { t:"s", v:String(v) };
      }
      if(celda){
        hoja[XLSX.utils.encode_cell({ r:i + 1, c:j })] = celda;
        const largo = tipo === "f" ? 12 : tipo === "fh" ? 17 : String(celda.v).length + 2;
        if(largo > anchos[j]) anchos[j] = Math.min(largo, 60);
      }
    });
  });
  const ultima = XLSX.utils.encode_cell({ r:filas.length, c:Math.max(columnas.length - 1, 0) });
  hoja["!ref"] = "A1:" + ultima;
  hoja["!autofilter"] = { ref:"A1:" + ultima };
  hoja["!cols"] = anchos.map(w => ({ wch:w }));
  return hoja;
}

/* ---------- Tablas ---------- */
function tablaActividades(lista){
  const columnas = [["ID_OT","t"],["FECHA","f"],["AÑO","n"],["CODIGO_EQUIPO","t"],["EQUIPO","t"],["AREA","t"],["CRITICIDAD","t"],
    ["TIPO_MTTO","t"],["ESPECIALIDAD","t"],["DESCRIPCION","t"],["USUARIO","t"],["DNI","t"],["TECNICO_RESPONSABLE","t"],["INTEGRANTES","t"],
    ["FECHA_HORA_INICIO","fh"],["FECHA_HORA_FIN","fh"],["TOTAL_HORAS","n"],["HOROMETRO_KM","n"],["DETALLE_SOLICITUD","t"],
    ["COMENTARIOS","t"],["FOTOS","t"],["FECHA_SYNC","fh"],["ID_UNICO","t"]];
  const filas = lista.map(r => [r.ID_OT, r.FECHA, r["AÑO"], codigoDeEquipo(r.EQUIPO), r.EQUIPO, r.AREA, r.CRITICIDAD,
    r.TIPO_MTTO, r.ESPECIALIDAD, r.DESCRIPCION, r.USUARIO, r.DNI, r.TECNICO_RESPONSABLE,
    Array.isArray(r.INTEGRANTES) ? r.INTEGRANTES.join(", ") : r.INTEGRANTES,
    r.FECHA_HORA_INICIO, r.FECHA_HORA_FIN, r.TOTAL_HORAS, r.HOROMETRO_KM, r.DETALLE_SOLICITUD,
    r.COMENTARIOS, listaDeFotos(r.FOTOS), r.FECHA_SYNC, r.ID_UNICO]);
  return { nombre:"Actividades", columnas, filas };
}

function tablaFallas(lista){
  const columnas = [["ID_FALLA","t"],["FECHA","f"],["CODIGO_EQUIPO","t"],["EQUIPO","t"],["AREA","t"],["TIPO_FALLA","t"],["CRITICIDAD","t"],
    ["ESTADO","t"],["DESCRIPCION","t"],["CAUSA_RAIZ","t"],["ACCION_CORRECTIVA","t"],["HORA_INICIO","t"],["HORA_FIN","t"],
    ["MINUTOS_PARADA","n"],["N_OPERARIOS","n"],["TURNO","t"],["TIPO_ATENCION","t"],["REPORTADO_POR","t"],["DNI","t"],
    ["TECNICO_RESPONSABLE","t"],["RESUELTO_POR","t"],["FECHA_RESOLUCION","fh"],["FOTOS","t"],["FECHA_SYNC","fh"],["ID_UNICO","t"]];
  const filas = lista.map(r => [r.ID_FALLA, r.FECHA, codigoDeEquipo(r.EQUIPO), r.EQUIPO, r.AREA, r.TIPO_FALLA, r.CRITICIDAD,
    r.ESTADO || "Abierta", r.DESCRIPCION, r.CAUSA_RAIZ, r.ACCION_CORRECTIVA, r.HORA_INICIO, r.HORA_FIN,
    r.MINUTOS_PARADA, r.N_OPERARIOS, r.TURNO, r.TIPO_ATENCION, r.TECNICO, r.DNI,
    r.TECNICO_RESPONSABLE, r.RESUELTO_POR, r.FECHA_RESOLUCION, listaDeFotos(r.FOTOS), r.FECHA_SYNC, r.ID_UNICO]);
  return { nombre:"Fallas", columnas, filas };
}

function tablasRequerimientos(lista){
  const cab = { nombre:"Requerimientos",
    columnas:[["CORRELATIVO","t"],["FECHA","f"],["PRIORIDAD","t"],["TECNICO","t"],["MOTIVO","t"],["N_MATERIALES","n"],["TOTAL","n"],["COMENTARIOS","t"]],
    filas:lista.map(r => [r.CORRELATIVO || r.ID, r.FECHA, r.PRIORIDAD, r.TECNICO, r.MOTIVO, (r.ITEMS || []).length, r.TOTAL, r.COMENTARIOS]) };
  const items = { nombre:"Requerimientos_Items",
    columnas:[["CORRELATIVO","t"],["FECHA","f"],["N_ITEM","n"],["CANTIDAD","n"],["UM","t"],["CODIGO_PRODUCTO","t"],["MATERIAL","t"],
      ["ESPECIFICACIONES","t"],["CODIGO_EQUIPO","t"],["EQUIPO","t"],["PRECIO_UNITARIO","n"],["PRECIO_TOTAL","n"],["FOTO","t"]],
    filas:[] };
  lista.forEach(r => (r.ITEMS || []).forEach((it, i) => items.filas.push([r.CORRELATIVO || r.ID, r.FECHA, it.numero || i + 1, it.cantidad, it.um,
    it.codigo, it.nombre, it.especificaciones, it.equipoCodigo ? String(it.equipoCodigo).padStart(5, "0") : codigoDeEquipo(it.equipo), it.equipo,
    it.precio_unitario, it.precio_total, it.foto])));
  return [cab, items];
}

function tablasMantenimientos(lista){
  const cat = m => nombreCategoria(categoriaDe(m.codigo));
  const textoRepuestos = m => (m.repuestos || []).map(x => typeof x === "string" ? x
    : [x.cantidad, x.unidad || x.um, x.nombre || x.descripcion || x.material].filter(v => v != null && v !== "").join(" ")).join(" | ");
  const mtos = { nombre:"Mantenimientos",
    columnas:[["ID_MANTENIMIENTO","t"],["N_OT","t"],["FECHA","f"],["CODIGO","t"],["EQUIPO","t"],["CATEGORIA","t"],["TIPO","t"],
      ["MANTENIMIENTO","t"],["PLAN","t"],["CONTROL","t"],["LECTURA","n"],["TECNICO","t"],["DNI","t"],["HORA_INICIO","t"],["HORA_FIN","t"],
      ["COSTO","n"],["TRABAJO_REALIZADO","t"],["CAMBIOS_FUERA_PLAN","t"],["OBSERVACIONES","t"],["FALLA_RELACIONADA","t"],
      ["REPUESTOS","t"],["REQUERIMIENTO","t"],["VISTO_BUENO","t"],["VB_NOMBRE","t"],["VB_FECHA","fh"],["REGISTRADO","fh"],["FOTOS","t"]],
    filas:lista.map(m => [m.id, m.n_ot, m.fecha, m.codigo, m.equipo, cat(m), m.tipo, m.tipo === "Correctivo" ? "CORRECTIVO" : m.pm,
      m.plan, m.control, m.lectura, m.tecnico, m.dni, m.hora_inicio, m.hora_fin, m.costo, m.trabajo, m.cambios_fuera_plan,
      m.observaciones, m.falla_id, textoRepuestos(m), m.requerimiento, m.vb_nombre ? "SI" : "NO", m.vb_nombre, m.vb_fecha,
      m.registrado, listaDeFotos(m.fotos)]) };
  const mats = { nombre:"Mtto_Materiales",
    columnas:[["ID_MANTENIMIENTO","t"],["N_OT","t"],["FECHA","f"],["CODIGO","t"],["MANTENIMIENTO","t"],["SISTEMA","t"],["DESCRIPCION","t"],
      ["CANTIDAD_PLAN","n"],["UNIDAD","t"],["CAMBIADO","t"],["CANTIDAD_USADA","n"],["PRECIO_UNIT","n"],["PRECIO_TOTAL","n"],["FUERA_DEL_PLAN","t"]],
    filas:[] };
  const ins = { nombre:"Mtto_Inspeccion",
    columnas:[["ID_MANTENIMIENTO","t"],["N_OT","t"],["FECHA","f"],["CODIGO","t"],["MANTENIMIENTO","t"],["SISTEMA","t"],["ACTIVIDAD","t"],
      ["TAREA","t"],["RESULTADO","t"],["OBSERVACION","t"]],
    filas:[] };
  lista.forEach(m => {
    const pm = m.tipo === "Correctivo" ? "CORRECTIVO" : m.pm;
    (m.materiales || []).forEach(x => {
      const usada = x.cambiado === "NO" ? 0 : (Number(x.cantidad_usada) || 0), precio = Number(x.precio != null ? x.precio : x.precio_unit) || 0;
      mats.filas.push([m.id, m.n_ot, m.fecha, m.codigo, pm, x.sistema, x.descripcion, x.cantidad_plan, x.unidad, x.cambiado,
        usada, precio, Math.round(usada * precio * 100) / 100, x.extra ? "SI" : "NO"]);
    });
    (m.inspeccion || []).forEach(x => ins.filas.push([m.id, m.n_ot, m.fecha, m.codigo, pm, x.sistema, x.actividad, x.tarea, x.resultado, x.obs || x.observacion]));
  });
  return [mtos, mats, ins];
}

function tablaEstadoUnidades(){
  const columnas = [["CODIGO","t"],["EQUIPO","t"],["CATEGORIA","t"],["AREA","t"],["PLAN","t"],["CONTROL","t"],["INTERVALO","n"],["ESTADO","t"],
    ["ULTIMO_PM","t"],["LECTURA_ULTIMO_PM","n"],["FECHA_ULTIMO_PM","f"],["LECTURA_ACTUAL","n"],["FECHA_LECTURA","f"],["ORIGEN_LECTURA","t"],
    ["PROXIMO_PM","t"],["PROXIMO_A","n"],["PROXIMA_FECHA","f"],["FALTA","n"],["UNIDAD","t"],["FECHA_CALCULO","f"]];
  const hoy = new Date();
  const filas = estadosDeUnidades().map(r => [r.eq.codigo, r.eq.descripcion, nombreCategoria(r.eq.categoria), r.eq.area, r.eq.plan, r.eq.control,
    r.eq.intervalo || "", r.estado, r.base ? r.base.pm : "", r.base ? r.base.lectura : "", r.base ? r.base.fecha : "",
    r.lect ? r.lect.lectura : "", r.lect ? r.lect.fecha : "", r.lect ? r.lect.origen : "",
    r.proximo === "—" ? "" : r.proximo, r.proximoA, r.proximaFecha, r.falta, r.unidad, hoy]);
  return { nombre:"Estado_Unidades", columnas, filas };
}

function tablasChecklists(lista){
  const mesDe = c => { const f = fechaDeChecklist(c); if(!f) return ""; const m = mesDeSemanaChk(lunesDe(f)); return `${m.anio}-${String(m.mes + 1).padStart(2, "0")}`; };
  const cab = { nombre:"Checklists",
    columnas:[["ID_CHECKLIST","t"],["FECHA","f"],["DIA","t"],["SEMANA","t"],["MES_DE_LA_SEMANA","t"],["FORMATO","t"],["CODIGO_FORMATO","t"],
      ["EQUIPO_CODIGO","t"],["EQUIPO","t"],["EQUIPO_CLAVE","t"],["AREA","t"],["TURNO","t"],["TRACTOR","t"],["LECTURA","n"],["UNIDAD_LECTURA","t"],
      ["NC","n"],["OBSERVADOS","n"],["PUEDE_UTILIZAR","t"],["OBSERVACIONES","t"],["OPERADOR","t"],["DNI","t"],["REGISTRADO","fh"],["FOTOS","t"]],
    filas:lista.map(c => {
      const p = plantillaPorId(c.plantilla), m = marcasDeChecklist(c);
      return [c.id, c.fecha, c.dia, c.semana, mesDe(c), p ? p.nombre : c.plantilla, p ? p.codigo : "", c.equipo_codigo, c.equipo, c.equipo_clave,
        c.area, c.turno, c.tractor, c.lectura, c.lectura_unidad, m.nc, m.obs, c.puede_utilizar, c.observaciones, c.usuario, c.dni,
        c.registrado, listaDeFotos(c.fotos)];
    }) };
  const puntos = { nombre:"Checklist_Puntos",
    columnas:[["ID_CHECKLIST","t"],["FECHA","f"],["EQUIPO_CLAVE","t"],["EQUIPO","t"],["FORMATO","t"],["SECCION","t"],["PUNTO","t"],["MARCA","t"],["OBSERVACION","t"]],
    filas:[] };
  lista.forEach(c => {
    const p = plantillaPorId(c.plantilla);
    (c.respuestas || []).forEach(x => puntos.filas.push([c.id, c.fecha, c.equipo_clave, c.equipo, p ? p.nombre : c.plantilla, x.seccion, x.item, x.marca, x.obs]));
  });
  return [cab, puntos];
}

function tablaEquipos(){
  const columnas = [["CODIGO","t"],["DESCRIPCION","t"],["CATEGORIA","t"],["AREA","t"],["PLAN","t"],["CONTROL","t"],["INTERVALO","n"],["CRITICIDAD","t"],["CON_PLAN_PM","t"]];
  const filas = equiposControl().map(e => [e.codigo, e.descripcion, nombreCategoria(e.categoria), e.area, e.plan, e.control, e.intervalo || "", e.criticidad, e.sinPlan ? "NO" : "SI"]);
  return { nombre:"Equipos", columnas, filas };
}

/* ---------- Descarga ---------- */
function descargarLibro(tablas, nombreArchivo){
  const libro = XLSX.utils.book_new();
  tablas.forEach(t => XLSX.utils.book_append_sheet(libro, hojaDeTabla(t.columnas, t.filas), t.nombre));
  XLSX.writeFile(libro, nombreArchivo);
}
async function prepararExcel(){
  try{ await asegurarXLSX(); return true; }
  catch(e){ mostrarToast("No se pudo cargar el Excel. Revisa tu internet e intenta de nuevo.", false); return false; }
}
function avisoDescargado(tablas){
  const n = tablas.reduce((s, t) => s + t.filas.length, 0);
  mostrarToast(n ? "Excel descargado" : "Excel descargado (no había datos para este filtro)", true);
}

async function exportarActividadesExcel(){
  if(!(await prepararExcel())) return;
  const sel = document.getElementById("admin-filtro-tecnico-actividades");
  const filtro = sel ? sel.value : "";
  const tablas = [tablaActividades(adminDatosCache.actividades.filter(r => !filtro || r.USUARIO === filtro))];
  descargarLibro(tablas, "ChanChan_Actividades.xlsx");
  avisoDescargado(tablas);
}

async function exportarRequerimientosExcel(){
  if(!(await prepararExcel())) return;
  const tablas = tablasRequerimientos(adminDatosCache.requerimientos || []);
  descargarLibro(tablas, "ChanChan_Requerimientos.xlsx");
  avisoDescargado(tablas);
}

async function exportarControlDatosExcel(){
  if(!(await prepararExcel())) return;
  try{ await cargarControlMantenimiento(true); }catch(e){}
  const sel = document.getElementById("dash-periodo");
  const desde = inicioDelPeriodo(sel ? sel.value : "todo");
  const tablas = [...tablasMantenimientos(controlDatos.mantenimientos.filter(m => enPeriodo(m.fecha, desde))),
    tablaEstadoUnidades(), tablaFallas((controlDatos.fallas || []).filter(f => enPeriodo(f.FECHA, desde)))];
  descargarLibro(tablas, "ChanChan_Control_Mantenimiento.xlsx");
  avisoDescargado(tablas);
}

async function exportarChecklistsExcel(){
  if(!(await prepararExcel())) return;
  const tablas = tablasChecklists(checklistsAdminFiltrados());
  descargarLibro(tablas, "ChanChan_Checklists.xlsx");
  avisoDescargado(tablas);
}

/* Panel admin → "Exportar todo a Excel": todas las hojas, sin filtros. */
async function exportarExcel(){
  if(!(await prepararExcel())) return;
  mostrarToast("Preparando el Excel…", true);
  const sesion = JSON.parse(localStorage.getItem("sesion_activa") || "{}");
  try{
    await Promise.all([
      cargarControlMantenimiento(true).catch(() => {}),
      checklistsAdminCache.length ? null : cargarChecklistsAdmin(),
      (adminDatosCache.requerimientos || []).length ? null : cargarRequerimientosAdmin(sesion)
    ]);
  }catch(e){}
  const tablas = [
    tablaActividades(adminDatosCache.actividades || []),
    ...tablasRequerimientos(adminDatosCache.requerimientos || []),
    ...tablasMantenimientos(controlDatos.mantenimientos || []),
    tablaEstadoUnidades(),
    tablaFallas(adminDatosCache.fallas && adminDatosCache.fallas.length ? adminDatosCache.fallas : (controlDatos.fallas || [])),
    ...tablasChecklists(checklistsAdminCache || []),
    tablaEquipos()
  ];
  descargarLibro(tablas, "ChanChan_Todo.xlsx");
  mostrarToast("Excel completo descargado", true);
}
