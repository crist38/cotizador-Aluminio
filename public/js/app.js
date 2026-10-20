/**
 * app.js — Controlador Principal + Módulo de Impresión/PDF
 */

const App = (() => {
  let toastTimer = null;

  function showSection(name) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById('nav-' + name);
    if (navBtn) navBtn.classList.add('active');

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById('section-' + name);
    if (sec) sec.classList.add('active');

    if (name === 'precios') Precios.cargar();
  }

  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ' + type;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    _updateThemeUI(isLight);
  }

  function _updateThemeUI(isLight) {
    const sun = document.getElementById('theme-sun');
    const moon = document.getElementById('theme-moon');
    const label = document.getElementById('theme-label');
    if (isLight) {
      if (sun) sun.style.display = 'inline-block';
      if (moon) moon.style.display = 'none';
      if (label) label.textContent = 'Oscuro';
    } else {
      if (sun) sun.style.display = 'none';
      if (moon) moon.style.display = 'inline-block';
      if (label) label.textContent = 'Claro';
    }
    // Redibuja canvas en tiempo real
    if (typeof CanvasDraw !== 'undefined') {
      // Usar el producto que se está editando, no el último calculado
      const actual = typeof Wizard !== 'undefined' ? Wizard.getCfg() : null;
      const cfg = (actual && actual.tipo) ? actual : (window._lastCfg || { tipo: 'ventana-corr' });
      CanvasDraw.drawPreview(cfg);
      const resCanvas = document.getElementById('resultado-canvas');
      if (resCanvas && document.getElementById('step-resultado').classList.contains('active')) {
        CanvasDraw.drawResult(cfg, { items: [], totales: window._lastTotales || { kilos:0, metros:0, aluminio:0, accesorios:0, cristal:0, neto:0, iva:19, conIva:0 }, cfg });
      }
    }
  }

  function init() {
    const savedTheme = localStorage.getItem('theme');
    const isLight = savedTheme === 'light';
    if (isLight) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    _updateThemeUI(isLight);

    showSection('cortes');
    console.log('%c✅ Sistema de Aluminio v2 iniciado', 'color:#00d4ff;font-weight:bold;font-size:14px');
  }

  return { showSection, toast, init, toggleTheme };
})();

// ── Módulo de Impresión y PDF ──
const Imprimir = (() => {

  function _buildPrintHTML(titulo, obra, fecha, chips, itemsHTML, footHTML) {
    const chipsHTML = chips.map(chip => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;text-align:center;min-width:120px">
        <div style="font-weight:700;font-size:14px;color:#0f172a;font-family:'JetBrains Mono',monospace">${chip.querySelector('.chip-val')?.textContent || ''}</div>
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-top:2px">${chip.querySelector('.chip-lbl')?.textContent || ''}</div>
      </div>`).join('');

    // Base URL del servidor para cargar el logo en la ventana de impresión
    const logoUrl = window.location.origin + '/logo.png';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Sistema de Pautas — ${titulo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: white; color: #1e293b; font-size: 12px; }
    .page { padding: 24px 28px; max-width: 900px; margin: 0 auto; }

    /* Header */
    .doc-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 3px solid #1a5c5a; margin-bottom: 18px; }
    .doc-brand { display: flex; align-items: center; gap: 14px; }
    .doc-brand img { height: 64px; width: auto; object-fit: contain; }
    .brand-text h1 { font-size: 16px; font-weight: 700; color: #0f172a; }
    .brand-text p  { font-size: 11px; color: #64748b; margin-top: 3px; }
    .brand-text .address { font-size: 10px; color: #94a3b8; margin-top: 2px; }
    .doc-meta { text-align: right; font-size: 11px; color: #64748b; }
    .doc-meta .fecha-val { font-size: 13px; font-weight: 600; color: #0f172a; }

    /* Subtítulo */
    .doc-subtitle { margin-bottom: 14px; }
    .doc-subtitle h2 { font-size: 17px; font-weight: 700; color: #1e293b; }
    .doc-subtitle .obra { font-size: 12px; color: #64748b; margin-top: 3px; }

    /* Chips */
    .chips-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }

    /* Tabla */
    .tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
    .tbl thead tr { background: #1a5c5a; color: white; }
    .tbl thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .tbl thead th.r { text-align: right; }
    .tbl tbody tr:nth-child(even) { background: #f8fafc; }
    .tbl tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    .tbl tbody td.r { text-align: right; font-family: 'JetBrains Mono', monospace; }
    .tbl tbody td code { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #0f766e; background: #ccfbf1; padding: 1px 5px; border-radius: 3px; }
    .tbl tfoot tr td { padding: 8px 10px; background: #f1f5f9; border-top: 2px solid #cbd5e1; font-weight: 600; }
    .tbl tfoot tr td.r { text-align: right; font-family: 'JetBrains Mono', monospace; }
    .tbl tfoot .total-neto td { background: #ccfbf1; color: #134e4a; font-size: 12px; font-weight: 700; }
    .tbl tfoot .total-iva  td { background: #dcfce7; color: #166534; font-size: 13px; font-weight: 700; }

    /* Footer del PDF */
    .doc-footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #1a5c5a; display: flex; justify-content: space-between; align-items: center; }
    .doc-footer-left { display: flex; align-items: center; gap: 10px; }
    .doc-footer-left img { height: 40px; width: auto; }
    .doc-footer-info .co { font-size: 11px; font-weight: 700; color: #0f172a; }
    .doc-footer-info .addr { font-size: 9px; color: #64748b; margin-top: 1px; }
    .doc-footer-right { text-align: right; font-size: 10px; color: #94a3b8; }
    .doc-footer-right strong { color: #64748b; }
    .dev-credit { font-size: 9px; color: #94a3b8; margin-top: 3px; }

    @media print {
      @page { margin: 12mm 14mm; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- ENCABEZADO -->
    <div class="doc-header">
      <div class="doc-brand">
        <div class="brand-text">
          <h1>Sistema Técnico de Pautas de Corte</h1>
          <p>Cálculo de Pautas de Corte de Aluminio & Cristales</p>
        </div>
      </div>
      <div class="doc-meta">
        <div>Fecha de emisión</div>
        <div class="fecha-val">${fecha}</div>
      </div>
    </div>

    <!-- TÍTULO Y OBRA -->
    <div class="doc-subtitle">
      <h2>${titulo}</h2>
      ${obra ? `<div class="obra">📋 Obra / Cliente: <strong>${obra}</strong></div>` : ''}
    </div>

    <!-- CHIPS RESUMEN -->
    <div class="chips-grid">${chipsHTML}</div>

    <!-- TABLA -->
    <table class="tbl">
      <thead>
        <tr>
          <th>Código</th>
          <th>Descripción</th>
          <th class="r">Alto (m)</th>
          <th class="r">Ancho (m)</th>
          <th class="r">Cantidad</th>
          <th class="r">Und.</th>
          <th class="r">Precio U.</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
      <tfoot>${footHTML}</tfoot>
    </table>

    <!-- PIE DE PÁGINA -->
    <div class="doc-footer">
      <div class="doc-footer-left">
        <div class="doc-footer-info">
          <div class="co">Sistema de Pautas de Corte</div>
        </div>
      </div>
      <div class="doc-footer-right">
        <div>Pauta generada el <strong>${fecha}</strong></div>
        <div class="dev-credit">Desarrollado por Cristian Pereira</div>
      </div>
    </div>

  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;
  }

  function _getItemsHTML() {
    const rows = document.querySelectorAll('#resultado-body tr');
    return Array.from(rows).map(tr => {
      const cells = tr.querySelectorAll('td');
      if (!cells.length) return '';
      return `<tr>
        <td><code>${cells[0]?.textContent || ''}</code></td>
        <td>${cells[1]?.textContent || ''}</td>
        <td class="r">${cells[2]?.textContent || ''}</td>
        <td class="r">${cells[3]?.textContent || ''}</td>
        <td class="r">${cells[4]?.textContent || ''}</td>
        <td class="r">${cells[5]?.textContent || ''}</td>
        <td class="r">${cells[6]?.textContent || ''}</td>
        <td class="r" style="font-weight:600">${cells[7]?.textContent || ''}</td>
      </tr>`;
    }).join('');
  }

  function _getFootHTML() {
    const rows = document.querySelectorAll('#resultado-foot tr');
    return Array.from(rows).map((tr, i) => {
      const cells = tr.querySelectorAll('td');
      const isNeto = cells[0]?.textContent?.includes('NETO');
      const isIva  = cells[0]?.textContent?.includes('CON IVA');
      const cls = isNeto ? ' class="total-neto"' : isIva ? ' class="total-iva"' : '';
      return `<tr${cls}>
        <td colspan="6">${cells[0]?.textContent || ''}</td>
        <td colspan="2" class="r">${cells[1]?.textContent || ''}</td>
      </tr>`;
    }).join('');
  }

  function imprimir() {
    const titulo = document.getElementById('resultado-title')?.textContent || 'Pauta de Corte';
    const obra   = document.getElementById('inp-obra')?.value || '';
    const fecha  = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const chips  = Array.from(document.querySelectorAll('#resultado-info .info-chip'));

    const html = _buildPrintHTML(titulo, obra, fecha, chips, _getItemsHTML(), _getFootHTML());
    const pw = window.open('', '_blank', 'width=960,height=720');
    if (!pw) {
      App.toast('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes.', 'error');
      return;
    }
    pw.document.write(html);
    pw.document.close();
  }

  function generarPDF() {
    // Abre la misma ventana de impresión optimizada — el usuario puede Guardar como PDF
    App.toast('Usa "Guardar como PDF" en el diálogo de impresión', 'success');
    imprimir();
  }

  return { imprimir, generarPDF };
})();

// ── Arrancar app ──
document.addEventListener('DOMContentLoaded', App.init);
