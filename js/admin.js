/* ============ PANEL DE ADMINISTRACIÓN ============ */
let adminDatosCache = { actividades: [], fallas: [], requerimientos: [] };

async function abrirPanelAdmin(){
  irA("pantalla-admin");
  document.getElementById("admin-cargando").style.display = "block";
  document.getElementById("admin-contenido").style.display = "none";

  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({ tipo:"listado", dni_admin: sesion.dni });
  if(!resp.ok){
    document.getElementById("admin-cargando").textContent = resp.mensaje || "No se pudo cargar la información.";
    return;
  }
  adminDatosCache = { actividades: resp.actividades||[], fallas: resp.fallas||[] };

  actualizarKpisAdmin();

  const nombresAct = new Set();
  adminDatosCache.actividades.forEach(r=> r.USUARIO && nombresAct.add(r.USUARIO));
  const selFiltroAct = document.getElementById("admin-filtro-tecnico-actividades");
  if(selFiltroAct){
    selFiltroAct.innerHTML = `<option value="">Todos</option>` +
      [...nombresAct].sort().map(n=>`<option value="${n}">${n}</option>`).join("");
  }

  const nombresFallas = new Set();
  adminDatosCache.fallas.forEach(r=> r.TECNICO_RESPONSABLE && nombresFallas.add(r.TECNICO_RESPONSABLE));
  const selFiltro = document.getElementById("admin-filtro-tecnico");
  selFiltro.innerHTML = `<option value="">Todos</option>` +
    [...nombresFallas].sort().map(n=>`<option value="${n}">${n}</option>`).join("");

  cargarDispositivosAdmin(sesion);

  document.getElementById("admin-filtro-fecha-desde").value = "";
  document.getElementById("admin-filtro-fecha-hasta").value = "";

  const abiertasBadge = adminDatosCache.fallas.filter(r => String(r.ESTADO||"Abierta")!=="Resuelta");
  document.getElementById("admin-badge-actividades").textContent = `${adminDatosCache.actividades.length} registradas`;
  document.getElementById("admin-badge-fallas").textContent = `${abiertasBadge.length} abiertas de ${adminDatosCache.fallas.length}`;

  cargarSolicitudesAdmin(sesion);
  cargarRequerimientosAdmin(sesion);

  document.getElementById("admin-cargando").style.display = "none";
  document.getElementById("admin-contenido").style.display = "block";
}

async function cargarRequerimientosAdmin(sesion){
  const cont = document.getElementById("admin-requerimientos-lista");
  cont.textContent = "Cargando...";
  const resp = await llamarServidor({ tipo:"listado_requerimientos", dni_admin: sesion.dni });
  if(!resp || !resp.ok){
    adminDatosCache.requerimientos = [];
    cont.textContent = (resp && resp.mensaje) || "No se pudo cargar.";
    document.getElementById("admin-kpi-requerimientos").textContent = "0";
    document.getElementById("admin-kpi-requerimientos-monto").textContent = "S/ 0";
    return;
  }
  const lista = resp.requerimientos || [];
  adminDatosCache.requerimientos = lista;

  const total = lista.reduce((s,r)=> s + (Number(r.TOTAL)||0), 0);
  document.getElementById("admin-kpi-requerimientos").textContent = lista.length;
  document.getElementById("admin-kpi-requerimientos-monto").textContent = `S/ ${total.toFixed(2)}`;
  const badgeReq = document.getElementById("admin-badge-requerimientos");
  if(badgeReq) badgeReq.textContent = `${lista.length} registrado(s)`;

  if(lista.length===0){
    cont.textContent = "Todavía no hay requerimientos registrados.";
    return;
  }
  const ordenados = [...lista].sort((a,b)=> new Date(b.FECHA) - new Date(a.FECHA));
  cont.innerHTML = ordenados.map(r=>{
    const items = r.ITEMS || [];
    const corr = (r.CORRELATIVO || r.ID || "").toString().replace(/'/g,"\\'");
    return `
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${r.CORRELATIVO || r.ID} ${r.PRIORIDAD?`<span class="badge" style="background:${r.PRIORIDAD==='Urgente'?'var(--rojo-100,#fde2e2)':'var(--superficie)'};color:${r.PRIORIDAD==='Urgente'?'var(--rojo-texto,#c0392b)':'inherit'};margin-left:6px;">${r.PRIORIDAD}</span>`:''}</div>
          <div class="subtexto" style="margin-top:2px;">${r.TECNICO||''} · ${r.MOTIVO||''}</div>
        </div>
        <span class="badge">${(r.FECHA||'').toString().slice(0,10)}</span>
      </div>
      <div class="desc">${items.length} material(es) · Total S/ ${(Number(r.TOTAL)||0).toFixed(2)}</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button type="button" class="btn btn-secundario" style="width:auto;flex:1;padding:9px 10px;font-size:12.5px;" onclick="verDetalleRequerimientoAdmin('${corr}')">Ver detalle</button>
        <button type="button" class="btn btn-secundario" style="width:auto;flex:1;padding:9px 10px;font-size:12.5px;" onclick="editarRequerimientoAdmin('${corr}')">Editar</button>
        <button type="button" class="btn btn-texto" style="width:auto;flex:1;padding:9px 10px;font-size:12.5px;color:var(--rojo-texto,#c0392b);" onclick="eliminarRequerimientoAdmin('${corr}')">Eliminar</button>
      </div>
    </div>`;
  }).join("");
}

async function cargarSolicitudesAdmin(sesion){
  const cont = document.getElementById("admin-solicitudes-lista");
  cont.textContent = "Cargando...";
  const resp = await llamarServidor({ tipo:"listado_solicitudes_actividad", dni_admin: sesion.dni });
  if(!resp || !resp.ok){
    cont.textContent = (resp && resp.mensaje) || "No se pudo cargar.";
    return;
  }
  const pendientes = (resp.solicitudes||[]).filter(s => String(s.ESTADO||"Pendiente")==="Pendiente");
  const badgeSol = document.getElementById("admin-badge-solicitudes");
  if(badgeSol) badgeSol.textContent = `${pendientes.length} pendiente(s)`;
  if(pendientes.length===0){
    cont.textContent = "No hay solicitudes pendientes.";
    return;
  }
  cont.innerHTML = pendientes.map(s=>`
    <div class="registro-item">
      <div style="font-weight:700;font-size:14px;">${s.EQUIPO||''} · ${s.AREA||''} ${s.ORIGEN==='Admin'?'<span class="badge" style="margin-left:6px;">Generada por Admin</span>':''}</div>
      <div class="subtexto" style="margin-top:2px;">Pedido por ${s.SOLICITADO_POR||''} · Prioridad ${s.PRIORIDAD||''}</div>
      <div class="desc">${s.DETALLE||''}</div>
      ${s.COMENTARIOS?`<div class="subtexto" style="margin-top:4px;">${s.COMENTARIOS}</div>`:''}
      <div class="meta">${s.ID_SOLICITUD||''} · culminar antes de ${s.FECHA_TENTATIVA||'—'} · pedido el ${s.FECHA||''}</div>
    </div>
  `).join("");
}

function topPorConteo(lista, campo, top){
  const conteo = {};
  lista.forEach(r=>{
    const k = r[campo];
    if(!k) return;
    conteo[k] = (conteo[k]||0)+1;
  });
  return Object.entries(conteo).sort((a,b)=>b[1]-a[1]).slice(0, top||5);
}

function renderRankingHtml(pares){
  if(!pares.length) return "Sin datos.";
  return pares.map(([nombre,n])=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--linea);"><span>${nombre}</span><b>${n}</b></div>`).join("");
}

function minutosParadaDelMes(fallas){
  const ahora = new Date();
  return fallas.reduce((suma,r)=>{
    const mins = parseInt(r.MINUTOS_PARADA,10);
    if(isNaN(mins)) return suma;
    const partes = String(r.FECHA||"").split("/");
    if(partes.length===3){
      const fecha = new Date(+partes[2], +partes[1]-1, +partes[0]);
      if(fecha.getMonth()!==ahora.getMonth() || fecha.getFullYear()!==ahora.getFullYear()) return suma;
    }
    return suma + mins;
  },0);
}

function actualizarKpisAdmin(){
  const fallas = adminDatosCache.fallas;
  const abiertas = fallas.filter(r => String(r.ESTADO||"Abierta")!=="Resuelta");
  const resueltas = fallas.filter(r => String(r.ESTADO)==="Resuelta");
  const criticas = abiertas.filter(r => String(r.CRITICIDAD||"").toLowerCase()==="alta");

  document.getElementById("admin-kpi-actividades").textContent = adminDatosCache.actividades.length;
  document.getElementById("admin-kpi-total-fallas").textContent = fallas.length;
  document.getElementById("admin-kpi-abiertas").textContent = abiertas.length;
  document.getElementById("admin-kpi-resueltas").textContent = resueltas.length;
  document.getElementById("admin-kpi-criticas").textContent = criticas.length;
  document.getElementById("admin-kpi-minutos").textContent = minutosParadaDelMes(fallas);
}

/* ============ Fase 2: análisis por período (filtro de fechas + gráficos) ============ */

function parsearFechaDDMMYYYY(str){
  const partes = String(str||"").split("/");
  if(partes.length!==3) return null;
  const d = new Date(+partes[2], +partes[1]-1, +partes[0]);
  if(isNaN(d.getTime())) return null;
  return d;
}

function obtenerFallasFiltradasPorFecha(){
  const desdeStr = document.getElementById("admin-filtro-fecha-desde").value;
  const hastaStr = document.getElementById("admin-filtro-fecha-hasta").value;
  if(!desdeStr && !hastaStr) return adminDatosCache.fallas.slice();
  const desde = desdeStr ? new Date(desdeStr+"T00:00:00") : null;
  const hasta = hastaStr ? new Date(hastaStr+"T23:59:59") : null;
  return adminDatosCache.fallas.filter(r=>{
    const f = parsearFechaDDMMYYYY(r.FECHA);
    if(!f) return false;
    if(desde && f < desde) return false;
    if(hasta && f > hasta) return false;
    return true;
  });
}

function limpiarFiltroFechaAdmin(){
  document.getElementById("admin-filtro-fecha-desde").value = "";
  document.getElementById("admin-filtro-fecha-hasta").value = "";
  actualizarAnalisisPeriodo();
}

function obtenerLunesDeSemana(fecha){
  const d = new Date(fecha);
  d.setHours(0,0,0,0);
  const dia = d.getDay();
  const diff = (dia===0 ? -6 : 1-dia);
  d.setDate(d.getDate()+diff);
  return d;
}

function etiquetaSemana(lunes){
  return lunes.toLocaleDateString("es-PE",{day:"2-digit",month:"short"});
}

function construirTendenciaSemanal(fallas){
  const buckets = {};
  fallas.forEach(r=>{
    const f = parsearFechaDDMMYYYY(r.FECHA);
    if(!f) return;
    const lunes = obtenerLunesDeSemana(f);
    const key = lunes.toISOString().slice(0,10);
    if(!buckets[key]) buckets[key] = { lunes, reportadas:0, resueltas:0 };
    buckets[key].reportadas++;
    if(String(r.ESTADO)==="Resuelta") buckets[key].resueltas++;
  });
  const claves = Object.keys(buckets).sort();
  if(claves.length===0) return null;
  const MAX_SEMANAS = 12;
  const recortado = claves.length > MAX_SEMANAS;
  const clavesFinales = claves.slice(-MAX_SEMANAS);
  return {
    recortado,
    labels: clavesFinales.map(k=>etiquetaSemana(buckets[k].lunes)),
    reportadas: clavesFinales.map(k=>buckets[k].reportadas),
    resueltas: clavesFinales.map(k=>buckets[k].resueltas)
  };
}

/* Gráfico de barras simple en SVG (sin librerías externas).
   labels: nombres en el eje X.
   series: [{ nombre, color, colores?, valores:[...] }]
     - "color" se usa para todas las barras de esa serie.
     - "colores" (arreglo, mismo largo que labels) da un color distinto
       por barra y tiene prioridad sobre "color" (usado en el gráfico de
       criticidad, que tiene una sola serie con 3 colores). */
function grafBarras(labels, series){
  const ancho = 600, alto = 190;
  const margenIzq = 30, margenDer = 8, margenSup = 14, margenInf = 26;
  const areaAncho = ancho - margenIzq - margenDer;
  const areaAlto = alto - margenSup - margenInf;
  const n = labels.length;
  let maxValor = 0;
  series.forEach(s=> s.valores.forEach(v=>{ if(v>maxValor) maxValor = v; }));
  const maxEscala = Math.max(Math.ceil(maxValor*1.15), 1);

  const anchoGrupo = areaAncho / n;
  const numSeries = series.length;
  const anchoBarra = Math.max(6, Math.min(26, (anchoGrupo*0.62)/numSeries));
  const gapBarra = 4;

  let svg = `<svg viewBox="0 0 ${ancho} ${alto}" class="grafico-svg" preserveAspectRatio="xMidYMid meet">`;

  const LINEAS = 4;
  for(let i=0;i<=LINEAS;i++){
    const val = Math.round(maxEscala * i / LINEAS);
    const y = margenSup + areaAlto - (areaAlto * i / LINEAS);
    svg += `<line x1="${margenIzq}" y1="${y.toFixed(1)}" x2="${ancho-margenDer}" y2="${y.toFixed(1)}" style="stroke:var(--linea);stroke-width:1"/>`;
    svg += `<text x="${margenIzq-5}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="9" style="fill:var(--tinta-600)">${val}</text>`;
  }

  labels.forEach((lab,i)=>{
    const xGrupo = margenIzq + anchoGrupo*i;
    const anchoTotalGrupo = anchoBarra*numSeries + gapBarra*(numSeries-1);
    const xInicio = xGrupo + (anchoGrupo-anchoTotalGrupo)/2;
    series.forEach((s,si)=>{
      const v = s.valores[i]||0;
      const color = (s.colores && s.colores[i]) || s.color;
      const h = (v/maxEscala)*areaAlto;
      const x = xInicio + si*(anchoBarra+gapBarra);
      const y = margenSup + areaAlto - h;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${anchoBarra.toFixed(1)}" height="${h.toFixed(1)}" rx="3" style="fill:${color}"/>`;
      if(v>0) svg += `<text x="${(x+anchoBarra/2).toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" style="fill:${color}">${v}</text>`;
    });
    svg += `<text x="${(xGrupo+anchoGrupo/2).toFixed(1)}" y="${alto-8}" text-anchor="middle" font-size="9" style="fill:var(--tinta-600)">${lab}</text>`;
  });

  svg += `</svg>`;
  return svg;
}

function actualizarAnalisisPeriodo(){
  if(!adminDatosCache.fallas) return;
  const fallas = obtenerFallasFiltradasPorFecha();

  document.getElementById("admin-top-equipos").innerHTML = renderRankingHtml(topPorConteo(fallas, "EQUIPO"));
  document.getElementById("admin-ranking-tecnicos").innerHTML = renderRankingHtml(topPorConteo(fallas, "TECNICO_RESPONSABLE"));

  const contTendencia = document.getElementById("admin-grafico-tendencia");
  const tendencia = construirTendenciaSemanal(fallas);
  if(!tendencia){
    contTendencia.innerHTML = `<div class="subtexto">Sin datos en este período.</div>`;
  } else {
    contTendencia.innerHTML =
      `<div class="grafico-leyenda"><span><i style="background:var(--azul-700);"></i>Reportadas</span><span><i style="background:var(--verde-700);"></i>Resueltas</span></div>` +
      grafBarras(tendencia.labels, [
        { nombre:"Reportadas", color:"var(--azul-700)", valores:tendencia.reportadas },
        { nombre:"Resueltas", color:"var(--verde-700)", valores:tendencia.resueltas }
      ]) +
      (tendencia.recortado ? `<div class="grafico-nota">Mostrando las últimas 12 semanas con datos.</div>` : "");
  }

  const contCriticidad = document.getElementById("admin-grafico-criticidad");
  const alta = fallas.filter(r=>String(r.CRITICIDAD||"").toLowerCase()==="alta").length;
  const media = fallas.filter(r=>String(r.CRITICIDAD||"").toLowerCase()==="media").length;
  const baja = fallas.filter(r=>String(r.CRITICIDAD||"").toLowerCase()==="baja").length;
  if(alta+media+baja===0){
    contCriticidad.innerHTML = `<div class="subtexto">Sin datos en este período.</div>`;
  } else {
    contCriticidad.innerHTML = grafBarras(["Alta","Media","Baja"], [
      { nombre:"Fallas", colores:["var(--rojo-600)","var(--ambar-600)","var(--verde-700)"], valores:[alta,media,baja] }
    ]);
  }
}

function renderizarListadoActividadesAdmin(){
  const selEl = document.getElementById("admin-filtro-tecnico-actividades");
  const filtro = selEl ? selEl.value : "";
  const cont = document.getElementById("admin-lista-actividades");
  if(!cont) return;

  const actividades = adminDatosCache.actividades
    .filter(r => !filtro || r.USUARIO === filtro);

  if(actividades.length===0){
    cont.innerHTML = `<div class="vacio"><div class="subtexto">No hay actividades para este filtro.</div></div>`;
    return;
  }
  cont.innerHTML = actividades.map(r=>{
    const fotos = (r.FOTOS||"").split("|").map(f=>f.trim()).filter(f=>f && f!=="ERROR_SUBIENDO_FOTO");
    const fotosHtml = fotos.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${
      fotos.map(f=>`<a href="${f}" target="_blank" rel="noopener"><img src="${f}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--linea);"></a>`).join("")
    }</div>` : "";
    const idOt = (r.ID_OT||"").toString().replace(/'/g,"\\'");
    return `
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${r.EQUIPO||"—"}</div>
          <div class="subtexto" style="margin-top:2px;">${r.USUARIO||"—"} · Actividad</div>
        </div>
        <span class="badge">${r.FECHA||""}</span>
      </div>
      <div class="badge-fila" style="margin-top:8px;">
        ${r.CRITICIDAD?`<span class="badge ${claseCriticidad(r.CRITICIDAD)}">${r.CRITICIDAD}</span>`:''}
      </div>
      ${r.DESCRIPCION?`<div class="desc">${r.DESCRIPCION}</div>`:""}
      ${fotosHtml}
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button type="button" class="btn btn-secundario" style="width:auto;flex:1;padding:9px 10px;font-size:12.5px;" onclick="verDetalleActividadAdmin('${idOt}')">Ver detalle</button>
        <button type="button" class="btn btn-secundario" style="width:auto;flex:1;padding:9px 10px;font-size:12.5px;" onclick="editarActividadAdmin('${idOt}')">Editar</button>
        <button type="button" class="btn btn-texto" style="width:auto;flex:1;padding:9px 10px;font-size:12.5px;color:var(--rojo-texto,#c0392b);" onclick="eliminarActividadAdmin('${idOt}')">Eliminar</button>
      </div>
    </div>`;
  }).join("");
}

function renderizarListadoFallasAdmin(){
  const filtro = document.getElementById("admin-filtro-tecnico").value;
  const cont = document.getElementById("admin-lista-fallas");
  if(!cont) return;

  const fallas = adminDatosCache.fallas
    .filter(r => !filtro || r.TECNICO_RESPONSABLE === filtro);

  if(fallas.length===0){
    cont.innerHTML = `<div class="vacio"><div class="subtexto">No hay fallas para este filtro.</div></div>`;
    return;
  }
  cont.innerHTML = fallas.map(r=>{
    const fotos = (r.FOTOS||"").split("|").map(f=>f.trim()).filter(f=>f && f!=="ERROR_SUBIENDO_FOTO");
    const fotosHtml = fotos.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${
      fotos.map(f=>`<a href="${f}" target="_blank" rel="noopener"><img src="${f}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--linea);"></a>`).join("")
    }</div>` : "";
    return `
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${r.EQUIPO||"—"}</div>
          <div class="subtexto" style="margin-top:2px;">${r.TECNICO_RESPONSABLE||"—"} · Falla</div>
        </div>
        <span class="badge">${r.FECHA||""}</span>
      </div>
      <div class="badge-fila" style="margin-top:8px;">
        ${r.CRITICIDAD?`<span class="badge ${claseCriticidad(r.CRITICIDAD)}">${r.CRITICIDAD}</span>`:''}
        <span class="badge ${claseEstadoFalla(r.ESTADO||"Abierta")}">${r.ESTADO||"Abierta"}</span>
      </div>
      ${r.DESCRIPCION?`<div class="desc">${r.DESCRIPCION}</div>`:""}
      ${fotosHtml}
    </div>`;
  }).join("");
}

function soloFechaExcel(valor){
  if(!valor) return "";
  const texto = String(valor);
  const m = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if(m) return m[1];
  const d = new Date(valor);
  if(!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return texto;
}

/* Calcula un ancho de columna (en caracteres) según el contenido más largo
   de cada columna, para que el Excel exportado no salga con el texto
   amontonado. FOTO usa un ancho fijo porque su valor visible es siempre
   el texto corto "Ver foto" (el link va aparte, como hipervínculo). */
function calcularAnchosColumnas(filas, columnas){
  return columnas.map(col=>{
    if(col === "FOTO") return { wch: 12 };
    let max = String(col).length;
    filas.forEach(fila=>{
      const val = fila[col];
      const len = (val===undefined || val===null) ? 0 : String(val).length;
      if(len > max) max = len;
    });
    return { wch: Math.min(Math.max(max + 2, 10), 60) };
  });
}

function exportarExcel(){
  const quitarFotos = (arr) => arr.map(r=>{
    const copia = Object.assign({}, r);
    delete copia.FOTOS;
    return copia;
  });
  const libro = XLSX.utils.book_new();
  // Por ahora solo se exportan los Requerimientos (a pedido). Actividades y
  // Fallas se dejan listas para re-habilitar más adelante:
  // XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(quitarFotos(adminDatosCache.actividades)), "Actividades");
  // XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(quitarFotos(adminDatosCache.fallas)), "Fallas");

  const filasReq = [];
  (adminDatosCache.requerimientos||[]).forEach(r=>{
    const items = (r.ITEMS && r.ITEMS.length) ? r.ITEMS : [{}];
    items.forEach(it=>{
      filasReq.push({
        CORRELATIVO: r.CORRELATIVO || r.ID,
        FECHA: soloFechaExcel(r.FECHA),
        PRIORIDAD: r.PRIORIDAD || "",
        TECNICO: r.TECNICO,
        MOTIVO: r.MOTIVO,
        N_ITEM: it.numero || "",
        CANTIDAD: it.cantidad || "",
        UM: it.um || "",
        CODIGO_PRODUCTO: it.codigo || "",
        MATERIAL: it.nombre || "",
        ESPECIFICACIONES: it.especificaciones || "",
        CODIGO_ACTIVO: it.equipoCodigo || "",
        EQUIPO: it.equipo || "",
        PRECIO_UNITARIO: it.precio_unitario || "",
        PRECIO_TOTAL: it.precio_total || "",
        FOTO: it.foto || "",
        COMENTARIOS: r.COMENTARIOS || ""
      });
    });
  });
  const hojaReq = XLSX.utils.json_to_sheet(filasReq);
  const columnasReq = filasReq.length ? Object.keys(filasReq[0]) : [];
  const colFoto = columnasReq.indexOf("FOTO");
  if(colFoto > -1){
    filasReq.forEach((fila, i)=>{
      if(fila.FOTO){
        const celda = XLSX.utils.encode_cell({ r: i + 1, c: colFoto });
        if(hojaReq[celda]){
          hojaReq[celda].l = { Target: fila.FOTO, Tooltip: "Ver foto" };
          hojaReq[celda].v = "Ver foto";
        }
      }
    });
  }
  hojaReq['!cols'] = calcularAnchosColumnas(filasReq, columnasReq);
  XLSX.utils.book_append_sheet(libro, hojaReq, "Requerimientos");

  const fecha = new Date().toISOString().slice(0,10);
  XLSX.writeFile(libro, `Mantenimiento_ChanChan_${fecha}.xlsx`);
}

async function cargarDispositivosAdmin(sesion){
  const cont = document.getElementById("admin-dispositivos-lista");
  cont.textContent = "Cargando...";
  const resp = await llamarServidor({ tipo:"listado_dispositivos", dni_admin: sesion.dni });
  if(!resp || !resp.ok){
    cont.textContent = (resp && resp.mensaje) || "No se pudo cargar.";
    return;
  }
  const usuarios = resp.usuarios||[];
  const badgeDisp = document.getElementById("admin-badge-dispositivos");
  if(badgeDisp) badgeDisp.textContent = `${usuarios.length} registrado(s)`;
  if(usuarios.length===0){
    cont.textContent = "Todavía no hay dispositivos registrados.";
    return;
  }
  cont.innerHTML = usuarios.map(u=>`
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${u.nombre||"—"}</div>
          <div class="subtexto" style="margin-top:2px;">${u.cargo||u.rol||""}</div>
        </div>
        <span class="badge">${u.fecha_registro||""}</span>
      </div>
      <div class="desc">${u.dispositivo_info || "Dispositivo desconocido"} · ID …${(u.dispositivo_id||"").slice(-6)}</div>
      <button type="button" class="btn btn-secundario" style="margin-top:10px;width:auto;padding:9px 14px;font-size:12.5px;" onclick="liberarDispositivoUI('${u.slot_id}', this)">Liberar este dispositivo</button>
    </div>
  `).join("");
}

async function liberarDispositivoUI(slotId, boton){
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  if(boton){ boton.disabled = true; boton.textContent = "Liberando..."; }

  const resp = await llamarServidor({
    tipo:"liberar_dispositivo",
    dni_admin: sesion.dni,
    slot_id: slotId
  });
  mostrarToast(resp.mensaje || (resp.ok? "Dispositivo liberado":"No se pudo liberar"), resp.ok);
  if(resp.ok){
    cargarDispositivosAdmin(sesion);
  } else if(boton){
    boton.disabled = false; boton.textContent = "Liberar este dispositivo";
  }
}

/* ============ MODAL GENÉRICO ============ */
function abrirModal(html){
  document.getElementById("modal-caja").innerHTML = html;
  document.getElementById("modal-overlay").classList.add("mostrar");
}
function cerrarModal(){
  document.getElementById("modal-overlay").classList.remove("mostrar");
  document.getElementById("modal-caja").innerHTML = "";
}

/* ============ PIN DE ACCESO: REGISTROS DE MANTENIMIENTO ============
   Pide el PIN cada vez que alguien intenta entrar a "Registros de
   mantenimiento" (Nueva Actividad / Historial de Fallas). No queda
   "desbloqueado": se vuelve a pedir en cada intento de ingreso. */
const PIN_REGISTROS_MTTO = "123456";

function verificarPinRegistrosMtto(){
  abrirModal(`
    <div class="modal-titulo"><span>Acceso restringido</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <div class="campo" style="margin-top:6px;">
      <label>Ingresa el PIN para continuar</label>
      <input type="password" inputmode="numeric" maxlength="6" id="pin-registros-input" placeholder="••••••" onkeydown="if(event.key==='Enter') validarPinRegistrosMtto()">
    </div>
    <div id="pin-registros-error" style="display:none;color:var(--rojo-texto,#A6362D);font-size:12.5px;margin:-6px 0 12px;">PIN incorrecto. Intenta de nuevo.</div>
    <button type="button" class="btn btn-primario" onclick="validarPinRegistrosMtto()">Ingresar</button>
  `);
  setTimeout(()=>{ const el = document.getElementById("pin-registros-input"); if(el) el.focus(); }, 100);
}

function validarPinRegistrosMtto(){
  const input = document.getElementById("pin-registros-input");
  if(!input) return;
  if(input.value === PIN_REGISTROS_MTTO){
    cerrarModal();
    irA("pantalla-registros-mtto");
  }else{
    document.getElementById("pin-registros-error").style.display = "block";
    input.value = "";
    input.focus();
  }
}

/* ============ ADMIN: VER DETALLE / EDITAR / ELIMINAR ACTIVIDADES ============ */
function verDetalleActividadAdmin(idOt){
  const r = adminDatosCache.actividades.find(a => String(a.ID_OT)===String(idOt));
  if(!r){ mostrarToast("No se encontró el registro.", false); return; }
  const fotos = (r.FOTOS||"").split("|").map(f=>f.trim()).filter(f=>f && f!=="ERROR_SUBIENDO_FOTO");
  const fotosHtml = fotos.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">${
    fotos.map(f=>`<a href="${f}" target="_blank" rel="noopener"><img src="${f}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--linea);"></a>`).join("")
  }</div>` : "<span style=\"opacity:.7;\">Sin fotos</span>";
  abrirModal(`
    <div class="modal-titulo"><span>Detalle de actividad</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <div class="modal-fila"><b>ID OT</b>${r.ID_OT||"—"}</div>
    <div class="modal-fila"><b>Fecha</b>${r.FECHA||"—"}</div>
    <div class="modal-fila"><b>Técnico</b>${r.USUARIO||"—"}</div>
    <div class="modal-fila"><b>Equipo</b>${r.EQUIPO||"—"}</div>
    <div class="modal-fila"><b>Área</b>${r.AREA||"—"}</div>
    <div class="modal-fila"><b>Criticidad</b>${r.CRITICIDAD||"—"}</div>
    <div class="modal-fila"><b>Tipo de mantenimiento</b>${r.TIPO_MTTO||"—"}</div>
    <div class="modal-fila"><b>Especialidad</b>${r.ESPECIALIDAD||"—"}</div>
    <div class="modal-fila"><b>Descripción</b>${r.DESCRIPCION||"—"}</div>
    <div class="modal-fila"><b>Técnico responsable</b>${r.TECNICO_RESPONSABLE||"—"}</div>
    <div class="modal-fila"><b>Inicio</b>${r.FECHA_HORA_INICIO||"—"}</div>
    <div class="modal-fila"><b>Fin</b>${r.FECHA_HORA_FIN||"—"}</div>
    <div class="modal-fila"><b>Total horas</b>${r.TOTAL_HORAS||"—"}</div>
    <div class="modal-fila"><b>Horómetro/Km</b>${r.HOROMETRO_KM||"—"}</div>
    <div class="modal-fila"><b>Integrantes</b>${r.INTEGRANTES||"—"}</div>
    <div class="modal-fila"><b>Comentarios</b>${r.COMENTARIOS||"—"}</div>
    <div class="modal-fila" style="border-bottom:none;"><b>Fotos</b>${fotosHtml}</div>
    <button class="btn btn-primario" style="margin-top:14px;" onclick="cerrarModal()">Cerrar</button>
  `);
}

function editarActividadAdmin(idOt){
  const r = adminDatosCache.actividades.find(a => String(a.ID_OT)===String(idOt));
  if(!r){ mostrarToast("No se encontró el registro.", false); return; }
  abrirModal(`
    <div class="modal-titulo"><span>Editar actividad</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <div class="campo"><label>Equipo</label><input type="text" id="edit-act-equipo" value="${(r.EQUIPO||"").replace(/"/g,'&quot;')}"></div>
    <div class="campo"><label>Área</label><input type="text" id="edit-act-area" value="${(r.AREA||"").replace(/"/g,'&quot;')}"></div>
    <div class="campo"><label>Criticidad</label>
      <select id="edit-act-criticidad">
        <option value="Alta" ${r.CRITICIDAD==="Alta"?"selected":""}>Alta</option>
        <option value="Media" ${r.CRITICIDAD==="Media"?"selected":""}>Media</option>
        <option value="Baja" ${r.CRITICIDAD==="Baja"?"selected":""}>Baja</option>
      </select>
    </div>
    <div class="campo"><label>Descripción</label><textarea id="edit-act-descripcion" rows="3">${(r.DESCRIPCION||"")}</textarea></div>
    <div class="campo"><label>Comentarios</label><textarea id="edit-act-comentarios" rows="2">${(r.COMENTARIOS||"")}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:6px;">
      <button class="btn btn-secundario" style="flex:1;" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primario" style="flex:1;" id="btn-guardar-edit-act" onclick="guardarEdicionActividadAdmin('${idOt}')">Guardar</button>
    </div>
  `);
}

async function guardarEdicionActividadAdmin(idOt){
  const boton = document.getElementById("btn-guardar-edit-act");
  if(boton){ boton.disabled = true; boton.textContent = "Guardando..."; }
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({
    tipo: "editar_actividad",
    dni_admin: sesion.dni,
    id_ot: idOt,
    campos: {
      EQUIPO: document.getElementById("edit-act-equipo").value.trim(),
      AREA: document.getElementById("edit-act-area").value.trim(),
      CRITICIDAD: document.getElementById("edit-act-criticidad").value,
      DESCRIPCION: document.getElementById("edit-act-descripcion").value.trim(),
      COMENTARIOS: document.getElementById("edit-act-comentarios").value.trim()
    }
  });
  mostrarToast(resp.mensaje || (resp.ok? "Actividad actualizada":"No se pudo actualizar"), resp.ok);
  if(resp.ok){
    cerrarModal();
    const sesion2 = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
    await abrirPanelAdmin();
    irA("pantalla-admin-actividades");
  } else if(boton){
    boton.disabled = false; boton.textContent = "Guardar";
  }
}

function eliminarActividadAdmin(idOt){
  abrirModal(`
    <div class="modal-titulo"><span>Eliminar actividad</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <p class="subtexto">Esta acción borra la actividad de forma permanente de la base de datos. No se puede deshacer. ¿Deseas continuar?</p>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn btn-secundario" style="flex:1;" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primario" style="flex:1;background:var(--rojo-600,#c0392b);" id="btn-confirmar-elim-act" onclick="confirmarEliminarActividadAdmin('${idOt}')">Sí, eliminar</button>
    </div>
  `);
}

async function confirmarEliminarActividadAdmin(idOt){
  const boton = document.getElementById("btn-confirmar-elim-act");
  if(boton){ boton.disabled = true; boton.textContent = "Eliminando..."; }
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({ tipo:"eliminar_actividad", dni_admin: sesion.dni, id_ot: idOt });
  mostrarToast(resp.mensaje || (resp.ok? "Actividad eliminada":"No se pudo eliminar"), resp.ok);
  if(resp.ok){
    cerrarModal();
    await abrirPanelAdmin();
    irA("pantalla-admin-actividades");
  } else if(boton){
    boton.disabled = false; boton.textContent = "Sí, eliminar";
  }
}

/* ============ ADMIN: VER DETALLE / EDITAR / ELIMINAR REQUERIMIENTOS ============ */
function verDetalleRequerimientoAdmin(correlativo){
  const r = (adminDatosCache.requerimientos||[]).find(x => String(x.CORRELATIVO||x.ID)===String(correlativo));
  if(!r){ mostrarToast("No se encontró el requerimiento.", false); return; }
  const items = r.ITEMS || [];
  const itemsHtml = items.length ? items.map((it,i)=>`
    <div style="border:1px solid var(--linea);border-radius:10px;padding:10px;margin-top:8px;">
      <div style="font-weight:700;font-size:13px;">${i+1}. ${it.nombre||"—"} ${it.codigo?`<span style="font-weight:400;color:var(--azul-600,#2563eb);">(${it.codigo})</span>`:""}</div>
      <div class="subtexto" style="margin-top:4px;">Cantidad: ${it.cantidad||"—"} ${it.um||""} · P. Unit: S/ ${(Number(it.precio_unitario)||0).toFixed(2)} · Total: S/ ${(Number(it.precio_total)||0).toFixed(2)}</div>
      ${it.especificaciones?`<div class="subtexto" style="margin-top:2px;">Especificaciones: ${it.especificaciones}</div>`:""}
      <div class="subtexto" style="margin-top:2px;">Equipo: ${it.equipo||"—"} ${it.equipoCodigo?`· CECO: ${it.equipoCodigo}`:""}</div>
      ${it.foto?`<div style="margin-top:6px;"><a href="${it.foto}" target="_blank" rel="noopener"><img src="${it.foto}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--linea);"></a></div>`:""}
    </div>
  `).join("") : "<p class=\"subtexto\">Sin materiales.</p>";
  abrirModal(`
    <div class="modal-titulo"><span>${r.CORRELATIVO||r.ID}</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <div class="modal-fila"><b>Fecha</b>${(r.FECHA||'').toString().slice(0,10)}</div>
    <div class="modal-fila"><b>Prioridad</b>${r.PRIORIDAD||"—"}</div>
    <div class="modal-fila"><b>Técnico</b>${r.TECNICO||"—"}</div>
    <div class="modal-fila"><b>Motivo</b>${r.MOTIVO||"—"}</div>
    <div class="modal-fila" style="border-bottom:none;"><b>Comentarios</b>${r.COMENTARIOS||"—"}</div>
    <div style="font-weight:700;font-size:13.5px;margin-top:12px;">Materiales (${items.length})</div>
    ${itemsHtml}
    <button class="btn btn-primario" style="margin-top:14px;" onclick="cerrarModal()">Cerrar</button>
  `);
}

let reqEditandoState = null;
function editarRequerimientoAdmin(correlativo){
  const r = (adminDatosCache.requerimientos||[]).find(x => String(x.CORRELATIVO||x.ID)===String(correlativo));
  if(!r){ mostrarToast("No se encontró el requerimiento.", false); return; }
  reqEditandoState = {
    correlativo: r.CORRELATIVO || r.ID,
    motivo: r.MOTIVO || "",
    prioridad: r.PRIORIDAD || "Convencional",
    comentarios: r.COMENTARIOS || "",
    items: (r.ITEMS||[]).map(it => Object.assign({}, it))
  };
  renderModalEdicionRequerimiento();
}

function renderModalEdicionRequerimiento(){
  const st = reqEditandoState;
  const itemsHtml = st.items.map((it,i)=>`
    <div style="border:1px solid var(--linea);border-radius:10px;padding:10px;margin-top:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;font-size:13px;">${i+1}. ${it.nombre||"—"} ${it.codigo?`(${it.codigo})`:""}</div>
        <button type="button" class="modal-cerrar" style="font-size:14px;" onclick="quitarItemEdicionRequerimiento(${i})">Quitar</button>
      </div>
      <div class="fila-2" style="margin-top:6px;">
        <div class="campo" style="margin-bottom:6px;"><label>Cantidad</label><input type="number" step="any" data-idx="${i}" data-campo="cantidad" class="edit-req-item-input" value="${it.cantidad||0}" onchange="actualizarItemEdicionRequerimiento(this)"></div>
        <div class="campo" style="margin-bottom:6px;"><label>Precio unitario</label><input type="number" step="0.01" data-idx="${i}" data-campo="precio_unitario" class="edit-req-item-input" value="${it.precio_unitario||0}" onchange="actualizarItemEdicionRequerimiento(this)"></div>
      </div>
      <div class="campo" style="margin-bottom:6px;"><label>Especificaciones</label><input type="text" data-idx="${i}" data-campo="especificaciones" class="edit-req-item-input" value="${(it.especificaciones||"").replace(/"/g,'&quot;')}" onchange="actualizarItemEdicionRequerimiento(this)"></div>
      <div class="fila-2">
        <div class="campo" style="margin-bottom:0;"><label>Equipo</label><input type="text" data-idx="${i}" data-campo="equipo" class="edit-req-item-input" value="${(it.equipo||"").replace(/"/g,'&quot;')}" onchange="actualizarItemEdicionRequerimiento(this)"></div>
        <div class="campo" style="margin-bottom:0;"><label>Código CECO</label><input type="text" data-idx="${i}" data-campo="equipoCodigo" class="edit-req-item-input" value="${(it.equipoCodigo||"").replace(/"/g,'&quot;')}" onchange="actualizarItemEdicionRequerimiento(this)"></div>
      </div>
      <div class="subtexto" style="margin-top:6px;">Total ítem: S/ ${(Number(it.cantidad||0)*Number(it.precio_unitario||0)).toFixed(2)}</div>
    </div>
  `).join("");
  abrirModal(`
    <div class="modal-titulo"><span>Editar ${st.correlativo}</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <div class="campo"><label>Motivo</label><input type="text" id="edit-req-motivo" value="${st.motivo.replace(/"/g,'&quot;')}"></div>
    <div class="campo"><label>Prioridad</label>
      <select id="edit-req-prioridad">
        <option value="Urgente" ${st.prioridad==='Urgente'?'selected':''}>Urgente</option>
        <option value="Convencional" ${st.prioridad==='Convencional'?'selected':''}>Convencional</option>
      </select>
    </div>
    <div class="campo"><label>Comentarios</label><textarea id="edit-req-comentarios" rows="2">${st.comentarios}</textarea></div>
    <div style="font-weight:700;font-size:13.5px;margin-top:8px;">Materiales (${st.items.length})</div>
    ${itemsHtml || "<p class=\"subtexto\">Sin materiales — agrega al menos uno antes de guardar.</p>"}
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn btn-secundario" style="flex:1;" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primario" style="flex:1;" id="btn-guardar-edit-req" onclick="guardarEdicionRequerimientoAdmin()">Guardar</button>
    </div>
  `);
}

function actualizarItemEdicionRequerimiento(input){
  const idx = Number(input.dataset.idx);
  const campo = input.dataset.campo;
  reqEditandoState.items[idx][campo] = (campo==="cantidad"||campo==="precio_unitario") ? Number(input.value)||0 : input.value;
  reqEditandoState.items[idx].precio_total = Number(reqEditandoState.items[idx].cantidad||0) * Number(reqEditandoState.items[idx].precio_unitario||0);
}

function quitarItemEdicionRequerimiento(idx){
  reqEditandoState.items.splice(idx,1);
  renderModalEdicionRequerimiento();
}

async function guardarEdicionRequerimientoAdmin(){
  if(reqEditandoState.items.length===0){
    mostrarToast("Debe quedar al menos un material.", false);
    return;
  }
  const boton = document.getElementById("btn-guardar-edit-req");
  if(boton){ boton.disabled = true; boton.textContent = "Guardando..."; }
  reqEditandoState.motivo = document.getElementById("edit-req-motivo").value.trim();
  reqEditandoState.prioridad = document.getElementById("edit-req-prioridad").value;
  reqEditandoState.comentarios = document.getElementById("edit-req-comentarios").value.trim();
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({
    tipo: "editar_requerimiento",
    dni_admin: sesion.dni,
    correlativo: reqEditandoState.correlativo,
    motivo: reqEditandoState.motivo,
    prioridad: reqEditandoState.prioridad,
    comentarios: reqEditandoState.comentarios,
    items: reqEditandoState.items
  });
  mostrarToast(resp.mensaje || (resp.ok? "Requerimiento actualizado":"No se pudo actualizar"), resp.ok);
  if(resp.ok){
    cerrarModal();
    reqEditandoState = null;
    const sesion2 = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
    await cargarRequerimientosAdmin(sesion2);
    irA("pantalla-admin-requerimientos");
  } else if(boton){
    boton.disabled = false; boton.textContent = "Guardar";
  }
}

function eliminarRequerimientoAdmin(correlativo){
  abrirModal(`
    <div class="modal-titulo"><span>Eliminar ${correlativo}</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <p class="subtexto">Esta acción borra el requerimiento de forma permanente (de la lista y del historial). El técnico deberá volver a llenarlo desde cero si lo necesita. No se puede deshacer. ¿Deseas continuar?</p>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn btn-secundario" style="flex:1;" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-primario" style="flex:1;background:var(--rojo-600,#c0392b);" id="btn-confirmar-elim-req" onclick="confirmarEliminarRequerimientoAdmin('${correlativo}')">Sí, eliminar</button>
    </div>
  `);
}

async function confirmarEliminarRequerimientoAdmin(correlativo){
  const boton = document.getElementById("btn-confirmar-elim-req");
  if(boton){ boton.disabled = true; boton.textContent = "Eliminando..."; }
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({ tipo:"eliminar_requerimiento", dni_admin: sesion.dni, correlativo: correlativo });
  mostrarToast(resp.mensaje || (resp.ok? "Requerimiento eliminado":"No se pudo eliminar"), resp.ok);
  if(resp.ok){
    cerrarModal();
    await cargarRequerimientosAdmin(sesion);
    irA("pantalla-admin-requerimientos");
  } else if(boton){
    boton.disabled = false; boton.textContent = "Sí, eliminar";
  }
}

