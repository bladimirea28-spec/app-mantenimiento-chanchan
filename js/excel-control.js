/* ============ EXCEL DE CONTROL (idéntico a la plantilla) ============
   Abre plantillas/CONTROL_MANTENIMIENTO.xlsx (copia exacta del Excel de
   control) y escribe los datos solo en las celdas que se llenan a mano:
   REGISTRO (fecha, código, lectura, PM, OT, técnico, observaciones),
   EQUIPOS (lectura actual y su fecha), CONSULTA (equipo elegido) y, si se
   pide, FORMATO (el mantenimiento elegido). Todo lo demás (colores,
   fórmulas, listas, hojas) queda igual; Excel recalcula al abrir. */

const NS_HOJA = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function columnaANumero(letras){ return letras.split("").reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0); }
function separarRef(ref){ const m = ref.match(/^([A-Z]+)(\d+)$/); return { col:m[1], fila:+m[2] }; }

/* Número de serie de Excel para una fecha (las celdas ya tienen formato dd/mm/yyyy). */
function fechaASerieExcel(fecha){
  return Math.round((Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
}

class HojaXml {
  constructor(xml){
    this.doc = new DOMParser().parseFromString(xml, "application/xml");
    this.datos = this.doc.getElementsByTagNameNS(NS_HOJA, "sheetData")[0];
    this.filas = new Map();
    for(const fila of this.datos.getElementsByTagNameNS(NS_HOJA, "row")) this.filas.set(+fila.getAttribute("r"), fila);
  }
  fila(numero){
    if(this.filas.has(numero)) return this.filas.get(numero);
    const nueva = this.doc.createElementNS(NS_HOJA, "row");
    nueva.setAttribute("r", numero);
    const siguiente = [...this.filas.keys()].sort((a, b) => a - b).find(n => n > numero);
    this.datos.insertBefore(nueva, siguiente ? this.filas.get(siguiente) : null);
    this.filas.set(numero, nueva);
    return nueva;
  }
  celda(ref){
    const { col, fila } = separarRef(ref);
    const elFila = this.fila(fila);
    const celdas = [...elFila.getElementsByTagNameNS(NS_HOJA, "c")];
    const existente = celdas.find(c => c.getAttribute("r") === ref);
    if(existente) return existente;
    const nueva = this.doc.createElementNS(NS_HOJA, "c");
    nueva.setAttribute("r", ref);
    const n = columnaANumero(col);
    const despues = celdas.find(c => columnaANumero(separarRef(c.getAttribute("r")).col) > n);
    elFila.insertBefore(nueva, despues || null);
    return nueva;
  }
  /* Escribe un valor conservando el estilo (s="...") de la celda. Si la celda
     tenía una fórmula, se reemplaza por el valor. */
  poner(ref, valor){
    if(valor === undefined || valor === null || valor === "") return;
    const c = this.celda(ref);
    while(c.firstChild) c.removeChild(c.firstChild);
    c.removeAttribute("t");
    if(valor instanceof Date){
      const v = this.doc.createElementNS(NS_HOJA, "v"); v.textContent = fechaASerieExcel(valor); c.appendChild(v);
    }else if(typeof valor === "number"){
      const v = this.doc.createElementNS(NS_HOJA, "v"); v.textContent = String(valor); c.appendChild(v);
    }else{
      c.setAttribute("t", "inlineStr");
      const is = this.doc.createElementNS(NS_HOJA, "is");
      const t = this.doc.createElementNS(NS_HOJA, "t");
      t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      t.textContent = String(valor);
      is.appendChild(t); c.appendChild(is);
    }
  }
  xml(){ return new XMLSerializer().serializeToString(this.doc); }
}

async function abrirPlantillaControl(){
  await asegurarJSZip();
  await asegurarPlanesMtto();
  const resp = await fetch("plantillas/CONTROL_MANTENIMIENTO.xlsx");
  if(!resp.ok) throw new Error("No se encontró la plantilla del Excel de control.");
  const zip = await JSZip.loadAsync(await resp.arrayBuffer());
  const libro = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const rutas = {};
  const docRels = new DOMParser().parseFromString(rels, "application/xml");
  const destinos = {};
  for(const r of docRels.getElementsByTagName("Relationship")) destinos[r.getAttribute("Id")] = r.getAttribute("Target");
  const docLibro = new DOMParser().parseFromString(libro, "application/xml");
  for(const h of docLibro.getElementsByTagNameNS(NS_HOJA, "sheet")){
    const id = h.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    rutas[h.getAttribute("name")] = "xl/" + destinos[id].replace(/^\/?xl\//, "");
  }
  // Que Excel recalcule todas las fórmulas al abrir el archivo.
  const calc = docLibro.getElementsByTagNameNS(NS_HOJA, "calcPr")[0];
  if(calc) calc.setAttribute("fullCalcOnLoad", "1");
  zip.file("xl/workbook.xml", new XMLSerializer().serializeToString(docLibro), { createFolders:false });
  const hojas = {};
  for(const nombre of ["CONSULTA", "FORMATO", "REGISTRO", "EQUIPOS"]){
    hojas[nombre] = new HojaXml(await zip.file(rutas[nombre]).async("string"));
  }
  return { zip, hojas, rutas };
}

async function descargarPlantillaLlena(p, nombreArchivo){
  for(const [nombre, hoja] of Object.entries(p.hojas)) p.zip.file(p.rutas[nombre], hoja.xml(), { createFolders:false });
  const blob = await p.zip.generateAsync({ type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression:"DEFLATE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombreArchivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* Filas para la hoja REGISTRO: el punto de partida de cada unidad (si se cargó
   un último PM) y todos los preventivos, en orden de fecha (las fórmulas del
   Excel toman la última fila de cada código como "último mantenimiento"). */
function filasRegistroControl(){
  const filas = [];
  EQUIPOS_MTTO.forEach(eq => {
    const p = controlDatos.parametros.find(x => String(x.CODIGO) === eq.codigo);
    if(p && p.ULTIMO_PM && p.ULTIMO_PM !== "NINGUNO"){
      filas.push({ fecha:fechaDesdePE(p.FECHA_ULTIMO_PM) || fechaDesdePE(p.FECHA_INICIAL), codigo:eq.codigo,
        lectura: eq.control === "MESES" ? "" : Number(p.LECTURA_ULTIMO_PM), pm:p.ULTIMO_PM, ot:"", tecnico:"",
        cambios:"", obs:"Punto de partida cargado en la app" });
    }
  });
  controlDatos.mantenimientos.filter(m => m.tipo === "Preventivo").forEach(m => {
    filas.push({ fecha:fechaDesdePE(m.fecha), codigo:m.codigo, lectura: m.lectura === "" ? "" : Number(m.lectura), pm:m.pm,
      ot:m.n_ot || "", tecnico:m.tecnico || "", cambios:m.cambios_fuera_plan || "", obs:m.observaciones || "" });
  });
  return filas.sort((a, b) => ((a.fecha || 0) - (b.fecha || 0)) || ((Number(a.lectura) || 0) - (Number(b.lectura) || 0)));
}

function llenarRegistroYEquipos(p, codigoConsulta){
  const reg = p.hojas.REGISTRO;
  filasRegistroControl().slice(0, 2000).forEach((f, i) => {
    const r = i + 3;
    reg.poner("B" + r, f.fecha); reg.poner("C" + r, f.codigo); reg.poner("G" + r, f.lectura === "" ? "" : f.lectura);
    reg.poner("H" + r, f.pm); reg.poner("I" + r, f.ot); reg.poner("J" + r, f.tecnico);
    reg.poner("L" + r, f.cambios); reg.poner("M" + r, f.obs);
  });
  const equipos = p.hojas.EQUIPOS;
  EQUIPOS_MTTO.forEach((eq, i) => {
    const lect = controlDatos.lecturas[eq.codigo];
    if(lect && eq.control !== "MESES"){
      equipos.poner("I" + (i + 3), Number(lect.lectura));
      const f = fechaDesdePE(lect.fecha);
      if(f) equipos.poner("J" + (i + 3), f);
    }
  });
  const eq = equipoMtto(codigoConsulta) || EQUIPOS_MTTO[0];
  p.hojas.CONSULTA.poner("C4", `${eq.codigo} - ${eq.descripcion}`);
  p.hojas.FORMATO.poner("C4", `${eq.codigo} - ${eq.descripcion}`);
}

function nombreArchivoControl(extra){
  const hoy = fechaPE(new Date()).replace(/\//g, "-");
  return `CONTROL DE MANTENIMIENTO - CHAN CHAN${extra ? " - " + extra : ""} (${hoy}).xlsx`;
}

async function exportarControlExcel(){
  try{
    mostrarToast("Preparando el Excel...", true);
    await cargarControlMantenimiento();
    const p = await abrirPlantillaControl();
    const primero = estadosDeUnidades().sort((a, b) => (a.estado === "VENCIDO" ? -1 : 0) - (b.estado === "VENCIDO" ? -1 : 0))[0];
    llenarRegistroYEquipos(p, primero ? primero.eq.codigo : "");
    await descargarPlantillaLlena(p, nombreArchivoControl());
    mostrarToast("Excel de control descargado", true);
  }catch(e){
    console.error(e);
    mostrarToast("No se pudo generar el Excel: " + e.message, false);
  }
}

/* El mismo Excel, con la hoja FORMATO llenada con un mantenimiento preventivo. */
async function exportarFormatoMantenimiento(id){
  const m = controlDatos.mantenimientos.find(x => x.id === id);
  if(!m || m.tipo !== "Preventivo") return;
  try{
    mostrarToast("Preparando el formato...", true);
    const p = await abrirPlantillaControl();
    llenarRegistroYEquipos(p, m.codigo);
    const f = p.hojas.FORMATO;
    f.poner("C5", m.pm);
    f.poner("J5", m.n_ot || "");
    f.poner("C6", m.fecha);
    f.poner("F6", m.lectura === "" || m.lectura == null ? "" : Number(m.lectura));
    f.poner("C7", m.tecnico || "");
    f.poner("F7", [m.hora_inicio, m.hora_fin].filter(Boolean).join(" - "));
    // Materiales del plan: filas 11 a 24, en el mismo orden que BD_PLAN.
    (m.materiales || []).filter(x => !x.extra).slice(0, 14).forEach((x, i) => {
      const fila = 11 + i;
      f.poner("H" + fila, x.cambiado === "NO" ? "SI ☐   NO ☑" : "SI ☑   NO ☐");
      if(x.cambiado !== "NO") f.poner("J" + fila, Number(x.cantidad_usada) || 0);
    });
    // Inspección: filas 28 a 53, en el mismo orden que BD_INSPECCION.
    (m.inspeccion || []).slice(0, 26).forEach((x, i) => {
      const fila = 28 + i;
      f.poner("G" + fila, x.resultado === "OK" ? "☑" : "☐");
      f.poner("H" + fila, x.resultado === "NO OK" ? "☑" : "☐");
      if(x.obs) f.poner("I" + fila, x.obs);
    });
    // Cambios fuera del plan / observaciones: renglones 56 a 61.
    const extras = (m.materiales || []).filter(x => x.extra && x.cambiado !== "NO")
      .map(x => `Material fuera del plan: ${x.descripcion} — ${x.cantidad_usada} ${x.unidad}`);
    const lineas = extras.concat([m.cambios_fuera_plan, m.observaciones].filter(Boolean));
    lineas.slice(0, 6).forEach((texto, i) => f.poner("B" + (56 + i), texto));
    await descargarPlantillaLlena(p, nombreArchivoControl(`${m.codigo} ${m.pm.split(" - ")[0]} ${m.fecha.replace(/\//g, "-")}`));
    mostrarToast("Formato descargado", true);
  }catch(e){
    console.error(e);
    mostrarToast("No se pudo generar el formato: " + e.message, false);
  }
}
