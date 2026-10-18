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

  const checklists = (typeof checklistsAdminCache !== "undefined" ? checklistsAdminCache : []).filter(c => enPeriodo(c.fecha, desde));
  const conNc = checklists.filter(c => (c.respuestas || []).some(r => r.marca === "NC") || c.puede_utilizar === "NO");
  const fallas = (typeof adminDatosCache !== "undefined" && adminDatosCache.fallas) ? adminDatosCache.fallas : [];
  const ncAbiertas = fallas.filter(f => String(f.TIPO_FALLA) === "No conformidad en checklist" && String(f.ESTADO || "Abierta") !== "Resuelta").length;
  const hoyTexto = fechaPE(new Date());
  const checklistsHoy = (typeof checklistsAdminCache !== "undefined" ? checklistsAdminCache : []).filter(c => mismaFechaPE(c.fecha, hoyTexto)).length;

  const soles = n => "S/ " + n.toLocaleString("es-PE", { minimumFractionDigits:2, maximumFractionDigits:2 });
  let html = "";

  html += `<div class="dash-titulo">Estado de las unidades (hoy)</div>
    <div class="kpi-grid">
      ${tarjetaKpi(cuenta("VENCIDO"), "PM vencidos", "rojo")}
      ${tarjetaKpi(cuenta("PRÓXIMO"), "PM próximos", "ambar")}
      ${tarjetaKpi(cuenta("AL DÍA"), "Al día", "verde")}
      ${tarjetaKpi(cuenta("SIN REGISTRO"), "Sin punto de partida", "")}
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
    </div>`;

  html += `<div class="dash-titulo">Checklists diarios</div>
    <div class="kpi-grid kpi-grid-3">
      ${tarjetaKpi(checklistsHoy, "Llenados hoy", "azul")}
      ${tarjetaKpi(checklists.length ? Math.round(conNc.length / checklists.length * 100) + "%" : "0%", "Con NC (período)", "ambar")}
      ${tarjetaKpi(ncAbiertas, "NC sin corregir", ncAbiertas ? "rojo" : "verde")}
    </div>`;

  // Gráficos: últimos 6 meses.
  const meses = ultimosMeses(6);
  const porMes = (lista, filtro) => meses.map(m => lista.filter(x => claveMes(x.fecha) === m.clave && (!filtro || filtro(x))).length);
  const todosMantos = controlDatos.mantenimientos;
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
  const todosChecklists = typeof checklistsAdminCache !== "undefined" ? checklistsAdminCache : [];
  html += `<div class="tarjeta dash-bloque">
      <div class="dash-titulo" style="margin-top:0;">Checklists y no conformidades por mes</div>
      <div class="grafico-leyenda"><span><i style="background:var(--azul-700);"></i>Checklists</span><span><i style="background:var(--ambar-600);"></i>Con NC</span></div>
      ${grafBarras(meses.map(m => m.etiqueta), [
        { nombre:"Checklists", color:"var(--azul-700)", valores:porMes(todosChecklists) },
        { nombre:"Con NC", color:"var(--ambar-600)", valores:porMes(todosChecklists, c => (c.respuestas || []).some(r => r.marca === "NC") || c.puede_utilizar === "NO") }
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
