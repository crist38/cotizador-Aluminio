/**
 * precios.js — Módulo de Gestión de Precios
 * Carga, muestra y guarda precios desde/hacia la API del servidor
 */

const Precios = (() => {
  let allData = [];
  let filteredData = [];
  let lineasData = null;

  // Líneas cotizables por m² (lin = cfg.lin usado en Calculos)
  const LINEAS_DEFAULT = [
    { lin: 'L5000',                 descripcion: 'Ventana Corredera L-5000' },
    { lin: 'AL15',                  descripcion: 'Ventana Corredera AL/15' },
    { lin: 'AL20',                  descripcion: 'Ventana Corredera AL/20' },
    { lin: 'AL25',                  descripcion: 'Ventana Corredera AL/25' },
    { lin: 'AL32_ABATIR',           descripcion: 'Proyectante / Abatir AL/32' },
    { lin: 'AL42_ABATIR',           descripcion: 'Proyectante / Abatir AL/42' },
    { lin: 'AL32_PANO',             descripcion: 'Paño Fijo AL/32' },
    { lin: 'AL42_PANO',             descripcion: 'Paño Fijo AL/42' },
    { lin: 'FIJO_TUBOS',            descripcion: 'Paño Fijo Tubos' },
    { lin: 'AM12',                  descripcion: 'Shower Doors AM-12' },
    { lin: 'AM35_ABATIR',           descripcion: 'Puerta Abatir AM/35' },
    { lin: 'AM35_VAIVEN',           descripcion: 'Puerta Vaivén AM/35' },
    { lin: 'PUERTA_ABATIR_TUBOS',   descripcion: 'Puerta Abatir Tubos 4040/4080' },
    { lin: 'PUERTA_VAIVEN_TUBULAR', descripcion: 'Puerta Vaivén Tubular 4080' },
    { lin: 'MARCO_5034',            descripcion: 'Marco Puerta 5034' },
    { lin: 'MARCO_7095',            descripcion: 'Marco Puerta 7095' },
    { lin: 'MARCO_3060',            descripcion: 'Marco Puerta 3060' },
    { lin: 'MARCO_2575',            descripcion: 'Marco Puerta 2575' },
    { lin: 'MARCO_2066',            descripcion: 'Marco Puerta 2066' },
  ];

  async function getData() {
    if (allData.length > 0) return allData;
    try {
      const res = await fetch('/api/precios');
      allData = await res.json();
      return allData;
    } catch (e) {
      console.error('Error cargando precios:', e);
      return [];
    }
  }

  async function getLineas() {
    if (lineasData) return lineasData;
    let guardadas = [];
    try {
      const res = await fetch('/api/lineas');
      guardadas = await res.json();
    } catch (e) {
      console.error('Error cargando valores m² por línea:', e);
    }
    lineasData = LINEAS_DEFAULT.map(l => {
      const g = guardadas.find(x => x.lin === l.lin);
      return { ...l, valorM2: g ? (parseFloat(g.valorM2) || 0) : 0 };
    });
    return lineasData;
  }

  // Valor m² configurado para una línea (0 = calcular por materiales)
  async function getValorM2(lin) {
    const lineas = await getLineas();
    return lineas.find(l => l.lin === lin)?.valorM2 || 0;
  }

  async function cargar() {
    allData = await getData();
    filteredData = [...allData];
    renderTabla(filteredData);
    renderLineas(await getLineas());
  }

  function renderLineas(data) {
    const tbody = document.getElementById('lineas-body');
    if (!tbody) return;
    tbody.innerHTML = data.map(l => `
      <tr>
        <td><code style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--accent)">${l.lin}</code></td>
        <td>${l.descripcion}</td>
        <td class="num">
          <input
            class="precio-input"
            type="number"
            value="${l.valorM2}"
            min="0"
            oninput="Precios.updateValorM2('${l.lin}', this.value)"
          />
        </td>
      </tr>
    `).join('');
  }

  function updateValorM2(lin, newVal) {
    const item = lineasData && lineasData.find(l => l.lin === lin);
    if (item) {
      item.valorM2 = parseFloat(newVal) || 0;
    }
  }

  function filtrar(query) {
    const q = query.toLowerCase();
    filteredData = allData.filter(p =>
      p.codigo.toLowerCase().includes(q) ||
      p.descripcion.toLowerCase().includes(q)
    );
    renderTabla(filteredData);
  }

  function renderTabla(data) {
    const tbody = document.getElementById('precios-body');
    if (!tbody) return;
    const fmt = v => new Intl.NumberFormat('es-CL').format(v);

    tbody.innerHTML = data.map((p, i) => `
      <tr>
        <td><code style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--accent)">${p.codigo}</code></td>
        <td>${p.descripcion}</td>
        <td class="num">
          <input
            class="precio-input"
            type="number"
            value="${p.precio}"
            min="0"
            data-codigo="${p.codigo}"
            oninput="Precios.updatePrice('${p.codigo}', this.value)"
          />
        </td>
        <td class="num">
          <span style="color:${p.medida === 'P' ? 'var(--accent)' : p.medida === 'A' ? 'var(--success)' : 'var(--text-muted)'}">
            ${p.medida === 'P' ? 'Metro lineal' : p.medida === 'A' ? 'Metro²' : 'Unidad'}
          </span>
        </td>
        <td class="num" style="color:var(--text-muted)">${p.peso ?? 1}</td>
      </tr>
    `).join('');
  }

  function updatePrice(codigo, newVal) {
    const item = allData.find(p => p.codigo === codigo);
    if (item) {
      item.precio = parseFloat(newVal) || 0;
    }
  }

  async function guardar() {
    try {
      const res = await fetch('/api/precios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allData),
      });
      const resLineas = await fetch('/api/lineas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify((lineasData || []).map(l => ({ lin: l.lin, valorM2: l.valorM2 }))),
      });
      if (res.ok && resLineas.ok) {
        App.toast('✅ Precios guardados correctamente', 'success');
      } else {
        const fallo = !res.ok ? res : resLineas;
        const detalle = await fallo.json().catch(() => ({}));
        console.error('Error al guardar:', fallo.url, fallo.status, detalle);
        App.toast(`Error al guardar precios${detalle.error ? ': ' + detalle.error : ''}`, 'error');
      }
    } catch (e) {
      App.toast('Error de conexión', 'error');
    }
  }

  function exportar() {
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'precios_aluminio.json';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Archivo JSON exportado', 'success');
  }

  return { getData, getLineas, getValorM2, cargar, filtrar, updatePrice, updateValorM2, guardar, exportar };
})();
