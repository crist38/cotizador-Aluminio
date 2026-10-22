/**
 * canvas-draw.js — Visualización estilo CAD Técnico
 * Estética de plano técnico con colores de perfiles reales
 */

const CanvasDraw = (() => {
  let latestBox = null;

  // ── Paleta de colores por tipo de aluminio ──
  const PROFILE_COLORS = {
    'M':  { face: '#b0b8c8', edge: '#7a8494', shine: '#d8dde6', shadow: '#5a6270', label: 'Mate' },
    'B':  { face: '#2a2018', edge: '#0e0c08', shine: '#3e3020', shadow: '#0a0806', label: 'Bronce' },
    'BL': { face: '#d8dde6', edge: '#a0a8b4', shine: '#f0f3f7', shadow: '#7a8090', label: 'Blanco' },
    'RO': { face: '#8b5e3c', edge: '#5a3820', shine: '#b87840', shadow: '#3a2010', label: 'Roble' },
    'T':  { face: '#c8a96e', edge: '#8a7040', shine: '#e8cc90', shadow: '#7a5c28', label: 'Titanio' },
  };

  function getCADColors() {
    const isLight = document.body.classList.contains('light-theme');
    if (isLight) {
      return {
        bg:         '#f8fafc',
        grid:       'rgba(13, 148, 136, 0.12)',
        gridMinor:  'rgba(13, 148, 136, 0.04)',
        glass:      'rgba(5, 150, 105, 0.06)',
        glassEdge:  'rgba(5, 150, 105, 0.3)',
        dim:        '#0d9488',
        dimText:    '#0d9488',
        text:       '#334155',
        muted:      '#94a3b8',
        centerLine: 'rgba(13, 148, 136, 0.25)',
        label:      '#d97706',
        hatching:   'rgba(13, 148, 136, 0.08)',
      };
    } else {
      return {
        bg:         '#060913',
        grid:       'rgba(20, 184, 166, 0.15)',
        gridMinor:  'rgba(20, 184, 166, 0.06)',
        glass:      'rgba(52, 211, 153, 0.08)',
        glassEdge:  'rgba(52, 211, 153, 0.35)',
        dim:        '#14b8a6',
        dimText:    '#14b8a6',
        text:       '#cbd5e1',
        muted:      '#475569',
        centerLine: 'rgba(20, 184, 166, 0.3)',
        label:      '#f59e0b',
        hatching:   'rgba(20, 184, 166, 0.1)',
      };
    }
  }

  // ── Obtener color de perfil del selector actual ──
  function getProfileColor() {
    const checked = document.querySelector('input[name="color"]:checked');
    const key = checked ? checked.value : 'M';
    return PROFILE_COLORS[key] || PROFILE_COLORS['M'];
  }

  // ── Fondo CAD con grilla milimétrica ──
  function drawCADBackground(ctx, W, H) {
    const CAD = getCADColors();
    ctx.fillStyle = CAD.bg;
    ctx.fillRect(0, 0, W, H);

    // Grilla menor (5px)
    ctx.strokeStyle = CAD.gridMinor;
    ctx.lineWidth = 0.4;
    for (let x = 0; x < W; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 12) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Grilla mayor (60px)
    ctx.strokeStyle = CAD.grid;
    ctx.lineWidth = 0.7;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  // ── Sello técnico inferior ──
  function drawStamp(ctx, W, H, cfg, label) {
    const CAD = getCADColors();
    const ph = getProfileColor();
    ctx.fillStyle = 'rgba(13,17,23,0.85)';
    ctx.fillRect(0, H - 22, W, 22);
    ctx.strokeStyle = CAD.dim;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, H - 22); ctx.lineTo(W, H - 22); ctx.stroke();

    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.fillStyle = CAD.dim;
    ctx.textAlign = 'left';
    ctx.fillText('SISTEMA DE PAUTAS', 8, H - 8);

    ctx.fillStyle = CAD.label;
    ctx.textAlign = 'center';
    ctx.fillText((label || cfg.rotu || 'VISTA PREVIA').toUpperCase(), W / 2, H - 8);

    ctx.fillStyle = ph.face;
    ctx.textAlign = 'right';
    ctx.fillText(`COLOR: ${ph.label.toUpperCase()}`, W - 8, H - 8);
  }

  // ── Dibujar perfil de aluminio (rectángulo con acabado 3D) ──
  function drawProfile(ctx, x, y, w, h, ph, vertical = false) {
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 2, y + 2, w, h);

    // Cara principal
    const grad = vertical
      ? ctx.createLinearGradient(x, y, x + w, y)
      : ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0,   ph.shine);
    grad.addColorStop(0.3, ph.face);
    grad.addColorStop(0.7, ph.face);
    grad.addColorStop(1,   ph.shadow);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Borde oscuro
    ctx.strokeStyle = ph.edge;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, w, h);

    // Línea de brillo interior
    ctx.strokeStyle = ph.shine;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    if (vertical) {
      ctx.beginPath(); ctx.moveTo(x + 2, y + 1); ctx.lineTo(x + 2, y + h - 1); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x + 1, y + 2); ctx.lineTo(x + w - 1, y + 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── Línea de centro (chained) ──
  function drawCenterLine(ctx, x1, y1, x2, y2) {
    const CAD = getCADColors();
    ctx.save();
    ctx.strokeStyle = CAD.centerLine;
    ctx.lineWidth = 0.7;
    ctx.setLineDash([8, 3, 2, 3]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Acotado CAD ──
  function drawDimension(ctx, x1, y1, x2, y2, label, outside = false) {
    const CAD = getCADColors();
    ctx.save();
    ctx.strokeStyle = CAD.dim;
    ctx.fillStyle   = CAD.dimText;
    ctx.lineWidth   = 0.8;
    ctx.font = 'bold 10px "JetBrains Mono", monospace';

    const isHoriz = Math.abs(y1 - y2) < 2;
    const offset = 20;

    if (isHoriz) {
      const y = outside ? y1 - offset : y1 + offset;
      // Líneas de extensión
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x1, y);
      ctx.moveTo(x2, y2); ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Línea de cota
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      // Flechas
      _arrowH(ctx, x1, y, 1);
      _arrowH(ctx, x2, y, -1);
      // Texto con fondo
      const mx = (x1 + x2) / 2;
      const tw = ctx.measureText(label).width + 6;
      ctx.fillStyle = CAD.bg;
      ctx.fillRect(mx - tw / 2, y - 14, tw, 13);
      ctx.fillStyle = CAD.dimText;
      ctx.textAlign = 'center';
      ctx.fillText(label, mx, y - 4);
    } else {
      const x = outside ? x1 - offset - 10 : x1 + offset;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x, y1);
      ctx.moveTo(x2, y2); ctx.lineTo(x, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
      _arrowV(ctx, x, y1, 1);
      _arrowV(ctx, x, y2, -1);
      const my = (y1 + y2) / 2;
      ctx.save();
      ctx.translate(x - 4, my);
      ctx.rotate(-Math.PI / 2);
      const tw = ctx.measureText(label).width + 6;
      ctx.fillStyle = CAD.bg;
      ctx.fillRect(-tw / 2, -13, tw, 13);
      ctx.fillStyle = CAD.dimText;
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, -3);
      ctx.restore();
    }
    ctx.restore();
  }

  function _arrowH(ctx, x, y, dir) {
    const CAD = getCADColors();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 8, y - 3);
    ctx.lineTo(x + dir * 8, y + 3);
    ctx.closePath();
    ctx.fillStyle = CAD.dim;
    ctx.fill();
  }
  function _arrowV(ctx, x, y, dir) {
    const CAD = getCADColors();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + dir * 8);
    ctx.lineTo(x + 3, y + dir * 8);
    ctx.closePath();
    ctx.fillStyle = CAD.dim;
    ctx.fill();
  }

  // ── Vidrio con trama hatching ──
  function drawGlass(ctx, x, y, w, h) {
    const CAD = getCADColors();
    ctx.fillStyle = CAD.glass;
    ctx.fillRect(x, y, w, h);
    // Hatch diagonal
    ctx.save();
    ctx.strokeStyle = CAD.hatching;
    ctx.lineWidth = 0.5;
    ctx.clipRect ? null : ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let i = -h; i < w + h; i += 14) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.stroke();
    }
    ctx.restore();
    // Borde reflejo
    ctx.strokeStyle = CAD.glassEdge;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, y, w, h);
    // Destellos de reflejo
    const gr = ctx.createLinearGradient(x, y, x + w * 0.4, y + h * 0.4);
    gr.addColorStop(0, 'rgba(255,255,255,0.08)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
  }

  // ── Ventana Corredera ──
  function drawWindow(ctx, x, y, w, h, cfg) {
    const CAD = getCADColors();
    const ph   = getProfileColor();
    const hojas = cfg.hoja || 2;
    const fija  = cfg.fija || 0;
    const fw    = Math.max(8, w * 0.045); // grosor de marco proporcional

    // Marco exterior con perfil 3D
    drawProfile(ctx, x, y, w, fw, ph);                    // top
    drawProfile(ctx, x, y + h - fw, w, fw, ph);           // bottom
    drawProfile(ctx, x, y, fw, h, ph, true);              // left
    drawProfile(ctx, x + w - fw, y, fw, h, ph, true);     // right

    // Área de vidrio total
    drawGlass(ctx, x + fw, y + fw, w - fw * 2, h - fw * 2);

    // Líneas de centro
    drawCenterLine(ctx, x + w / 2, y + fw, x + w / 2, y + h - fw);
    drawCenterLine(ctx, x + fw, y + h / 2, x + w - fw, y + h / 2);

    // Divisores de hojas
    const panelW = (w - fw * 2) / hojas;
    for (let i = 0; i < hojas; i++) {
      const px     = x + fw + panelW * i;
      
      // Determinar si esta hoja específica es fija
      let isFija = false;
      if (fija > 0) {
        if (hojas === 3 && fija === 1) {
          isFija = (i === 1); // La del medio es fija
        } else if (hojas === 4 && fija === 2) {
          isFija = (i === 1 || i === 2); // Las dos del medio son fijas
        } else {
          isFija = (i >= hojas - fija); // Por defecto (las últimas)
        }
      }

      if (i > 0) {
        // Perfil divisor vertical entre hojas
        const divW = fw * 0.6;
        drawProfile(ctx, px - divW / 2, y + fw, divW, h - fw * 2, ph, true);
      }

      if (!isFija) {
        // Flecha deslizante (remarcada en color cota CAD y mayor espesor)
        let dir = 1;
        if (hojas === 3 && i === 2) {
          dir = -1; // En 3 hojas, la derecha desliza a la izquierda
        } else if (hojas === 4 && i === 3) {
          dir = -1; // En 4 hojas, la derecha desliza a la izquierda
        } else {
          dir = (i % 2 === 0) ? 1 : -1;
        }

        const arX  = px + (dir > 0 ? panelW * 0.25 : panelW * 0.75);
        const arY  = y + h / 2;
        ctx.save();
        ctx.strokeStyle = CAD.dim;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        // Cuerpo de la flecha (eje horizontal)
        ctx.moveTo(arX - dir * 6, arY);
        ctx.lineTo(arX + dir * 10, arY);
        // Punta de la flecha
        ctx.moveTo(arX + dir * 4, arY - 5);
        ctx.lineTo(arX + dir * 10, arY);
        ctx.lineTo(arX + dir * 4, arY + 5);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = CAD.muted;
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FIJA', px + panelW / 2, y + h / 2 + 3);
      }
    }

    // Perfiles palillo horizontal
    if (cfg.pal === 'S') {
      const py = y + h * 0.5;
      drawProfile(ctx, x + fw, py - fw * 0.3, w - fw * 2, fw * 0.6, ph);
    }
  }

  // ── Puerta Abatir / Vaivén ──
  function drawDoor(ctx, x, y, w, h, cfg) {
    const CAD = getCADColors();
    const ph     = getProfileColor();
    const isVaiv = cfg.lin && cfg.lin.includes('VAIVEN');
    const fw     = Math.max(8, w * 0.05);

    // "Nº Hojas" en puertas: 0 = 1 hoja, >0 = 2 hojas
    const nHojas = (parseInt(cfg.pave) || 0) > 0 ? 2 : 1;
    const pala   = (parseInt(cfg.pala) || 0) > 0;

    // Marco perimetral
    drawProfile(ctx, x, y, w, fw, ph);
    drawProfile(ctx, x, y + h - fw, w, fw, ph);
    drawProfile(ctx, x, y, fw, h, ph, true);
    drawProfile(ctx, x + w - fw, y, fw, h, ph, true);

    const hw    = fw * 0.75;              // perfil de hoja
    const gap   = nHojas === 2 ? 2 : 0;   // separación entre hojas
    const innerW = w - fw * 2;
    const leafW = (innerW - gap) / nHojas;
    const leafY = y + fw;
    const leafH = h - fw * 2;

    for (let i = 0; i < nHojas; i++) {
      const lx = x + fw + i * (leafW + gap);
      // Lado de la manilla: hacia el encuentro entre hojas (o derecha si es 1 hoja)
      const handleRight = nHojas === 1 || i === 0;

      drawGlass(ctx, lx + hw, leafY + hw, leafW - hw * 2, leafH - hw * 2);
      drawProfile(ctx, lx, leafY, leafW, hw, ph);
      drawProfile(ctx, lx, leafY + leafH - hw * 1.6, leafW, hw * 1.6, ph); // zócalo
      drawProfile(ctx, lx, leafY, hw, leafH, ph, true);
      drawProfile(ctx, lx + leafW - hw, leafY, hw, leafH, ph, true);

      if (pala) {
        drawProfile(ctx, lx + hw, leafY + leafH * 0.5 - hw * 0.4, leafW - hw * 2, hw * 0.8, ph);
      }

      // Tirador vertical largo
      ctx.save();
      const tw = Math.max(3, leafW * 0.035);
      const tx = handleRight ? lx + leafW - hw - tw - 5 : lx + hw + 5;
      ctx.fillStyle = ph.shine;
      ctx.strokeStyle = CAD.dim;
      ctx.lineWidth = 0.6;
      ctx.fillRect(tx, leafY + leafH * 0.3, tw, leafH * 0.32);
      ctx.strokeRect(tx, leafY + leafH * 0.3, tw, leafH * 0.32);

      if (isVaiv) {
        // Indicador de vaivén (abre hacia ambos lados)
        ctx.fillStyle = CAD.dim;
        ctx.font = `${Math.max(12, Math.min(22, leafW * 0.18))}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText('⇄', lx + leafW / 2, leafY + leafH / 2 + 7);
      } else {
        // Arco de apertura desde el lado de la bisagra
        const hingeX = handleRight ? lx + hw : lx + leafW - hw;
        const r = leafW - hw * 2;
        ctx.strokeStyle = CAD.dim;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        if (handleRight) ctx.arc(hingeX, leafY + leafH - hw, r, -Math.PI / 2, 0);
        else ctx.arc(hingeX, leafY + leafH - hw, r, Math.PI, Math.PI * 1.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    if (nHojas === 2) {
      drawCenterLine(ctx, x + w / 2, y + fw, x + w / 2, y + h - fw);
    }
  }

  // ── Shower Door ──
  function drawShower(ctx, x, y, w, h, cfg) {
    const CAD = getCADColors();
    const ph = getProfileColor();
    const fw = Math.max(8, w * 0.05);

    drawProfile(ctx, x, y, w, fw, ph);
    drawProfile(ctx, x, y + h - fw, w, fw, ph);
    drawProfile(ctx, x, y, fw, h, ph, true);
    drawProfile(ctx, x + w - fw, y, fw, h, ph, true);
    drawGlass(ctx, x + fw, y + fw, w - fw * 2, h - fw * 2);

    const half = (w - fw * 2) / 2;
    const dw   = fw * 0.55;
    drawProfile(ctx, x + fw + half - dw / 2, y + fw, dw, h - fw * 2, ph, true);

    ctx.fillStyle = 'rgba(150,200,255,0.5)';
    ctx.font = '18px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('🚿', x + w / 2, y + h / 2 + 8);
  }

  // ── Paño Fijo / Doble Contacto ──
  function drawPane(ctx, x, y, w, h, cfg) {
    const CAD = getCADColors();
    const ph   = getProfileColor();
    const pala = parseInt(cfg.pala) || 0;
    const pave = parseInt(cfg.pave) || 0;
    const fw   = Math.max(8, w * 0.045);

    drawProfile(ctx, x, y, w, fw, ph);
    drawProfile(ctx, x, y + h - fw, w, fw, ph);
    drawProfile(ctx, x, y, fw, h, ph, true);
    drawProfile(ctx, x + w - fw, y, fw, h, ph, true);
    drawGlass(ctx, x + fw, y + fw, w - fw * 2, h - fw * 2);

    drawCenterLine(ctx, x + w / 2, y + fw, x + w / 2, y + h - fw);
    drawCenterLine(ctx, x + fw, y + h / 2, x + w - fw, y + h / 2);

    const dw = fw * 0.5;
    if (pala > 0) {
      const ih = (h - fw * 2) / (pala + 1);
      for (let i = 1; i <= pala; i++) {
        const py = y + fw + ih * i;
        drawProfile(ctx, x + fw, py - dw / 2, w - fw * 2, dw, ph);
      }
    }
    if (pave > 0) {
      const iw = (w - fw * 2) / (pave + 1);
      for (let i = 1; i <= pave; i++) {
        const px = x + fw + iw * i;
        drawProfile(ctx, px - dw / 2, y + fw, dw, h - fw * 2, ph, true);
      }
    }

    // Etiqueta tipo en el centro del vidrio
    const lin = (cfg.lin || cfg.subtipo || 'FIJO').split('_')[0];
    ctx.fillStyle = 'rgba(0,212,255,0.5)';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(lin, x + w / 2, y + h / 2 + 3);
  }

  // ── Dibujar preview ──
  function drawPreview(cfg) {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    const anchoMm = parseFloat(document.getElementById('inp-ancho')?.value) || 1200;
    const altoMm  = parseFloat(document.getElementById('inp-alto')?.value)  || 1000;
    const { ox, oy, dw, dh } = latestBox = dibujarEsquema(canvas, cfg, anchoMm, altoMm);
    const W = canvas.width;
    const H = canvas.height;

    // Posicionar dinámicamente los inputs sobre las cotas (flechas de medida)
    const cadWidthInput = document.getElementById('cad-width-input');
    const cadHeightInput = document.getElementById('cad-height-input');

    if (cadWidthInput) {
      const wPct = ((ox + dw / 2) / W) * 100;
      const hPct = ((oy + dh + 20) / H) * 100;
      cadWidthInput.style.left = `${wPct}%`;
      cadWidthInput.style.top = `${hPct}%`;
      cadWidthInput.style.bottom = 'auto';
      cadWidthInput.style.transform = 'translate(-50%, -50%)';
    }

    if (cadHeightInput) {
      const wPct = ((ox + dw + 20) / W) * 100;
      const hPct = ((oy + dh / 2) / H) * 100;
      cadHeightInput.style.left = `${wPct}%`;
      cadHeightInput.style.top = `${hPct}%`;
      cadHeightInput.style.right = 'auto';
      cadHeightInput.style.transform = 'translate(-50%, -50%)';
    }
  }

  // ── Esquema de un ítem guardado como imagen (sin tocar el canvas del wizard) ──
  function imagenEsquema(cfg) {
    const canvas = document.createElement('canvas');
    const ref = document.getElementById('preview-canvas');
    canvas.width  = ref?.width  || 760;
    canvas.height = ref?.height || 420;
    const anchoMm = cfg.anchoMm || Math.round((cfg.ancho || 1.2) * 1000);
    const altoMm  = cfg.altoMm  || Math.round((cfg.alto  || 1.0) * 1000);
    dibujarEsquema(canvas, cfg, anchoMm, altoMm);
    return canvas.toDataURL('image/png');
  }

  function dibujarEsquema(canvas, cfg, anchoMm, altoMm) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const ancho   = anchoMm / 1000;
    const alto    = altoMm  / 1000;

    ctx.clearRect(0, 0, W, H);
    drawCADBackground(ctx, W, H);

    const marginTop  = 30;
    const marginBot  = 50;
    const marginSide = 55;
    const availW = W - marginSide * 2;
    const availH = H - marginTop - marginBot;
    const ratio  = Math.min(availW / ancho, availH / alto) * 0.82;
    const dw = ancho * ratio;
    const dh = alto  * ratio;
    const ox = (W - dw) / 2;
    const oy = marginTop + (availH - dh) / 2;

    const tipo = cfg.tipo;
    if      (tipo === 'ventana-corr')                       drawWindow(ctx, ox, oy, dw, dh, cfg);
    else if (tipo === 'shower')                             drawShower(ctx, ox, oy, dw, dh, cfg);
    else if (tipo === 'puerta')                             drawDoor(ctx, ox, oy, dw, dh, cfg);
    else if (tipo === 'pano-fijo' || tipo === 'ventana-doble') drawPane(ctx, ox, oy, dw, dh, cfg);
    else                                                    drawPane(ctx, ox, oy, dw, dh, cfg);

    drawDimension(ctx, ox, oy + dh, ox + dw, oy + dh, `${Math.round(anchoMm)} mm`, false);
    drawDimension(ctx, ox + dw, oy, ox + dw, oy + dh, `${Math.round(altoMm)} mm`, false);
    drawStamp(ctx, W, H, cfg, cfg.rotu);
    return { ox, oy, dw, dh, ratio, W, H, anchoMm, altoMm };
  }

  // ── Dibujar resultado ──
  function drawResult(cfg, resultado) {
    const CAD = getCADColors();
    const canvas = document.getElementById('resultado-canvas');
    if (!canvas) return;
    const wrap = document.getElementById('canvas-resultado-wrap');
    if (wrap) wrap.style.display = 'block';

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const ancho = cfg.ancho || 1;
    const alto  = cfg.alto  || 1;

    ctx.clearRect(0, 0, W, H);
    drawCADBackground(ctx, W, H);

    const marginTop  = 40;
    const marginBot  = 50;
    const marginSide = 70;
    const availW = W - marginSide * 2;
    const availH = H - marginTop - marginBot;
    const ratio  = Math.min(availW / ancho, availH / alto) * 0.75;
    const dw = ancho * ratio;
    const dh = alto  * ratio;
    const ox = (W - dw) / 2;
    const oy = marginTop + (availH - dh) / 2;

    const tipo = cfg.tipo;
    if      (tipo === 'ventana-corr')                          drawWindow(ctx, ox, oy, dw, dh, cfg);
    else if (tipo === 'shower')                                drawShower(ctx, ox, oy, dw, dh, cfg);
    else if (tipo === 'puerta')                                drawDoor(ctx, ox, oy, dw, dh, cfg);
    else                                                       drawPane(ctx, ox, oy, dw, dh, cfg);

    const anchoMm = cfg.anchoMm || (cfg.ancho * 1000);
    const altoMm  = cfg.altoMm  || (cfg.alto  * 1000);
    drawDimension(ctx, ox, oy + dh, ox + dw, oy + dh, `${Math.round(anchoMm)} mm`, false);
    drawDimension(ctx, ox + dw, oy, ox + dw, oy + dh, `${Math.round(altoMm)} mm`, false);

    // Título del plano
    ctx.fillStyle = CAD.dim;
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText((cfg.rotu || 'ESQUEMA').toUpperCase(), W / 2, 24);
    ctx.strokeStyle = CAD.dim;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 80, 28); ctx.lineTo(W / 2 + 80, 28);
    ctx.stroke();

    drawStamp(ctx, W, H, cfg, cfg.rotu);
  }

  return { drawPreview, drawResult, imagenEsquema, getLatestBox: () => latestBox };
})();
