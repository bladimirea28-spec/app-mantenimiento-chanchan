/* ============ MÓDULO: REQUERIMIENTOS DE MATERIALES ============
   CATALOGO_MATERIALES: catálogo real de materiales (código, nombre, unidad
   de medida y precio de referencia = el precio más alto registrado en el
   historial de compras de la empresa). 1748 materiales. */

let reqItemDraft = null;
let reqItemFotoBase64 = null;
let reqItems = [];

function iniciarAutocompleteMaterial(){
  const input = document.getElementById("req-material-buscar");
  const lista = document.getElementById("req-material-lista");
  if(!input || !lista) return;

  input.addEventListener("input", ()=>{
    const q = input.value.trim().toLowerCase();
    if(q.length < 2){ lista.classList.remove("activa"); lista.innerHTML=""; return; }
    if(typeof CATALOGO_MATERIALES === "undefined"){ asegurarMateriales(); return; }
    const resultados = CATALOGO_MATERIALES.filter(m =>
      m.nombre.toLowerCase().includes(q) || m.codigo.includes(q)
    ).slice(0,8);

    const textoEscapado = input.value.trim().replace(/</g,"&lt;").replace(/"/g,"&quot;");
    let html = resultados.map((m,i)=>
      `<div class="autocomplete-item" data-idx="${i}">${resaltarCoincidencia(m.nombre,q)} — S/ ${m.precio.toFixed(2)} / ${m.um}</div>`
    ).join("");
    html += `<div class="autocomplete-item" id="req-material-manual-opcion" style="opacity:.85;font-style:italic;">+ Agregar "${textoEscapado}" manualmente (no está en el catálogo)</div>`;

    lista.innerHTML = html;
    lista.classList.add("activa");
    lista.querySelectorAll(".autocomplete-item[data-idx]").forEach((item,i)=>{
      item.addEventListener("click", ()=>{
        seleccionarMaterialCatalogo(resultados[i]);
        lista.classList.remove("activa");
      });
    });
    const opcionManual = document.getElementById("req-material-manual-opcion");
    if(opcionManual){
      opcionManual.addEventListener("click", ()=>{
        seleccionarMaterialManual(input.value.trim());
        lista.classList.remove("activa");
      });
    }
  });

  document.addEventListener("click",(e)=>{
    if(!input.contains(e.target) && !lista.contains(e.target)){
      lista.classList.remove("activa");
    }
  });
}

function abrirCajaItemRequerimiento(nombre, um, precio, codigo){
  document.getElementById("req-material-buscar").value = nombre;
  document.getElementById("req-material-seleccionado-caja").style.display = "block"; const infoCodigo = document.getElementById("req-item-codigo-info"); infoCodigo.innerHTML = codigo ? `Código: <span style="font-weight:700;color:var(--azul-600,#2563eb);">${esc(codigo)}</span>` : `<span style="opacity:.7;font-weight:400;font-style:italic;">Sin código de catálogo (material manual)</span>`;
  document.getElementById("req-item-especificaciones").value = nombre;
  document.getElementById("req-item-equipo").value = "";
  document.getElementById("req-material-cantidad").value = 1;
  document.getElementById("req-item-um").value = um || "UND";
  document.getElementById("req-item-precio").value = precio || 0;
  reqItemFotoBase64 = null;
  document.getElementById("req-item-foto-preview").innerHTML = "";
  document.getElementById("req-item-foto-input").value = "";
  actualizarPrecioTotalItem();
}

function seleccionarMaterialCatalogo(m){
  reqItemDraft = { codigo: m.codigo, nombre: m.nombre, deCatalogo: true };
  abrirCajaItemRequerimiento(m.nombre, m.um, m.precio, m.codigo);
  guardarBorradorRequerimiento();
}

function seleccionarMaterialManual(nombre){
  if(!nombre) return;
  reqItemDraft = { codigo: "", nombre: nombre, deCatalogo: false };
  abrirCajaItemRequerimiento(nombre, "UND", 0, "");
  guardarBorradorRequerimiento();
}

function actualizarPrecioTotalItem(){
  const cantidad = parseFloat(document.getElementById("req-material-cantidad").value) || 0;
  const precio = parseFloat(document.getElementById("req-item-precio").value) || 0;
  document.getElementById("req-item-precio-total").value = `S/ ${(cantidad*precio).toFixed(2)}`;
  guardarBorradorRequerimiento();
}

function iniciarFotoItemRequerimiento(){
  const input = document.getElementById("req-item-foto-input");
  if(!input) return;
  input.addEventListener("change", async ()=>{
    if(input.files && input.files[0]){
      reqItemFotoBase64 = await archivoABase64(input.files[0]);
      document.getElementById("req-item-foto-preview").innerHTML =
        `<div class="foto-thumb"><img src="${urlSegura(reqItemFotoBase64)}"><button class="quitar" onclick="quitarFotoItemRequerimiento()">×</button></div>`;
      guardarBorradorRequerimiento();
    }
  });
}

function quitarFotoItemRequerimiento(){
  reqItemFotoBase64 = null;
  document.getElementById("req-item-foto-preview").innerHTML = "";
  document.getElementById("req-item-foto-input").value = "";
  guardarBorradorRequerimiento();
}

function agregarMaterialALista(){
  if(!reqItemDraft) return;
  const cantidad = Math.max(1, parseFloat(document.getElementById("req-material-cantidad").value) || 1);
  const precio = Math.max(0, parseFloat(document.getElementById("req-item-precio").value) || 0);
  const um = document.getElementById("req-item-um").value.trim() || "UND";
  const especificaciones = document.getElementById("req-item-especificaciones").value.trim() || reqItemDraft.nombre;
  const equipoInput = document.getElementById("req-item-equipo");
  const equipoTexto = equipoInput.value.trim();
  const matchEquipo = equipoTexto.match(/^(\d{4,6})\s*-\s*(.+)$/);
  const equipoCodigo = equipoInput.dataset.codigoSel || (matchEquipo ? matchEquipo[1] : "");
  const equipo = matchEquipo ? matchEquipo[2] : equipoTexto;

  reqItems.push({
    codigo: reqItemDraft.codigo,
    nombre: reqItemDraft.nombre,
    especificaciones, equipo, equipoCodigo, cantidad, um, precio,
    foto: reqItemFotoBase64
  });

  reqItemDraft = null;
  reqItemFotoBase64 = null;
  document.getElementById("req-material-buscar").value = "";
  document.getElementById("req-material-seleccionado-caja").style.display = "none";
  document.getElementById("req-item-foto-preview").innerHTML = "";
  document.getElementById("req-item-foto-input").value = "";
  renderReqItems();
  guardarBorradorRequerimiento();
}

function quitarMaterialDeLista(idx){
  reqItems.splice(idx,1);
  renderReqItems();
  guardarBorradorRequerimiento();
}

function renderReqItems(){
  const cont = document.getElementById("req-items-lista");
  if(reqItems.length===0){
    cont.innerHTML = `<div class="subtexto">Aún no agregas materiales.</div>`;
  }else{
    cont.innerHTML = reqItems.map((it,i)=>`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--linea);">
        <div>
          <div style="font-weight:700;font-size:13.5px;">${i+1}. ${esc(it.nombre)}${it.codigo?` <span style="font-weight:400;color:var(--azul-600,#2563eb);">(Cód: ${esc(it.codigo)})</span>`:''}</div>
          <div class="subtexto" style="margin-top:2px;">${esc(it.cantidad)} ${esc(it.um)} x S/ ${it.precio.toFixed(2)}${it.equipo?` · ${esc(it.equipo)}`:''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <b>S/ ${(it.cantidad*it.precio).toFixed(2)}</b>
          <button type="button" onclick="quitarMaterialDeLista(${i})" style="background:none;border:none;color:var(--rojo-600);font-size:16px;cursor:pointer;padding:4px;">✕</button>
        </div>
      </div>
    `).join("");
  }
  const total = reqItems.reduce((s,it)=>s + it.cantidad*it.precio, 0);
  document.getElementById("req-total").textContent = `S/ ${total.toFixed(2)}`;
}

/* ============ BORRADOR DE REQUERIMIENTO (persistencia local) ============
   Guarda lo que el técnico va llenando (motivo, prioridad, comentarios y
   materiales agregados) para que no se pierda si sale de la app, cambia
   de pantalla o el navegador se recarga solo (por ejemplo al minimizar
   para ver WhatsApp o un video). Se limpia solo cuando el requerimiento
   se envía correctamente. */
function guardarBorradorRequerimiento(){
  try{
    const cajaVisible = document.getElementById("req-material-seleccionado-caja").style.display !== "none";
    let itemEnProgreso = null;
    if(cajaVisible && reqItemDraft){
      itemEnProgreso = {
        draft: reqItemDraft,
        buscar: document.getElementById("req-material-buscar").value,
        especificaciones: document.getElementById("req-item-especificaciones").value,
        equipo: document.getElementById("req-item-equipo").value,
        equipoCodigoSel: document.getElementById("req-item-equipo").dataset.codigoSel || "",
        cantidad: document.getElementById("req-material-cantidad").value,
        um: document.getElementById("req-item-um").value,
        precio: document.getElementById("req-item-precio").value,
        foto: reqItemFotoBase64
      };
    }
    const borrador = {
      motivo: document.getElementById("req-motivo").value,
      prioridad: document.getElementById("req-prioridad").value,
      comentarios: document.getElementById("req-comentarios").value,
      items: reqItems,
      itemEnProgreso
    };
    localStorage.setItem("req_borrador", JSON.stringify(borrador));
  }catch(e){ /* si falla el guardado local, no interrumpimos el llenado */ }
}

function cargarBorradorRequerimiento(){
  try{
    const raw = localStorage.getItem("req_borrador");
    if(!raw) return false;
    const borrador = JSON.parse(raw);
    if(!borrador) return false;
    reqItems = Array.isArray(borrador.items) ? borrador.items : [];
    document.getElementById("req-motivo").value = borrador.motivo || "";
    document.getElementById("req-prioridad").value = borrador.prioridad || "";
    document.getElementById("req-comentarios").value = borrador.comentarios || "";
    if(borrador.itemEnProgreso && borrador.itemEnProgreso.draft){
      const ip = borrador.itemEnProgreso;
      reqItemDraft = ip.draft;
      document.getElementById("req-material-buscar").value = ip.buscar || "";
      document.getElementById("req-material-seleccionado-caja").style.display = "block";
      const infoCodigo = document.getElementById("req-item-codigo-info");
      infoCodigo.innerHTML = ip.draft.codigo
        ? `Código: <span style="font-weight:700;color:var(--azul-600,#2563eb);">${esc(ip.draft.codigo)}</span>`
        : `<span style="opacity:.7;font-weight:400;font-style:italic;">Sin código de catálogo (material manual)</span>`;
      document.getElementById("req-item-especificaciones").value = ip.especificaciones || "";
      document.getElementById("req-item-equipo").value = ip.equipo || "";
      document.getElementById("req-item-equipo").dataset.codigoSel = ip.equipoCodigoSel || "";
      document.getElementById("req-material-cantidad").value = ip.cantidad || 1;
      document.getElementById("req-item-um").value = ip.um || "UND";
      document.getElementById("req-item-precio").value = ip.precio || 0;
      reqItemFotoBase64 = ip.foto || null;
      document.getElementById("req-item-foto-preview").innerHTML = reqItemFotoBase64
        ? `<div class="foto-thumb"><img src="${urlSegura(reqItemFotoBase64)}"><button class="quitar" onclick="quitarFotoItemRequerimiento()">×</button></div>`
        : "";
      actualizarPrecioTotalItem();
    }
    return true;
  }catch(e){ return false; }
}

function limpiarBorradorRequerimiento(){
  try{ localStorage.removeItem("req_borrador"); }catch(e){}
}

async function abrirFormRequerimiento(){
  asegurarMateriales().catch(e => mostrarToast(e.message, false)); // el buscador lo usa al escribir
  reqItemDraft = null;
  reqItemFotoBase64 = null;
  document.getElementById("req-material-buscar").value = "";
  document.getElementById("req-material-lista").innerHTML = "";
  document.getElementById("req-material-lista").classList.remove("activa");
  document.getElementById("req-material-seleccionado-caja").style.display = "none";
  const habiaBorrador = cargarBorradorRequerimiento();
  if(!habiaBorrador){
    reqItems = [];
    document.getElementById("req-motivo").value = "";
    document.getElementById("req-prioridad").value = "";
    document.getElementById("req-comentarios").value = "";
  }
  renderReqItems();
  irA("pantalla-form-requerimiento");
}

async function guardarRequerimiento(){
  const motivo = document.getElementById("req-motivo").value.trim();
  if(!motivo){
    mostrarToast("Escribe el motivo del requerimiento.", false);
    return;
  }
  const prioridad = document.getElementById("req-prioridad").value;
  if(!prioridad){
    mostrarToast("Selecciona si el requerimiento es Urgente o Convencional.", false);
    return;
  }
  if(reqItems.length===0){
    mostrarToast("Agrega al menos un material a la lista.", false);
    return;
  }
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const comentarios = document.getElementById("req-comentarios").value.trim();
  const total = reqItems.reduce((s,it)=>s + it.cantidad*it.precio, 0);
  const registro = {
    id: "REQ-" + Date.now(),
    tecnico: sesion.nombre || "",
    dni: sesion.dni || "",
    motivo,
    prioridad,
    items: [...reqItems],
    total,
    comentarios,
    creado: Date.now(),
    sincronizado: false
  };
  await guardarEnStore("requerimientos", registro);
  limpiarBorradorRequerimiento();
  mostrarToast("Requerimiento guardado" + (navigator.onLine ? "" : " (pendiente de sincronizar)"), true);
  irA("pantalla-menu");
}

/* ============ MIS REQUERIMIENTOS (historial propio del técnico) ============ */
async function abrirMisRequerimientos(){
  irA("pantalla-mis-requerimientos");
  const cont = document.getElementById("mis-req-lista");
  cont.innerHTML = `<div class="subtexto">Cargando...</div>`;
  const sesion = JSON.parse(localStorage.getItem("sesion_activa")||"{}");
  const resp = await llamarServidor({ tipo:"listado_requerimientos", dni: sesion.dni });
  if(!resp || !resp.ok){
    cont.innerHTML = `<div class="subtexto">${esc((resp && resp.mensaje) || "No se pudo cargar.")}</div>`;
    return;
  }
  const lista = resp.requerimientos || [];
  if(lista.length===0){
    cont.innerHTML = `<div class="vacio"><div class="subtexto">Aún no tienes requerimientos enviados.</div></div>`;
    return;
  }
  lista.sort((a,b)=> new Date(b.FECHA) - new Date(a.FECHA));
  cont.innerHTML = lista.map(r=>{
    const items = r.ITEMS || [];
    return `
    <div class="registro-item">
      <div class="fila1">
        <div>
          <div style="font-weight:700;font-size:14px;">${esc(r.CORRELATIVO || r.ID)} ${r.PRIORIDAD?`<span class="badge" style="background:${r.PRIORIDAD==='Urgente'?'var(--rojo-100,#fde2e2)':'var(--superficie)'};color:${r.PRIORIDAD==='Urgente'?'var(--rojo-texto,#c0392b)':'inherit'};margin-left:6px;">${esc(r.PRIORIDAD)}</span>`:''}</div>
          <div class="subtexto" style="margin-top:2px;">${esc(r.MOTIVO)}</div>
        </div>
        <span class="badge">${esc((r.FECHA||'').toString().slice(0,10))}</span>
      </div>
      <div class="desc">${items.length} material(es) · Total S/ ${(Number(r.TOTAL)||0).toFixed(2)}</div>
    </div>`;
  }).join("");
}

