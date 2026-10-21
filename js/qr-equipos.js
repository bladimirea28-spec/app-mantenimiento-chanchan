/* ============ CÓDIGO QR DE CADA EQUIPO ============
   Cada unidad tiene un QR con el enlace de la app + su código
   (…/app-mantenimiento-chanchan/?equipo=04101). Al escanearlo con la cámara:
   - técnicos, admins y jefes de área ven la FICHA del equipo;
   - un operador entra directo a llenar el CHECKLIST de esa unidad.
   El admin imprime todas las etiquetas desde "Control de mantenimiento". */

const QR_LIBRERIA = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
function asegurarQR(){ return typeof qrcode !== "undefined" ? Promise.resolve() : cargarScript(QR_LIBRERIA); }

function enlaceEquipo(codigo){
  return new URL("./", location.href).href + "?equipo=" + encodeURIComponent(codigo);
}

/* Imagen (data URL) del QR de un texto. */
function imagenQr(texto, tamanoCelda){
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  return qr.createDataURL(tamanoCelda || 6, 2);
}

function descripcionEquipo(codigo){
  const m = typeof EQUIPOS_MTTO !== "undefined" ? EQUIPOS_MTTO.find(e => e.codigo === codigo) : null;
  if(m) return m.descripcion;
  const e = (typeof EQUIPOS !== "undefined" ? EQUIPOS : []).find(x => x.codigo === codigo);
  return e ? e.desc : "";
}

async function mostrarQrEquipo(codigo){
  try{ await asegurarQR(); }catch(e){ mostrarToast(e.message, false); return; }
  const url = enlaceEquipo(codigo);
  const img = imagenQr(url, 7);
  abrirModal(`
    <div class="modal-titulo"><span>Código QR · ${esc(codigo)}</span><button class="modal-cerrar" onclick="cerrarModal()">×</button></div>
    <div class="qr-caja">
      <img src="${img}" alt="QR del equipo ${esc(codigo)}">
      <b style="font-size:16px;">${esc(codigo)}</b>
      <div class="subtexto">${esc(descripcionEquipo(codigo))}</div>
      <div class="ficha-nota" style="text-align:left;">Pégalo en la unidad. Al escanearlo con la cámara del celular: los técnicos ven esta ficha y el operador entra directo a su checklist.</div>
    </div>
    <div class="ficha-acciones">
      <a class="btn btn-secundario mtto-btn" style="text-align:center;text-decoration:none;" href="${img}" download="QR-${esc(codigo)}.gif">⬇ Guardar imagen</a>
      <button class="btn btn-secundario mtto-btn" onclick="imprimirEtiquetasQr([${jsArg(codigo)}])">🖨 Imprimir etiqueta</button>
    </div>
    <button class="btn btn-primario" style="margin-top:12px;" onclick="abrirFichaEquipo(${jsArg(codigo)})">Volver a la ficha</button>
  `);
}

/* Unidades con etiqueta: las del control de mantenimiento y las de los checklists. */
function codigosConEtiqueta(){
  const codigos = (typeof EQUIPOS_MTTO !== "undefined" ? EQUIPOS_MTTO : []).map(e => e.codigo);
  (typeof CHECKLISTS !== "undefined" ? CHECKLISTS : []).forEach(p => equiposDePlantilla(p).forEach(e => codigos.push(e.codigo)));
  return [...new Set(codigos)].sort();
}

/* Abre una página con las etiquetas lista para imprimir (o guardar en PDF). */
async function imprimirEtiquetasQr(codigos){
  try{ await Promise.all([asegurarQR(), asegurarPlanesMtto()]); }catch(e){ mostrarToast(e.message, false); return; }
  const lista = codigos && codigos.length ? codigos : codigosConEtiqueta();
  const etiquetas = lista.map(c => `
    <div class="etq">
      <div class="emp">CHAN CHAN AMARYL · MANTENIMIENTO</div>
      <img src="${imagenQr(enlaceEquipo(c), 5)}" alt="">
      <div class="cod">${esc(c)}</div>
      <div class="des">${esc(descripcionEquipo(c))}</div>
      <div class="ayu">Escanea: ficha del equipo / checklist diario</div>
    </div>`).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Etiquetas QR · Mantenimiento</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;margin:12px;color:#1C2320;background:#fff;}
      .barra{display:flex;gap:10px;align-items:center;margin-bottom:12px;}
      .barra button{padding:10px 16px;font-size:15px;border:none;border-radius:10px;background:#1F4D2C;color:#fff;font-weight:700;}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}
      .etq{border:2px solid #1F4D2C;border-radius:10px;padding:10px;text-align:center;break-inside:avoid;page-break-inside:avoid;}
      .etq img{width:150px;height:150px;image-rendering:pixelated;}
      .emp{font-size:10px;font-weight:700;color:#1F4D2C;letter-spacing:.04em;}
      .cod{font-size:20px;font-weight:800;margin-top:2px;}
      .des{font-size:11px;min-height:28px;}
      .ayu{font-size:9.5px;color:#5B655F;margin-top:4px;}
      @media print{.barra{display:none;} body{margin:0;} .grid{grid-template-columns:repeat(3,1fr);}}
    </style></head><body>
    <div class="barra"><button onclick="window.print()">🖨 Imprimir / Guardar PDF</button><span>${lista.length} etiqueta(s)</span></div>
    <div class="grid">${etiquetas}</div></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type:"text/html" }));
  const ventana = window.open(url, "_blank");
  if(!ventana) mostrarToast("Permite las ventanas emergentes para ver las etiquetas.", false);
}

/* Si la app se abrió desde un QR (?equipo=…), lleva a la ficha o al checklist. */
async function abrirEquipoDelEnlace(usuario){
  const params = new URLSearchParams(location.search);
  const codigo = (params.get("equipo") || "").trim();
  if(!codigo) return;
  // Se usa una sola vez: así al recargar no vuelve a abrirse.
  history.replaceState(null, "", location.pathname);
  if(usuario.rol === "operador"){
    const plantilla = (typeof CHECKLISTS !== "undefined" ? CHECKLISTS : []).find(p => equiposDePlantilla(p).some(e => e.codigo === codigo));
    if(!plantilla){ mostrarToast("Este equipo no tiene checklist diario.", false); return; }
    abrirFormChecklist(plantilla.id);
    document.getElementById("chk-equipo").value = codigo;
    await cambioEquipoChecklist();
    mostrarToast("Checklist de " + codigo, true);
    return;
  }
  try{ await asegurarPlanesMtto(); }catch(e){ return; }
  if(!equipoMtto(codigo)){ mostrarToast("Equipo " + codigo + " sin plan de mantenimiento.", false); return; }
  await cargarControlMantenimiento();
  abrirFichaEquipo(codigo);
}
