/**
 * cotizacion.js — Módulo de Cotización para Cliente
 */

const Cotizacion = (() => {

  // Datos acumulados de la sesión de cotización
  let items = [];
  // Ventana que se está editando (aún no agregada) para la barra de metraje
  let actual = null;
  // Ids únicos aunque se agreguen dos ítems en el mismo milisegundo
  let nextId = Date.now();
  // Presupuesto guardado que se está editando ({ id, folio, cliente }) o null si es nuevo
  let presupuestoActual = null;
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
  function abrirModalPresupuesto(accion = 'imprimir') {
    const modal = document.getElementById('modal-cotizacion');
    if (!modal) return;

    modal._mode = 'save';
    const guardar = accion === 'guardar';
    
    // Cambiar botón del modal para imprimir o guardar el presupuesto
    const btnSubmit = modal.querySelector('.btn-cotizar');
    if (btnSubmit) {
      btnSubmit.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        ${guardar ? (presupuestoActual ? 'Guardar Cambios' : 'Guardar Presupuesto') : 'Generar e Imprimir'}
      `;
      btnSubmit.onclick = () => {
        if (guardar) {
          guardarPresupuesto();
        } else {
          cerrarModal();
          imprimir();
        }
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

  // ── Arma un ítem de cotización a partir de la configuración calculada ──
  function construirItem(cfg, totales, canvasDataUrl, extra = '', id = ++nextId) {
    const colorMap  = { 'BL': 'Blanco', 'B': 'Bronce', 'M': 'Mate', 'RO': 'Roble', 'T': 'Titanio' };
    const colorNom  = colorMap[cfg.coloalLabel || cfg.coloal] || cfg.coloal;
    const vidrioMap = {
      'VD4MM':'Vidrio 4mm Transparente','VD5INC':'Vidrio 5mm Incoloro','VD6MM':'Vidrio 6mm Transparente',
      'VD4REF':'Vidrio 4mm Reflectante','VD6REF':'Vidrio 6mm Reflectante',
      'ACRILICO':'Panel Acrílico','SV':'Sin Vidrio'
    };
    const vidrioNom = vidrioMap[cfg.vidi] || cfg.vidi;

    const anchoMm = cfg.anchoMm || Math.round(cfg.ancho * 1000);
    const altoMm  = cfg.altoMm  || Math.round(cfg.alto  * 1000);
    const neto    = Math.round(totales.neto);
    const iva     = Math.round(totales.iva);

    return {
      id,
      descripcion: cfg.rotu || 'Producto de Aluminio',
      detalle:     `${anchoMm} × ${altoMm} mm · ${colorNom} · ${vidrioNom}${extra ? ' · ' + extra : ''}`,
      extra,
      cantidad:    cfg.cant || 1,
      precio:      neto + iva,
      precioUnit:  Math.round((neto + iva) / (cfg.cant || 1)),
      neto,
      iva,
      imagen:      canvasDataUrl || null,
      cfg:         { ...cfg },
      totales:     { ...totales },
    };
  }

  // ── Reemplaza un ítem existente (edición desde el wizard), manteniendo su posición ──
  function reemplazarItem(id, cfg, totales, canvasDataUrl) {
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return null;
    items[idx] = construirItem(cfg, totales, canvasDataUrl, items[idx].extra || '', id);
    renderizarItems();
    mostrarPanel();
    return { item: items[idx], numero: idx + 1 };
  }

  // Carga un ítem en el wizard para modificar medidas, línea, color, cristal u opciones
  function editarArticulo(id) {
    const item = items.find(i => i.id === id);
    if (!item || typeof Wizard === 'undefined') return;
    Wizard.cargarItemParaEditar(item, items.indexOf(item) + 1);
    const panel = document.getElementById('panel-cotizacion');
    if (panel && !panel.classList.contains('collapsed')) togglePanel();
  }

  // ── Agrega el ítem directamente sin pasar por el modal de cliente ──
  function agregarItemDirecto(cfg, totales, canvasDataUrl) {
    const item = construirItem(cfg, totales, canvasDataUrl);

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
    const item = construirItem(cfg, totales, canvasDataUrl, descExtra);

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
    if (typeof Wizard !== 'undefined' && Wizard.getEditandoId() === id) Wizard.cancelarEdicion(true);
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

  // Edita cantidad o valor unitario neto de un ítem y recalcula neto, IVA y total
  function editarItem(id, campo, valor) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const cant = item.cantidad || 1;
    let unitNeto = Math.round(item.neto / cant);
    let cantidad = cant;

    const n = Math.round(parseFloat(valor));
    if (campo === 'cantidad') {
      if (!(n >= 1)) { App.toast('La cantidad debe ser 1 o más', 'error'); renderizarItems(); return; }
      cantidad = n;
    } else if (campo === 'unitNeto') {
      if (!(n >= 0)) { App.toast('Ingrese un valor válido', 'error'); renderizarItems(); return; }
      unitNeto = n;
    }

    const ivaPct     = item.cfg?.iva ?? 19;
    item.cantidad    = cantidad;
    item.neto        = unitNeto * cantidad;
    item.iva         = Math.round(item.neto * ivaPct / 100);
    item.precio      = item.neto + item.iva;
    item.precioUnit  = Math.round(item.precio / cantidad);
    renderizarItems();
  }

  function m2De(cfg, cantidad) {
    const anchoMm = cfg.anchoMm || Math.round((cfg.ancho || 0) * 1000);
    const altoMm  = cfg.altoMm  || Math.round((cfg.alto  || 0) * 1000);
    return (anchoMm / 1000) * (altoMm / 1000) * cantidad;
  }

  function mismaVentana(a, b) {
    return a.anchoMm === b.anchoMm && a.altoMm === b.altoMm &&
      a.tipo === b.tipo && a.subtipo === b.subtipo && a.cant === b.cant;
  }

  // Ventana en edición: se suma a la barra mientras no esté ya en la cotización.
  // Con reemplazaId (ítem cargado para editar) la barra muestra ese ítem ya modificado.
  function setActual(cfg, totales, reemplazaId = null) {
    actual = cfg && totales ? { cfg: { ...cfg }, totales: { ...totales }, reemplazaId } : null;
    actualizarBarra();
  }

  function actualizarBarra() {
    const base  = actual?.reemplazaId ? items.filter(i => i.id !== actual.reemplazaId) : items;
    let m2    = base.reduce((s, i) => s + m2De(i.cfg, i.cantidad), 0);
    let neto  = base.reduce((s, i) => s + i.neto, 0);
    let total = base.reduce((s, i) => s + i.precio, 0);
    // Aviso cuando la barra no coincide con el panel por la ventana del formulario
    let nota = '';
    if (actual && (actual.reemplazaId || !items.some(i => mismaVentana(i.cfg, actual.cfg)))) {
      const m2Actual   = m2De(actual.cfg, actual.cfg.cant || 1);
      const netoActual = actual.totales.neto || 0;
      m2    += m2Actual;
      neto  += netoActual;
      total += actual.totales.conIva || 0;
      if (actual.reemplazaId) {
        const n = items.findIndex(i => i.id === actual.reemplazaId) + 1;
        nota = `Incluye el ítem ${n} con los cambios aún sin actualizar`;
      } else {
        nota = `+ ventana en el formulario, aún no agregada: ${m2Actual.toFixed(2)} m² · ${fmtCLP(netoActual)} neto`;
      }
    }
    const notaEl = document.getElementById('bar-nota');
    if (notaEl) {
      notaEl.textContent = nota;
      notaEl.style.display = nota ? 'block' : 'none';
    }
    document.getElementById('bar-m2').textContent      = m2.toFixed(2) + ' m²';
    document.getElementById('bar-prom-m2').textContent = fmtCLP(m2 > 0 ? neto / m2 : 0);
    document.getElementById('bar-neto').textContent    = fmtCLP(neto);
    document.getElementById('bar-total').textContent   = fmtCLP(total);
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
        <td class="cot-td-num">
          <input type="number" class="cot-edit-input cot-edit-cant" min="1" step="1" value="${item.cantidad}"
            onchange="Cotizacion.editarItem(${item.id}, 'cantidad', this.value)" title="Editar cantidad" />
        </td>
        <td class="cot-td-money">
          <input type="number" class="cot-edit-input" min="0" step="1" value="${Math.round(item.neto / (item.cantidad || 1))}"
            onchange="Cotizacion.editarItem(${item.id}, 'unitNeto', this.value)" title="Editar valor unitario neto" />
        </td>
        <td class="cot-td-money" style="font-weight:700">${fmtCLP(item.precio)}</td>
        <td style="white-space:nowrap">
          <button class="cot-edit-btn" onclick="Cotizacion.editarArticulo(${item.id})" title="Editar medidas, línea, color y cristal">✏️</button>
          <button class="cot-del-btn" onclick="Cotizacion.eliminarItem(${item.id})" title="Eliminar">✕</button>
        </td>
      </tr>
    `).join('');

    // Totales
    document.getElementById('cot-subtotal').textContent = fmtCLP(totalNeto);
    document.getElementById('cot-iva').textContent      = fmtCLP(totalIva);
    document.getElementById('cot-total').textContent    = fmtCLP(totalFinal);

    actualizarBarra();
  }

  // ── Descripción comercial del ítem para el PDF ──
  const LINEA_NOM = {
    AL15: 'AL/15', AL20: 'AL/20', AL25: 'AL/25', L5000: 'L‑5000',
    AL32_ABATIR: 'AL/32', AL42_ABATIR: 'AL/42', AL32_PANO: 'AL/32', AL42_PANO: 'AL/42',
    AM12: 'AM-12', AM35_ABATIR: 'AM/35', AM35_VAIVEN: 'AM/35',
  };
  const CRISTAL_NOM = {
    VD4MM: 'cristal incoloro de 4.0 mm', VD5INC: 'cristal incoloro de 5.0 mm', VD6MM: 'cristal incoloro de 6.0 mm',
    VD4REF: 'cristal reflectante de 4.0 mm', VD6REF: 'cristal reflectante de 6.0 mm',
    ACRILICO: 'panel de acrílico', SV: 'sin cristal',
  };
  const COLOR_NOM = { BL: 'blanco', B: 'bronce', M: 'mate', RO: 'roble', T: 'titanio' };

  function descripcionComercial(item) {
    const c = item.cfg || {};
    const linea = LINEA_NOM[c.lin] || '';
    const color = COLOR_NOM[c.coloalLabel || c.coloal];
    const partes = [];

    if (c.tipo === 'ventana-corr') {
      partes.push(`Ventana corredera línea ${linea}`);
      const hojas = c.hoja == 2 && c.fija == 1 ? 'una hoja corredera y una fija'
        : ({ 2: 'dos hojas', 3: 'tres hojas', 4: 'cuatro hojas' })[c.hoja] || 'dos hojas';
      partes.push(hojas);
      if (color) partes.push(`color ${color}`);
      partes.push('pestillo metálico Open-lock');
      if (c.pal === 'S') partes.push('con palillo horizontal');
    } else if (c.tipo === 'ventana-doble') {
      const doble = (c.subtipo || '').endsWith('_D');
      partes.push(`${doble ? 'Ventana de abatir doble' : 'Ventana proyectante'} línea ${linea}`);
      if (color) partes.push(`color ${color}`);
    } else if (c.tipo === 'pano-fijo') {
      partes.push(linea ? `Paño fijo línea ${linea}` : 'Paño fijo en tubos de aluminio');
      if (color) partes.push(`color ${color}`);
    } else {
      partes.push(item.descripcion);
      if (color) partes.push(`color ${color}`);
    }

    if (c.vidi) partes.push(CRISTAL_NOM[c.vidi] || c.vidi);
    partes.push('instalado y sellado perimetral con silicona');
    if (item.extra) partes.push(item.extra);

    const anchoMm = c.anchoMm || Math.round((c.ancho || 0) * 1000);
    const altoMm  = c.altoMm  || Math.round((c.alto  || 0) * 1000);
    return `${partes.join(', ')}. <span style="white-space:nowrap">Medida: ${(anchoMm / 1000).toFixed(2)} x ${(altoMm / 1000).toFixed(2)}</span>`;
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
    const folio     = presupuestoActual?.folio || 'COT-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
    const logoUrl   = window.location.origin + '/logo.jpg';

    const totalNeto  = items.reduce((s, i) => s + i.neto, 0);
    const totalIva   = items.reduce((s, i) => s + i.iva, 0);
    const totalFinal = items.reduce((s, i) => s + i.precio, 0);
    // % IVA real de los ítems (si todos usan el mismo)
    const ivas = [...new Set(items.map(i => i.cfg?.iva ?? 19))];
    const ivaLabel = ivas.length === 1 ? `IVA (${ivas[0]}%)` : 'IVA';

    // Filas de la tabla principal (esquema + descripción en una sola tabla)
    const filasItems = items.map((item, idx) => `
      <tr style="break-inside:avoid">
        <td style="text-align:center;color:#64748b;font-size:11px">${idx + 1}</td>
        <td style="width:150px">
          ${item.imagen ? `<img src="${item.imagen}" style="width:140px;height:auto;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;display:block" />` : ''}
        </td>
        <td>
          <div style="font-size:11px;color:#0f172a;line-height:1.45">${descripcionComercial(item)}</div>
        </td>
        <td style="text-align:center">${item.cantidad}</td>
        <td style="text-align:right;font-family:'JetBrains Mono',monospace">${fmtCLP(Math.round(item.neto / (item.cantidad || 1)))}</td>
        <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:#0f172a">${fmtCLP(item.neto)}</td>
      </tr>
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
      <div class="hdr-logo"><img src="${logoUrl}" alt="Logo"/></div>
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
      <div class="row"><span class="lbl">Empresa:</span><span class="val">Pro Windows Limitada</span></div>
      <div class="row"><span class="lbl">Detalle:</span><span class="val">Aluminio & Cristales</span></div>
    </div>
  </div>

  <!-- TABLA DE ÍTEMS -->
  <div class="section-title">Detalle de Productos</div>
  <table class="items">
    <thead>
      <tr>
        <th class="c" style="width:36px">N°</th>
        <th style="width:150px">Esquema</th>
        <th>Descripción</th>
        <th class="c" style="width:50px">Cant.</th>
        <th class="r" style="width:95px">P. Unit Neto</th>
        <th class="r" style="width:100px">Total Neto</th>
      </tr>
    </thead>
    <tbody>${filasItems}</tbody>
  </table>

  <!-- TOTALES -->
  <div class="totales-wrap">
    <div class="totales-box">
      <div class="tot-row subtotal"><span class="tot-lbl">Subtotal (Neto)</span><span class="tot-val">${fmtCLP(totalNeto)}</span></div>
      <div class="tot-row iva"><span class="tot-lbl">${ivaLabel}</span><span class="tot-val">${fmtCLP(totalIva)}</span></div>
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
      <img src="${logoUrl}" alt="Logo"/>
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
    if (!pw) {
      App.toast('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes.', 'error');
      return;
    }
    pw.document.write(html);
    pw.document.close();
  }

  function limpiar() {
    if (typeof Wizard !== 'undefined') Wizard.cancelarEdicion(true);
    items = [];
    presupuestoActual = null;
    actualizarEtiquetaPresupuesto();
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

  // ── Presupuestos guardados (Redis en Vercel, archivo local en desarrollo) ──
  const CAMPOS_CLIENTE = {
    nombre: 'cot-cliente', rut: 'cot-rut', direccion: 'cot-direccion', telefono: 'cot-telefono',
    condicion: 'cot-condicion', plazo: 'cot-plazo', vigencia: 'cot-vigencia', notas: 'cot-notas',
  };

  function leerCliente() {
    const c = {};
    for (const [k, id] of Object.entries(CAMPOS_CLIENTE)) c[k] = document.getElementById(id)?.value || '';
    return c;
  }

  function ponerCliente(c = {}) {
    for (const [k, id] of Object.entries(CAMPOS_CLIENTE)) {
      const el = document.getElementById(id);
      if (el && c[k] !== undefined) el.value = c[k];
    }
  }

  function escapar(t) {
    return String(t ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  function actualizarEtiquetaPresupuesto() {
    const el = document.getElementById('cot-presup-label');
    if (!el) return;
    el.textContent = presupuestoActual
      ? `${presupuestoActual.folio}${presupuestoActual.cliente ? ' · ' + presupuestoActual.cliente : ''}`
      : '';
    el.style.display = presupuestoActual ? 'inline' : 'none';
  }

  function mostrarPanel() {
    const panel = document.getElementById('panel-cotizacion');
    if (panel) {
      panel.style.display = items.length ? 'block' : 'none';
      panel.classList.remove('collapsed');
    }
    const chevron = document.getElementById('cot-panel-chevron');
    if (chevron) chevron.textContent = '🔽';
    document.getElementById('cotizacion-count').textContent = items.length;
    if (typeof Wizard !== 'undefined') Wizard.actualizarBadgePaso3(items.length);
  }

  async function api(url, opciones = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opciones });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    return json;
  }

  // Abre el modal de datos del cliente para revisarlos antes de guardar
  function solicitarGuardar() {
    if (items.length === 0) {
      App.toast('Agregue al menos un ítem antes de guardar', 'error');
      return;
    }
    abrirModalPresupuesto('guardar');
  }

  async function guardarPresupuesto() {
    const cliente = leerCliente();
    if (!cliente.nombre.trim()) {
      App.toast('El nombre del cliente es obligatorio para guardar', 'error');
      document.getElementById('cot-cliente')?.focus();
      return;
    }
    const cuerpo = JSON.stringify({ cliente, items: items.map(({ imagen, ...resto }) => resto) });
    try {
      const r = presupuestoActual
        ? await api(`/api/presupuestos/${encodeURIComponent(presupuestoActual.id)}`, { method: 'PUT', body: cuerpo })
        : await api('/api/presupuestos', { method: 'POST', body: cuerpo });
      const nuevo = !presupuestoActual;
      presupuestoActual = { id: r.id, folio: r.folio, cliente: r.cliente };
      actualizarEtiquetaPresupuesto();
      cerrarModal();
      App.toast(`💾 Presupuesto ${r.folio} ${nuevo ? 'guardado' : 'actualizado'}`, 'success');
    } catch (e) {
      App.toast('No se pudo guardar: ' + e.message, 'error');
    }
  }

  let listaPresupuestos = [];

  async function abrirPresupuestos() {
    const modal = document.getElementById('modal-presupuestos');
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    const buscador = document.getElementById('presup-buscar');
    if (buscador) buscador.value = '';
    const cont = document.getElementById('presup-lista');
    cont.innerHTML = '<div class="presup-vacio">Cargando…</div>';
    try {
      listaPresupuestos = await api('/api/presupuestos');
      renderListaPresupuestos();
    } catch (e) {
      cont.innerHTML = `<div class="presup-vacio">No se pudo cargar la lista: ${escapar(e.message)}</div>`;
    }
  }

  function cerrarPresupuestos() {
    document.getElementById('modal-presupuestos')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderListaPresupuestos() {
    const cont = document.getElementById('presup-lista');
    if (!cont) return;
    const q = (document.getElementById('presup-buscar')?.value || '').trim().toLowerCase();
    const lista = listaPresupuestos.filter(p =>
      !q || (p.cliente || '').toLowerCase().includes(q) || (p.folio || '').toLowerCase().includes(q));
    if (lista.length === 0) {
      cont.innerHTML = `<div class="presup-vacio">${listaPresupuestos.length ? 'Sin resultados' : 'Aún no hay presupuestos guardados'}</div>`;
      return;
    }
    const fecha = iso => iso ? new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    cont.innerHTML = lista.map(p => `
      <div class="presup-row${presupuestoActual?.id === p.id ? ' activo' : ''}">
        <div class="presup-info">
          <div class="presup-folio">${escapar(p.folio)}</div>
          <div class="presup-cliente">${escapar(p.cliente) || '<em>Sin cliente</em>'}</div>
          <div class="presup-meta">${p.nItems} ítem${p.nItems === 1 ? '' : 's'} · ${fecha(p.actualizado)}</div>
        </div>
        <div class="presup-total">${fmtCLP(p.total)}</div>
        <div class="presup-acciones">
          <button class="cot-panel-btn" onclick="Cotizacion.cargarPresupuesto('${escapar(p.id)}')">Abrir</button>
          <button class="cot-del-btn" onclick="Cotizacion.eliminarPresupuesto('${escapar(p.id)}')" title="Eliminar">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  async function cargarPresupuesto(id) {
    if (items.length > 0 && presupuestoActual?.id !== id &&
        !confirm('Se reemplazará la cotización que está en pantalla. ¿Continuar?')) return;
    try {
      const p = await api(`/api/presupuestos/${encodeURIComponent(id)}`);
      if (typeof Wizard !== 'undefined') {
        Wizard.cancelarEdicion(true);
        Wizard.reiniciar(); // la ventana que quedó en el formulario no debe sumarse a este presupuesto
      }
      items = p.items.map(it => ({ ...it, id: ++nextId, imagen: CanvasDraw.imagenEsquema(it.cfg || {}) }));
      ponerCliente(p.cliente);
      presupuestoActual = { id: p.id, folio: p.folio, cliente: p.cliente?.nombre || '' };
      renderizarItems();
      mostrarPanel();
      actualizarEtiquetaPresupuesto();
      cerrarPresupuestos();
      App.toast(`📂 Presupuesto ${p.folio} abierto`, 'success');
    } catch (e) {
      App.toast('No se pudo abrir: ' + e.message, 'error');
    }
  }

  async function eliminarPresupuesto(id) {
    const p = listaPresupuestos.find(x => x.id === id);
    if (!confirm(`¿Eliminar el presupuesto ${p?.folio || ''}${p?.cliente ? ' de ' + p.cliente : ''}? Esta acción no se puede deshacer.`)) return;
    try {
      await api(`/api/presupuestos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      listaPresupuestos = listaPresupuestos.filter(x => x.id !== id);
      if (presupuestoActual?.id === id) {
        presupuestoActual = null;
        actualizarEtiquetaPresupuesto();
      }
      renderListaPresupuestos();
      App.toast('Presupuesto eliminado', 'warning');
    } catch (e) {
      App.toast('No se pudo eliminar: ' + e.message, 'error');
    }
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
    editarItem,
    editarArticulo,
    reemplazarItem,
    renderizarItems,
    setActual,
    solicitarAgregar,
    imprimir,
    limpiar,
    togglePanel,
    solicitarGuardar,
    guardarPresupuesto,
    abrirPresupuestos,
    cerrarPresupuestos,
    renderListaPresupuestos,
    cargarPresupuesto,
    eliminarPresupuesto,
    getItems: () => items,
  };
})();
