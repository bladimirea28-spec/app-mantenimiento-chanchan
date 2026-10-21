/* ============ ADMIN: DASHBOARD DE CONTROL DE MANTENIMIENTO ============
   Resumen para admins: estado de las unidades, mantenimientos y costos del
   período, no conformidades de los checklists y próximos mantenimientos.
   Usa lo que ya cargó el panel (checklists y fallas) más el control de
   mantenimiento; no hace pedidos extra al servidor salvo ese. */

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

async function abrirDashboardControl(){
  irA("pantalla-admin-dashboard-control");
  document.getElementById("dash-contenido").innerHTML = `<div class="subtexto">Cargando...</div>`;
  try{ await cargarControlMantenimiento(); }catch(e){ document.getElementById("dash-contenido").innerHTML = `<div class="subtexto">${esc(e.message)}</div>`; return; }
  renderDashboardControl();
}

function inicioDelPeriodo(periodo){
  const hoy = new Date();
  if(periodo === "mes") return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if(periodo === "3m") return new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
  if(periodo === "anio") return new Date(hoy.getFullYear(), 0, 1);
  return null;
}

function enPeriodo(fechaTexto, desde){
  if(!desde) return true;
  const f = fechaDesdePE(fechaTexto);
  return !!f && f >= desde;
}

/* Últimos 6 meses (incluido el actual) como [{clave:"2026-10", etiqueta:"Oct"}]. */
function ultimosMeses(n){
  const hoy = new Date();
  const lista = [];
  for(let i = n - 1; i >= 0; i--){
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    lista.push({ clave:`${d.getFullYear()}-${d.getMonth()}`, etiqueta:NOMBRES_MES[d.getMonth()] });
  }
  return lista;
}
function claveMes(fechaTexto){ const f = fechaDesdePE(fechaTexto); return f ? `${f.getFullYear()}-${f.getMonth()}` : ""; }

function tarjetaKpi(valor, etiqueta, acento){
  return `<div class="kpi-card ${acento ? "acento-" + acento : ""}"><div class="kpi-valor">${valor}</div><div class="kpi-etiqueta">${etiqueta}</div></div>`;
}

function renderDashboardControl(){
  const cont = document.getElementById("dash-contenido");
  const periodo = document.getElementById("dash-periodo").value;
  const desde = inicioDelPeriodo(periodo);
  const estados = estadosDeUnidades();
  const cuenta = e => estados.filter(r => r.estado === e).length;

  const mantos = controlDatos.mantenimientos.filter(m => enPeriodo(m.fecha, desde));
  const prev = mantos.filter(m => m.tipo === "Preventivo");
  const corr = mantos.filter(m => m.tipo === "Correctivo");
  const costo = lista => lista.reduce((s, m) => s + (Number(m.costo) || 0), 0);
  const pctPreventivo = mantos.length ? Math.round(prev.length / mantos.length * 100) : 0;

  // Todo sale del mismo paquete que la ficha de cada equipo (controlDatos),
  // así los números cuadran en todas las pantallas.
  const todosChecklists = controlDatos.checklists || [];
  const checklists = todosChecklists.filter(c => enPeriodo(c.fecha, desde));
  const tieneNc = c => Number(c.nc) > 0 || c.puede_utilizar === "NO";
  const conNc = checklists.filter(tieneNc);
  const hoyTexto = fechaPE(new Date());
  const checklistsHoy = todosChecklists.filter(c => mismaFechaPE(c.fecha, hoyTexto)).length;

  // Fallas y hallazgos (de checklists y de la inspección de los PM).
  const fallas = controlDatos.fallas || [];
  const abiertas = fallas.filter(fallaAbierta);
  const esHallazgo = f => /hallazgo|no conformidad/i.test(f.TIPO_FALLA || "");
  const reportadas = fallas.filter(f => enPeriodo(f.FECHA, desde));
  const resueltas = fallas.filter(f => !fallaAbierta(f) && enPeriodo(f.FECHA_RESOLUCION || f.FECHA, desde));
  const horasParada = reportadas.reduce((s, f) => s + (Number(f.MINUTOS_PARADA) || 0), 0) / 60;
  const diasSolucion = resueltas.map(f => { const a = fechaDesdePE(f.FECHA), b = fechaDesdePE(f.FECHA_RESOLUCION); return a && b ? Math.max(0, (b - a) / 86400000) : null; }).filter(d => d != null);
  const promedioSolucion = diasSolucion.length ? diasSolucion.reduce((s, d) => s + d, 0) / diasSolucion.length : null;
  const noOkPm = [];
  mantos.forEach(m => (m.inspeccion || []).forEach(x => { if(x.resultado === "NO OK") noOkPm.push({ m, x }); }));
  const ncChecklists = checklists.reduce((s, c) => s + (Number(c.nc) || 0), 0);
  const sinVb = controlDatos.mantenimientos.filter(m => m.sincronizado && !m.vb_nombre);

  const soles = n => "S/ " + n.toLocaleString("es-PE", { minimumFractionDigits:2, maximumFractionDigits:2 });
  let html = "";

  html += `<div class="dash-titulo">Estado de las unidades (hoy)</div>
    <div class="kpi-grid">
      ${tarjetaKpi(cuenta("VENCIDO"), "PM vencidos", "rojo")}
      ${tarjetaKpi(cuenta("PRÓXIMO"), "PM próximos", "ambar")}
      ${tarjetaKpi(cuenta("AL DÍA"), "Al día", "verde")}
      ${tarjetaKpi(cuenta("SIN REGISTRO"), "Sin punto de partida", "")}
    </div>`;

  // Lo más importante primero: lo que hay que corregir.
  const ordenCrit = { alta:0, media:1, baja:2 };
  const pendientesOrden = abiertas.slice().sort((a, b) =>
    ((ordenCrit[String(a.CRITICIDAD).toLowerCase()] ?? 3) - (ordenCrit[String(b.CRITICIDAD).toLowerCase()] ?? 3)) ||
    ((diasDesdeTexto(b.FECHA) || 0) - (diasDesdeTexto(a.FECHA) || 0)));
  html += `<div class="dash-titulo">Fallas y hallazgos</div>
    <div class="kpi-grid">
      ${tarjetaKpi(abiertas.length, "Pendientes por corregir", abiertas.length ? "rojo" : "verde")}
      ${tarjetaKpi(abiertas.filter(esHallazgo).length, "De ellos, hallazgos (PM / checklist)", "ambar")}
      ${tarjetaKpi(resueltas.length, "Resueltas (período)", "verde")}
      ${tarjetaKpi(promedioSolucion == null ? "—" : miles(promedioSolucion) + " d", "Tiempo medio de solución", "azul")}
    </div>
    <div class="kpi-grid kpi-grid-3">
      ${tarjetaKpi(noOkPm.length, "NO OK en PM (período)", noOkPm.length ? "ambar" : "")}
      ${tarjetaKpi(ncChecklists, "NC en checklists (período)", ncChecklists ? "ambar" : "")}
      ${tarjetaKpi(miles(horasParada) + " h", "Parada por fallas", "")}
    </div>
    <div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Pendientes por corregir</div>
      ${pendientesOrden.length ? pendientesOrden.slice(0, 8).map(f => {
        const cod = codigoDeTextoEquipo(f.EQUIPO);
        const conFicha = cod && equipoMtto(cod);
        return `<div class="dash-fila" ${conFicha ? `onclick="abrirFichaEquipo(${jsArg(cod)})"` : `onclick="verDetalleFallaAdmin(${jsArg(f.CLAVE || "")})"`}>
          <span class="badge ${claseCriticidad(f.CRITICIDAD) || claseEstadoFalla(f.ESTADO)}">${esc(f.CRITICIDAD || f.ESTADO || "Abierta")}</span>
          <div style="flex:1;"><b>${esc(String(f.EQUIPO || "—").split(" - ").slice(0, 2).join(" · "))}</b>
            <div class="subtexto">${esHallazgo(f) ? "🔎 " : "⚠️ "}${esc(f.TIPO_FALLA || "Falla")} · ${esc(haceTexto(f.FECHA))}${f.TECNICO_RESPONSABLE ? " · " + esc(f.TECNICO_RESPONSABLE) : " · sin técnico"}</div></div>
        </div>`; }).join("") + (pendientesOrden.length > 8 ? `<div class="subtexto" style="margin-top:6px;">… y ${pendientesOrden.length - 8} más (ver Historial de Fallas).</div>` : "")
        : `<div class="subtexto">No hay fallas ni hallazgos pendientes. 👍</div>`}
    </div>`;

  html += `<div class="dash-titulo">Mantenimientos del período</div>
    <div class="kpi-grid kpi-grid-3">
      ${tarjetaKpi(prev.length, "Preventivos", "verde")}
      ${tarjetaKpi(corr.length, "Correctivos", "rojo")}
      ${tarjetaKpi(pctPreventivo + "%", "Preventivo", "azul")}
    </div>
    <div class="kpi-grid kpi-grid-3 dash-montos">
      ${tarjetaKpi(soles(costo(mantos)), "Costo total", "")}
      ${tarjetaKpi(soles(costo(prev)), "Preventivo", "")}
      ${tarjetaKpi(soles(costo(corr)), "Correctivo", "")}
    </div>
    ${sinVb.length ? `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Falta visto bueno (${sinVb.length})</div>
      <div class="subtexto" style="margin-bottom:6px;">El V°B° es solo la firma de revisión del supervisor: estos mantenimientos ya cuentan en todos los datos. Tócalos para revisarlos y aprobarlos.</div>
      ${masRecientesPrimero(sinVb, "fecha").slice(0, 5).map(m => `<div class="dash-fila" onclick="abrirFichaEquipo(${jsArg(m.codigo)})">
        <span class="badge">${esc(m.tipo === "Preventivo" ? String(m.pm).split(" - ")[0] : "Correctivo")}</span>
        <div style="flex:1;"><b>${esc(m.codigo)}</b> ${esc(String(m.equipo || "").split(" - ")[0])}<div class="subtexto">${esc(m.fecha)} · ${esc(m.n_ot || "")} · ${esc(m.tecnico || "")}</div></div></div>`).join("")}
    </div>` : ""}`;

  html += `<div class="dash-titulo">Checklists diarios</div>
    <div class="kpi-grid kpi-grid-3">
      ${tarjetaKpi(checklistsHoy, "Llenados hoy", "azul")}
      ${tarjetaKpi(checklists.length, "En el período", "")}
      ${tarjetaKpi(checklists.length ? Math.round(conNc.length / checklists.length * 100) + "%" : "0%", "Con NC o no usar", conNc.length ? "ambar" : "verde")}
    </div>
    ${periodo === "anio" || periodo === "todo" ? `<div class="subtexto" style="margin-top:4px;">Checklists: se cuentan los últimos 4 meses.</div>` : ""}`;

  // Gráficos: últimos 6 meses.
  const meses = ultimosMeses(6);
  const porMes = (lista, filtro, campo) => meses.map(m => lista.filter(x => claveMes(x[campo || "fecha"]) === m.clave && (!filtro || filtro(x))).length);
  const todosMantos = controlDatos.mantenimientos;
  html += `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Fallas y hallazgos por mes</div>
      <div class="grafico-leyenda"><span><i style="background:var(--rojo-600);"></i>Reportadas</span><span><i style="background:var(--verde-700);"></i>Resueltas</span></div>
      ${grafBarras(meses.map(m => m.etiqueta), [
        { nombre:"Reportadas", color:"var(--rojo-600)", valores:porMes(fallas, null, "FECHA") },
        { nombre:"Resueltas", color:"var(--verde-700)", valores:porMes(fallas.filter(f => !fallaAbierta(f)), null, "FECHA_RESOLUCION") }
      ])}
    </div>`;
  html += `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Mantenimientos por mes</div>
      <div class="grafico-leyenda"><span><i style="background:var(--verde-700);"></i>Preventivos</span><span><i style="background:var(--rojo-600);"></i>Correctivos</span></div>
      ${grafBarras(meses.map(m => m.etiqueta), [
        { nombre:"Preventivos", color:"var(--verde-700)", valores:porMes(todosMantos, m => m.tipo === "Preventivo") },
        { nombre:"Correctivos", color:"var(--rojo-600)", valores:porMes(todosMantos, m => m.tipo === "Correctivo") }
      ])}
    </div>`;
  html += `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Costo de materiales por mes (S/)</div>
      ${grafBarras(meses.map(m => m.etiqueta), [
        { nombre:"Costo", color:"var(--azul-700)", valores:meses.map(m => Math.round(costo(todosMantos.filter(x => claveMes(x.fecha) === m.clave)))) }
      ])}
    </div>`;
  html += `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Checklists y no conformidades por mes</div>
      <div class="grafico-leyenda"><span><i style="background:var(--azul-700);"></i>Checklists</span><span><i style="background:var(--ambar-600);"></i>Con NC</span></div>
      ${grafBarras(meses.map(m => m.etiqueta), [
        { nombre:"Checklists", color:"var(--azul-700)", valores:porMes(todosChecklists) },
        { nombre:"Con NC", color:"var(--ambar-600)", valores:porMes(todosChecklists, tieneNc) }
      ])}
    </div>`;

  // Rankings del período.
  const sumarPor = (lista, clave, valor) => {
    const t = {};
    lista.forEach(x => { const k = clave(x); if(k) t[k] = (t[k] || 0) + valor(x); });
    return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const nombreUnidad = codigo => { const e = equipoMtto(codigo); return e ? `${codigo} · ${e.descripcion.split(" - ")[0]}` : codigo; };
  const ranking = pares => pares.length ? renderRankingHtml(pares) : `<div class="subtexto">Sin datos en el período.</div>`;
  // Qué falla más: unidades y puntos (sistema · tarea del PM, ítem del checklist).
  const puntosHallazgo = noOkPm.map(({ x }) => `${x.sistema} · ${x.tarea}`)
    .concat([].concat(...checklists.map(c => (c.hallazgos || []).filter(h => h.marca === "NC").map(h => h.item))));
  const conteo = lista => { const t = {}; lista.forEach(k => { if(k) t[k] = (t[k] || 0) + 1; }); return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 5); };
  html += `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Unidades con más fallas</div>
      ${ranking(conteo(reportadas.map(f => { const c = codigoDeTextoEquipo(f.EQUIPO); return c ? nombreUnidad(c) : String(f.EQUIPO || ""); })))}
    </div>
    <div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Puntos con más hallazgos</div>
      ${ranking(conteo(puntosHallazgo))}
    </div>`;
  html += `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Unidades con más costo</div>
      ${ranking(sumarPor(mantos, m => nombreUnidad(m.codigo), m => Number(m.costo) || 0).map(([k, v]) => [k, soles(v)]))}
    </div>
    <div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Unidades con más no conformidades</div>
      ${ranking(sumarPor(conNc, c => nombreUnidad(c.equipo_codigo || c.equipo_clave), () => 1))}
    </div>
    <div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Mantenimientos por técnico</div>
      ${ranking(sumarPor(mantos, m => m.tecnico, () => 1))}
    </div>`;

  // Próximos mantenimientos para programar.
  const orden = { "VENCIDO":0, "PRÓXIMO":1, "AL DÍA":2, "SIN REGISTRO":3 };
  const proximos = estados.filter(r => r.estado !== "SIN REGISTRO")
    .sort((a, b) => (orden[a.estado] - orden[b.estado]) || ((a.falta ?? 1e9) - (b.falta ?? 1e9))).slice(0, 8);
  html += `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Próximos mantenimientos para programar</div>
      ${proximos.length ? proximos.map(r => `
        <div class="dash-fila" onclick="verUnidadMantenimiento(${jsArg(r.eq.codigo)})">
          <span class="badge mtto-estado ${CLASE_ESTADO[r.estado]}">${esc(r.estado)}</span>
          <div style="flex:1;"><b>${esc(r.eq.codigo)}</b> ${esc(r.eq.descripcion.split(" - ")[0])}<div class="subtexto">${esc(r.proximo)} · ${esc(textoFalta(r))}</div></div>
        </div>`).join("") : `<div class="subtexto">Carga el punto de partida de las unidades para ver aquí sus próximos mantenimientos.</div>`}
    </div>
    <div class="fila-2" style="margin-top:14px;">
      <button class="btn btn-secundario" style="margin-top:0;" onclick="abrirControlUnidades()">Ver unidades</button>
      <button class="btn btn-primario" style="margin-top:0;" onclick="exportarControlExcel()">⬇ Excel de control</button>
    </div>
    <div class="subtexto" style="margin-top:10px;text-align:center;">${controlDatos.actualizado ? "Actualizado: " + esc(controlDatos.actualizado) : "Sin conexión: datos guardados en el celular."}</div>`;

  cont.innerHTML = html;
  const badge = document.getElementById("admin-badge-control");
  if(badge) badge.textContent = `${cuenta("VENCIDO")} vencido(s) · ${cuenta("PRÓXIMO")} próximo(s)`;
}
