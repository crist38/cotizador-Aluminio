/**
 * cotizacion.js — Módulo de Cotización para Cliente
 */

const Cotizacion = (() => {

  // Datos acumulados de la sesión de cotización
  let items = [];
  let fmtCLP = v => new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0
  }).format(v);

  // ── Abre el modal de cotización con los datos del resultado actual ──
  function abrirModal(datosResultado) {
    const modal = document.getElementById('modal-cotizacion');
    if (!modal) return;

    const obra = document.getElementById('inp-obra')?.value || '';
    if (obra) document.getElementById('cot-cliente').value = obra;

    modal._pendingData = datosResultado;
    modal._mode = 'add';
    
    // Cambiar botón del modal para agregar ítem
    const btnSubmit = modal.querySelector('.btn-cotizar');
    if (btnSubmit) {
      btnSubmit.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M12 5v14M5 12h14"/></svg>
        Agregar a Cotización
      `;
      btnSubmit.onclick = () => agregarItem(modal._pendingData);
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // ── Abre el modal para configurar los datos del cliente antes de imprimir la cotización ──
  function abrirModalPresupuesto() {
    const modal = document.getElementById('modal-cotizacion');
    if (!modal) return;

    modal._mode = 'save';
    
    // Cambiar botón del modal para imprimir/guardar presupuesto
    const btnSubmit = modal.querySelector('.btn-cotizar');
    if (btnSubmit) {
      btnSubmit.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Generar e Imprimir
      `;
      btnSubmit.onclick = () => {
        cerrarModal();
        imprimir();
      };
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function cerrarModal() {
    const modal = document.getElementById('modal-cotizacion');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Agrega el ítem directamente sin pasar por el modal de cliente ──
  function agregarItemDirecto(cfg, totales, canvasDataUrl) {
    const colorMap  = { 'BL': 'Blanco', 'B': 'Bronce', 'M': 'Mate', 'RO': 'Roble', 'T': 'Titanio' };
    const colorNom  = colorMap[cfg.coloalLabel || cfg.coloal] || cfg.coloal;
    const vidrioMap = {
      'VD4MM':'Vidrio 4mm Transparente','VD6MM':'Vidrio 6mm Transparente',
      'VD4REF':'Vidrio 4mm Reflectante','VD6REF':'Vidrio 6mm Reflectante',
      'ACRILICO':'Panel Acrílico','SV':'Sin Vidrio'
    };
    const vidrioNom = vidrioMap[cfg.vidi] || cfg.vidi;

    const anchoMm = cfg.anchoMm || Math.round(cfg.ancho * 1000);
    const altoMm  = cfg.altoMm  || Math.round(cfg.alto  * 1000);

    const item = {
      id:          Date.now(),
      descripcion: cfg.rotu || 'Producto de Aluminio',
      detalle:     `${anchoMm} × ${altoMm} mm · ${colorNom} · ${vidrioNom}`,
      cantidad:    cfg.cant || 1,
      precio:      totales.conIva,
      precioUnit:  Math.round(totales.conIva / (cfg.cant || 1)),
      neto:        totales.neto,
      iva:         totales.iva,
      imagen:      canvasDataUrl || null,
      cfg:         { ...cfg },
      totales:     { ...totales },
    };

    items.push(item);
    renderizarItems();

    const panel = document.getElementById('panel-cotizacion');
    if (panel) {
      panel.style.display = 'block';
      panel.classList.remove('collapsed');
    }
    const chevron = document.getElementById('cot-panel-chevron');
    if (chevron) {
      chevron.textContent = '🔽';
    }

    document.getElementById('cotizacion-count').textContent = items.length;
    if (typeof Wizard !== 'undefined') Wizard.actualizarBadgePaso3(items.length);
    App.toast(`✅ "${item.descripcion}" agregado a la cotización`, 'success');
    return item;
  }

  // ── Agrega el ítem actual a la lista de cotización ──
  function agregarItem(datosResultado) {
    const { totales, cfg, canvasDataUrl } = datosResultado;

    const clienteVal = document.getElementById('cot-cliente')?.value.trim();
    if (!clienteVal) {
      App.toast('El nombre del cliente/empresa es obligatorio', 'error');
      document.getElementById('cot-cliente')?.focus();
      return;
    }

    // Leer descripción personalizada si fue escrita en el modal
    const descExtra = document.getElementById('cot-desc-extra')?.value || '';
    const colorMap  = { 'BL': 'Blanco', 'B': 'Bronce', 'M': 'Mate', 'RO': 'Roble', 'T': 'Titanio' };
    const colorNom  = colorMap[cfg.coloalLabel || cfg.coloal] || cfg.coloal;
    const vidrioMap = {
      'VD4MM':'Vidrio 4mm Transparente','VD6MM':'Vidrio 6mm Transparente',
      'VD4REF':'Vidrio 4mm Reflectante','VD6REF':'Vidrio 6mm Reflectante',
      'ACRILICO':'Panel Acrílico','SV':'Sin Vidrio'
    };
    const vidrioNom = vidrioMap[cfg.vidi] || cfg.vidi;

    const anchoMm = cfg.anchoMm || Math.round(cfg.ancho * 1000);
    const altoMm  = cfg.altoMm  || Math.round(cfg.alto  * 1000);

    const item = {
      id:          Date.now(),
      descripcion: cfg.rotu || 'Producto de Aluminio',
      detalle:     `${anchoMm} × ${altoMm} mm · ${colorNom} · ${vidrioNom}${descExtra ? ' · ' + descExtra : ''}`,
      cantidad:    cfg.cant || 1,
      precio:      totales.conIva,
      precioUnit:  Math.round(totales.conIva / (cfg.cant || 1)),
      neto:        totales.neto,
      iva:         totales.iva,
      imagen:      canvasDataUrl || null,
      cfg:         { ...cfg },
      totales:     { ...totales },
    };

    items.push(item);
    renderizarItems();
    document.getElementById('cot-desc-extra').value = '';
    App.toast(`✅ "${item.descripcion}" agregado a la cotización`, 'success');
    cerrarModal();

    const panel = document.getElementById('panel-cotizacion');
    if (panel) {
      panel.style.display = 'block';
      panel.classList.remove('collapsed');
    }
    const chevron = document.getElementById('cot-panel-chevron');
    if (chevron) {
      chevron.textContent = '🔽';
    }

    document.getElementById('cotizacion-count').textContent = items.length;
    if (typeof Wizard !== 'undefined') Wizard.actualizarBadgePaso3(items.length);
  }

  function eliminarItem(id) {
    items = items.filter(i => i.id !== id);
    renderizarItems();
    if (items.length === 0) {
      document.getElementById('panel-cotizacion').style.display = 'none';
      document.getElementById('cotizacion-count').textContent = '0';
    } else {
      document.getElementById('cotizacion-count').textContent = items.length;
    }
    if (typeof Wizard !== 'undefined') Wizard.actualizarBadgePaso3(items.length);
  }

  function renderizarItems() {
    const tbody = document.getElementById('cot-items-body');
    if (!tbody) return;

    const totalNeto  = items.reduce((s, i) => s + i.neto, 0);
    const totalIva   = items.reduce((s, i) => s + i.iva, 0);
    const totalFinal = items.reduce((s, i) => s + i.precio, 0);

    tbody.innerHTML = items.map((item, idx) => `
      <tr>
        <td class="cot-td-num">${idx + 1}</td>
        <td>
          <div class="cot-item-desc">${item.descripcion}</div>
          <div class="cot-item-det">${item.detalle}</div>
        </td>
        <td class="cot-td-num">${item.cantidad}</td>
        <td class="cot-td-money">${fmtCLP(item.precioUnit)}</td>
        <td class="cot-td-money" style="font-weight:700">${fmtCLP(item.precio)}</td>
        <td><button class="cot-del-btn" onclick="Cotizacion.eliminarItem(${item.id})" title="Eliminar">✕</button></td>
      </tr>
    `).join('');

    // Totales
    document.getElementById('cot-subtotal').textContent = fmtCLP(totalNeto);
    document.getElementById('cot-iva').textContent      = fmtCLP(totalIva);
    document.getElementById('cot-total').textContent    = fmtCLP(totalFinal);
  }

  // ── Genera el HTML de la cotización para imprimir ──
  function _htmlCotizacion() {
    const cliente   = document.getElementById('cot-cliente')?.value   || '';
    const direccion = document.getElementById('cot-direccion')?.value || '';
    const telefono  = document.getElementById('cot-telefono')?.value  || '';
    const rut       = document.getElementById('cot-rut')?.value       || '';
    const vigencia  = document.getElementById('cot-vigencia')?.value  || '15';
    const plazo     = document.getElementById('cot-plazo')?.value     || '15';
    const condicion = document.getElementById('cot-condicion')?.value || '50% anticipo, 50% contra entrega';
    const notas     = document.getElementById('cot-notas')?.value     || '';

    const fecha     = new Date().toLocaleDateString('es-CL', { day:'2-digit', month:'long', year:'numeric' });
    const folio     = 'COT-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
    const logoUrl   = window.location.origin + '/logo.png';

    const totalNeto  = items.reduce((s, i) => s + i.neto, 0);
    const totalIva   = items.reduce((s, i) => s + i.iva, 0);
    const totalFinal = items.reduce((s, i) => s + i.precio, 0);

    // Filas de la tabla principal
    const filasItems = items.map((item, idx) => `
      <tr>
        <td style="text-align:center;color:#64748b;font-size:11px">${idx + 1}</td>
        <td>
          <div style="font-weight:600;font-size:12px;color:#0f172a">${item.descripcion}</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px">${item.detalle}</div>
        </td>
        <td style="text-align:center">${item.cantidad}</td>
        <td style="text-align:right;font-family:'JetBrains Mono',monospace">${fmtCLP(item.precioUnit)}</td>
        <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:#0f172a">${fmtCLP(item.precio)}</td>
      </tr>
    `).join('');

    // Imágenes de los productos
    const imagenes = items.filter(i => i.imagen).map((item, idx) => `
      <div style="break-inside:avoid;margin-bottom:20px">
        <div style="font-size:11px;font-weight:600;color:#1a5c5a;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0">
          Ítem ${items.indexOf(item) + 1} — ${item.descripcion}
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          <img src="${item.imagen}" style="width:260px;height:auto;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc" />
          <div style="flex:1">
            <table style="width:100%;font-size:11px;border-collapse:collapse">
              <tr><td style="color:#64748b;padding:3px 0">Tipo:</td><td style="font-weight:600">${item.descripcion}</td></tr>
              <tr><td style="color:#64748b;padding:3px 0">Medida:</td><td style="font-weight:600">${item.cfg.anchoMm || Math.round(item.cfg.ancho*1000)} × ${item.cfg.altoMm || Math.round(item.cfg.alto*1000)} mm</td></tr>
              <tr><td style="color:#64748b;padding:3px 0">Detalle:</td><td style="font-weight:600">${item.detalle}</td></tr>
              <tr><td style="color:#64748b;padding:3px 0">Cantidad:</td><td style="font-weight:600">${item.cantidad} unid.</td></tr>
              <tr><td style="color:#64748b;padding:3px 0">P/Unit. c/IVA:</td><td style="font-weight:700;color:#1a5c5a">${fmtCLP(item.precioUnit)}</td></tr>
              <tr><td style="color:#64748b;padding:3px 0">Total c/IVA:</td><td style="font-weight:700;color:#1a5c5a;font-size:13px">${fmtCLP(item.precio)}</td></tr>
            </table>
          </div>
        </div>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Cotización ${folio}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',sans-serif; background:white; color:#1e293b; font-size:12px; line-height:1.5; }
  .page { padding:28px 32px; max-width:900px; margin:0 auto; }

  /* ── HEADER ── */
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:16px; border-bottom:3px solid #1a5c5a; margin-bottom:20px; }
  .hdr-logo img { height:72px; width:auto; }
  .hdr-empresa { margin-top:6px; }
  .hdr-empresa h1 { font-size:17px; font-weight:800; color:#0f172a; letter-spacing:-0.3px; }
  .hdr-empresa p { font-size:10px; color:#64748b; margin-top:2px; }
  .hdr-doc { text-align:right; }
  .hdr-doc .doc-type { font-size:22px; font-weight:800; color:#1a5c5a; letter-spacing:-0.5px; }
  .hdr-doc .doc-folio { font-size:13px; font-weight:600; color:#0f172a; margin-top:2px; }
  .hdr-doc .doc-fecha { font-size:11px; color:#64748b; }

  /* ── DATOS CLIENTE/EMPRESA ── */
  .datos-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
  .datos-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; }
  .datos-box h4 { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#1a5c5a; margin-bottom:8px; }
  .datos-box .row { display:flex; gap:6px; margin-bottom:4px; font-size:11px; }
  .datos-box .lbl { color:#94a3b8; min-width:70px; flex-shrink:0; }
  .datos-box .val { color:#0f172a; font-weight:600; }

  /* ── TABLA ÍTEMS ── */
  .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#1a5c5a; margin-bottom:8px; padding-bottom:4px; border-bottom:2px solid #1a5c5a; }
  table.items { width:100%; border-collapse:collapse; margin-bottom:16px; }
  table.items thead tr { background:#1a5c5a; color:white; }
  table.items thead th { padding:8px 10px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; text-align:left; }
  table.items thead th.r { text-align:right; }
  table.items thead th.c { text-align:center; }
  table.items tbody tr { border-bottom:1px solid #f1f5f9; }
  table.items tbody tr:nth-child(even) { background:#f8fafc; }
  table.items tbody td { padding:9px 10px; vertical-align:middle; font-size:11px; }
  table.items tbody td.r { text-align:right; font-family:'JetBrains Mono',monospace; }
  table.items tbody td.c { text-align:center; }

  /* ── TOTALES ── */
  .totales-wrap { display:flex; justify-content:flex-end; margin-bottom:24px; }
  .totales-box { min-width:280px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
  .tot-row { display:flex; justify-content:space-between; padding:8px 14px; font-size:12px; border-bottom:1px solid #f1f5f9; }
  .tot-row:last-child { border-bottom:none; }
  .tot-row.subtotal { background:#f8fafc; }
  .tot-row.iva { background:#f8fafc; }
  .tot-row.final { background:#1a5c5a; color:white; font-size:14px; font-weight:800; }
  .tot-lbl { color:inherit; }
  .tot-val { font-family:'JetBrains Mono',monospace; font-weight:700; }

  /* ── CONDICIONES ── */
  .condiciones { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px; }
  .cond-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px 12px; text-align:center; }
  .cond-box .icon { font-size:18px; margin-bottom:4px; }
  .cond-box .cond-tit { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#166534; margin-bottom:3px; }
  .cond-box .cond-val { font-size:11px; font-weight:600; color:#0f172a; }

  /* ── NOTAS ── */
  .notas-box { background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; margin-bottom:20px; font-size:11px; color:#92400e; }
  .notas-box strong { display:block; margin-bottom:3px; }

  /* ── IMÁGENES PRODUCTOS ── */
  .imgs-section { margin-bottom:24px; }

  /* ── FIRMA ── */
  .firma-grid { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0; }
  .firma-box { text-align:center; }
  .firma-line { border-top:1px solid #94a3b8; margin-top:40px; padding-top:6px; font-size:10px; color:#64748b; }

  /* ── FOOTER ── */
  .doc-foot { margin-top:24px; padding-top:12px; border-top:2px solid #1a5c5a; display:flex; justify-content:space-between; align-items:center; }
  .doc-foot-left { display:flex; align-items:center; gap:10px; }
  .doc-foot-left img { height:36px; }
  .doc-foot-info .co { font-size:11px; font-weight:700; color:#0f172a; }
  .doc-foot-info .addr { font-size:9px; color:#64748b; margin-top:1px; }
  .doc-foot-right { text-align:right; font-size:10px; color:#94a3b8; }
  .dev { font-size:9px; margin-top:2px; }

  @media print {
    @page { margin:12mm 14mm; size:letter; }
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
    .page { padding:0; }
    .no-break { break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- ENCABEZADO -->
  <div class="hdr">
    <div>
      <div class="hdr-empresa">
        <h1>Cotización de Pautas de Corte</h1>
        <p>Aluminio & Cristales</p>
      </div>
    </div>
    <div class="hdr-doc">
      <div class="doc-type">COTIZACIÓN</div>
      <div class="doc-folio">N° ${folio}</div>
      <div class="doc-fecha">Fecha: ${fecha}</div>
      <div class="doc-fecha" style="margin-top:3px">Vigencia: ${vigencia} días hábiles</div>
    </div>
  </div>

  <!-- DATOS CLIENTE Y EMPRESA -->
  <div class="datos-grid">
    <div class="datos-box">
      <h4>Datos del Cliente</h4>
      ${cliente   ? `<div class="row"><span class="lbl">Cliente:</span><span class="val">${cliente}</span></div>` : ''}
      ${rut       ? `<div class="row"><span class="lbl">RUT:</span><span class="val">${rut}</span></div>` : ''}
      ${direccion ? `<div class="row"><span class="lbl">Dirección:</span><span class="val">${direccion}</span></div>` : ''}
      ${telefono  ? `<div class="row"><span class="lbl">Teléfono:</span><span class="val">${telefono}</span></div>` : ''}
      ${!cliente && !rut && !direccion && !telefono ? '<div style="color:#94a3b8;font-size:11px">Sin datos del cliente</div>' : ''}
    </div>
    <div class="datos-box">
      <h4>Emisor</h4>
      <div class="row"><span class="lbl">Empresa:</span><span class="val">Cálculo de Pautas</span></div>
      <div class="row"><span class="lbl">Detalle:</span><span class="val">Aluminio & Cristales</span></div>
    </div>
  </div>

  <!-- TABLA DE ÍTEMS -->
  <div class="section-title">Detalle de Productos</div>
  <table class="items">
    <thead>
      <tr>
        <th class="c" style="width:36px">N°</th>
        <th>Descripción</th>
        <th class="c" style="width:60px">Cant.</th>
        <th class="r" style="width:120px">P. Unit c/IVA</th>
        <th class="r" style="width:130px">Total c/IVA</th>
      </tr>
    </thead>
    <tbody>${filasItems}</tbody>
  </table>

  <!-- TOTALES -->
  <div class="totales-wrap">
    <div class="totales-box">
      <div class="tot-row subtotal"><span class="tot-lbl">Subtotal (Neto)</span><span class="tot-val">${fmtCLP(totalNeto)}</span></div>
      <div class="tot-row iva"><span class="tot-lbl">IVA (19%)</span><span class="tot-val">${fmtCLP(totalIva)}</span></div>
      <div class="tot-row final"><span class="tot-lbl">TOTAL A PAGAR</span><span class="tot-val">${fmtCLP(totalFinal)}</span></div>
    </div>
  </div>

  <!-- CONDICIONES -->
  <div class="condiciones">
    <div class="cond-box">
      <div class="icon">💳</div>
      <div class="cond-tit">Forma de Pago</div>
      <div class="cond-val">${condicion}</div>
    </div>
    <div class="cond-box">
      <div class="icon">🏗️</div>
      <div class="cond-tit">Plazo de Entrega</div>
      <div class="cond-val">${plazo} días hábiles</div>
    </div>
    <div class="cond-box">
      <div class="icon">📅</div>
      <div class="cond-tit">Vigencia Cotización</div>
      <div class="cond-val">${vigencia} días hábiles</div>
    </div>
  </div>

  ${notas ? `
  <div class="notas-box">
    <strong>📝 Notas y Observaciones:</strong>
    ${notas}
  </div>` : ''}

  <!-- IMÁGENES DE PRODUCTOS -->
  ${imagenes ? `
  <div class="imgs-section">
    <div class="section-title" style="margin-bottom:12px">Esquemas de Productos</div>
    ${imagenes}
  </div>` : ''}

  <!-- FIRMAS -->
  <div class="firma-grid">
    <div class="firma-box">
      <div class="firma-line">Firma y Timbre Emisor</div>
    </div>
    <div class="firma-box">
      <div class="firma-line">Firma y Conformidad del Cliente</div>
    </div>
  </div>

  <!-- PIE DE PÁGINA -->
  <div class="doc-foot">
    <div class="doc-foot-left">
      <div class="doc-foot-info">
        <div class="co">Sistema de Pautas de Corte</div>
      </div>
    </div>
    <div class="doc-foot-right">
      <div>Cotización N° <strong>${folio}</strong> — ${fecha}</div>
      <div class="dev">Desarrollado por Cristian Pereira</div>
    </div>
  </div>

</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;
  }

  function imprimir() {
    if (items.length === 0) {
      App.toast('Agregue al menos un ítem a la cotización', 'error');
      return;
    }
    // Capturar canvas antes de imprimir
    items.forEach(item => {
      if (!item.imagen) {
        const c = document.getElementById('resultado-canvas');
        if (c) item.imagen = c.toDataURL('image/png');
      }
    });
    const html = _htmlCotizacion();
    const pw = window.open('', '_blank', 'width=980,height=780');
    pw.document.write(html);
    pw.document.close();
  }

  function limpiar() {
    items = [];
    renderizarItems();
    document.getElementById('panel-cotizacion').style.display = 'none';
    document.getElementById('cotizacion-count').textContent = '0';
    if (typeof Wizard !== 'undefined') Wizard.actualizarBadgePaso3(0);
    App.toast('Cotización limpiada', '');
  }

  // ── Llamado desde el paso de resultado ──
  function solicitarAgregar() {
    // Capturar imagen del canvas de resultado
    const canvas = document.getElementById('resultado-canvas');
    const canvasDataUrl = canvas ? canvas.toDataURL('image/png') : null;

    // Recoger datos del resultado actual
    const cfg = window._lastCfg || {};
    const totales = window._lastTotales || {};

    if (!totales.conIva) {
      App.toast('Calcule primero un producto antes de cotizar', 'error');
      return;
    }

    abrirModal({ cfg, totales, canvasDataUrl });
  }

  function togglePanel() {
    const panel = document.getElementById('panel-cotizacion');
    if (!panel) return;
    panel.classList.toggle('collapsed');
    const chevron = document.getElementById('cot-panel-chevron');
    if (chevron) {
      chevron.textContent = panel.classList.contains('collapsed') ? '🔼' : '🔽';
    }
  }

  return {
    abrirModal,
    abrirModalPresupuesto,
    cerrarModal,
    agregarItem,
    agregarItemDirecto,
    eliminarItem,
    renderizarItems,
    solicitarAgregar,
    imprimir,
    limpiar,
    togglePanel,
    getItems: () => items,
  };
})();
