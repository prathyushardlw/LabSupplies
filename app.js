(function () {
  'use strict';

  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  let pdfTemplateBytes = null;
  const signaturePads = {};

  // PDF page: 612 x 792 points (US Letter).
  // Coordinates extracted via pdfplumber. pdfplumber top → pdf-lib y = 792 - top.
  // All y values shifted 2mm down (5.7pt added to pdfplumber top).
  // Left QTY column center ≈ x 265 (header spans 248–301).
  // Right QTY column center ≈ x 530 (header spans 512–564).

  const LEFT_QTY_X = 265;
  const RIGHT_QTY_X = 530;

  // Each entry: { id: html input id, y: pdf-lib y coordinate }
  const LEFT_ITEMS = [
    { id: 'qty_urineCollectionKits', y: 792 - 162.3 },
    { id: 'qty_buccalSwabs',         y: 792 - 177.3 },
    { id: 'qty_nasopharyngealSwabs', y: 792 - 192.3 },
    { id: 'qty_woundCultureSwabs',   y: 792 - 207.3 },
    { id: 'qty_butterflyNeedles',    y: 792 - 238.9 },
    { id: 'qty_straightNeedles',     y: 792 - 253.9 },
    { id: 'qty_hubs',                y: 792 - 268.9 },
    { id: 'qty_gauze',               y: 792 - 283.9 },
    { id: 'qty_alcoholPrepPads',     y: 792 - 298.9 },
    { id: 'qty_bandaids',            y: 792 - 313.9 },
    { id: 'qty_coban',               y: 792 - 328.9 },
    { id: 'qty_sharpContainers',     y: 792 - 343.9 },
    { id: 'qty_tourniquets',         y: 792 - 358.9 },
    { id: 'qty_pipettes',            y: 792 - 397.3 },
    { id: 'qty_transferTubes',       y: 792 - 412.3 },
    { id: 'qty_lavenderTubes',       y: 792 - 427.3 },
    { id: 'qty_sstTubes',            y: 792 - 442.3 },
    { id: 'qty_lightBlueTubes',      y: 792 - 457.3 },
    { id: 'qty_lithiumHeparin',      y: 792 - 472.3 },
    { id: 'qty_urinalysisTubes',     y: 792 - 487.3 },
    { id: 'qty_fobtsKits',           y: 792 - 502.3 },
    { id: 'qty_hPyloriKits',         y: 792 - 517.3 },
    { id: 'qty_papSmearKits',        y: 792 - 532.3 },
    { id: 'qty_fedexBags',           y: 792 - 569.9 },
    { id: 'qty_upsBags',             y: 792 - 584.9 },
    { id: 'qty_kangarooMailers',     y: 792 - 599.9 },
    { id: 'qty_icePacks',            y: 792 - 614.9 },
    { id: 'qty_labelRolls',          y: 792 - 629.9 },
    { id: 'qty_glovesS',             y: 792 - 667.0 },
    { id: 'qty_glovesM',             y: 792 - 682.0 },
    { id: 'qty_glovesL',             y: 792 - 697.0 },
    { id: 'qty_glovesXL',            y: 792 - 712.0 },
    { id: 'qty_masks',               y: 792 - 727.0 },
    { id: 'qty_jackets',             y: 792 - 742.0 },
  ];

  const RIGHT_ITEMS = [
    { id: 'qty_allInOneReq',        y: 792 - 161.3 },
    { id: 'qty_toxUtiReq',          y: 792 - 177.0 },
    { id: 'qty_pgxReq',             y: 792 - 192.7 },
    { id: 'qty_bloodReq',           y: 792 - 208.4 },
    { id: 'qty_covidFluRppReq',     y: 792 - 224.1 },
    { id: 'qty_woundReq',           y: 792 - 239.8 },
    { id: 'qty_urineCups',          y: 792 - 271.1 },
    { id: 'qty_urineHats',          y: 792 - 286.6 },
    { id: 'qty_sampleBags',         y: 792 - 302.1 },
    { id: 'qty_royalBlueTubes',     y: 792 - 317.6 },
    { id: 'qty_metalFreeTubes',     y: 792 - 333.1 },
    { id: 'qty_redTopTubes',        y: 792 - 348.6 },
    { id: 'qty_amberTransferTubes', y: 792 - 364.1 },
    { id: 'qty_centrifuge',         y: 792 - 397.3 },
    { id: 'qty_idCard',             y: 792 - 412.8 },
    { id: 'qty_bloodCultureKits',   y: 792 - 442.4 },
    { id: 'qty_whiteTop',           y: 792 - 490.2 },
    { id: 'qty_orangeTop',          y: 792 - 505.7 },
    { id: 'qty_pinkGreyTop',        y: 792 - 521.2 },
  ];

  // Header fields (labels at x≈322, values after label end) — 2mm down
  const HEADER_FIELDS = {
    requestingClinic: { x: 392, y: 792 - 32.5,  size: 8 },
    clinicPhone:      { x: 352, y: 792 - 54.2,  size: 8 },
    contactName:      { x: 402, y: 792 - 76.7,  size: 8 },
    dateRequested:    { x: 387, y: 792 - 95.7,  size: 8 },
  };

  // Signature section (right column, bottom area) — 2mm down
  const SIG_FIELDS = {
    signerName: { x: 362, y: 792 - 598.9, size: 9 },
    signature:  { x: 375, y: 792 - 625.7,  w: 200, h: 30 },
  };

  // ─── SIGNATURE PAD ──────────────────────────────────────────────────────────

  function initSignaturePad(canvas) {
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let lastX = 0, lastY = 0;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a1a2e';
    }

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }

    function startDraw(e) {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    }

    function draw(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    }

    function stopDraw() {
      drawing = false;
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return {
      clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
      isEmpty() {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return false;
        }
        return true;
      },
      toDataURL() {
        return canvas.toDataURL('image/png');
      }
    };
  }

  // ─── FORM DATA COLLECTION ──────────────────────────────────────────────────

  function getFormData() {
    const val = id => (document.getElementById(id)?.value || '').trim();
    const numVal = id => {
      const v = val(id);
      return v && parseInt(v, 10) > 0 ? v : '';
    };

    function formatDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US');
    }

    const data = {
      requestingClinic: val('requestingClinic'),
      clinicPhone: val('clinicPhone'),
      contactName: val('contactName'),
      dateRequested: formatDate(val('dateRequested')),
      signerName: val('signerName'),
    };

    LEFT_ITEMS.forEach(item => { data[item.id] = numVal(item.id); });
    RIGHT_ITEMS.forEach(item => { data[item.id] = numVal(item.id); });

    return data;
  }

  // ─── PDF GENERATION ─────────────────────────────────────────────────────────

  async function generateFilledPDF() {
    if (!pdfTemplateBytes) {
      alert('Please upload the PDF template first.');
      return;
    }

    const data = getFormData();
    const pdfDoc = await PDFDocument.load(pdfTemplateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    if (pages.length < 1) return;

    const page = pages[0];
    const blueInk = rgb(0.0, 0.18, 0.65);

    function drawText(x, y, text, size) {
      if (!text) return;
      page.drawText(String(text), {
        x,
        y,
        size: size || 10,
        font,
        color: blueInk,
      });
    }

    // Header fields
    for (const [key, pos] of Object.entries(HEADER_FIELDS)) {
      drawText(pos.x, pos.y, data[key], pos.size);
    }

    // Left column quantities
    LEFT_ITEMS.forEach(item => {
      if (data[item.id]) {
        drawText(LEFT_QTY_X, item.y, data[item.id], 10);
      }
    });

    // Right column quantities
    RIGHT_ITEMS.forEach(item => {
      if (data[item.id]) {
        drawText(RIGHT_QTY_X, item.y, data[item.id], 10);
      }
    });

    // Signer name
    drawText(SIG_FIELDS.signerName.x, SIG_FIELDS.signerName.y, data.signerName, SIG_FIELDS.signerName.size);

    // Signature image
    const pad = signaturePads['sigPad1'];
    if (pad && !pad.isEmpty()) {
      try {
        const sigDataUrl = pad.toDataURL();
        const sigBytes = await fetch(sigDataUrl).then(r => r.arrayBuffer());
        const sigImage = await pdfDoc.embedPng(sigBytes);
        const s = SIG_FIELDS.signature;
        page.drawImage(sigImage, {
          x: s.x,
          y: s.y,
          width: s.w,
          height: s.h,
        });
      } catch (err) {
        console.warn('Could not embed signature:', err);
      }
    }

    const filledBytes = await pdfDoc.save();
    const clinicName = (data.requestingClinic || 'Unnamed').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
    downloadPDF(filledBytes, `Lab_Supplies_Order_${clinicName}.pdf`);
  }

  async function downloadPDF(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      // iPad/iPhone: try share sheet first (saves with correct filename)
      if (navigator.canShare) {
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: filename });
            return;
          } catch (e) {
            if (e.name === 'AbortError') return;
          }
        }
      }

      // iPad fallback: anchor download (Safari 13+)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Also open in new tab so user can "Save to Files" from there
      setTimeout(() => {
        const reader = new FileReader();
        reader.onload = function () {
          const newTab = window.open('', '_blank');
          if (newTab) {
            newTab.document.title = filename;
            newTab.document.write(
              '<html><head><title>' + filename + '</title></head>' +
              '<body style="margin:0"><embed width="100%" height="100%" src="' +
              reader.result + '" type="application/pdf"></body></html>'
            );
            newTab.document.close();
          }
        };
        reader.readAsDataURL(blob);
      }, 300);

      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }

    // Desktop browsers: standard anchor download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ─── INITIALIZATION ─────────────────────────────────────────────────────────

  async function autoLoadPDF() {
    const generateBtn = document.getElementById('btnGeneratePDF');

    try {
      const resp = await fetch('Lab Supplies order form (1).pdf');
      if (!resp.ok) throw new Error('PDF not found on server');
      pdfTemplateBytes = await resp.arrayBuffer();
      generateBtn.disabled = false;
    } catch (e) {
      console.warn('Auto-load failed:', e.message);
      alert('Could not load the PDF template. Place "Lab Supplies order form (1).pdf" in the LabSupplies folder and refresh.');
    }
  }

  function init() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateRequested').value = today;

    autoLoadPDF();

    const canvas = document.getElementById('sigPad1');
    if (canvas) {
      signaturePads['sigPad1'] = initSignaturePad(canvas);
    }

    document.querySelectorAll('.btn-clear-sig').forEach(btn => {
      btn.addEventListener('click', () => {
        const padId = btn.dataset.pad;
        if (signaturePads[padId]) signaturePads[padId].clear();
      });
    });

    const generateBtn = document.getElementById('btnGeneratePDF');
    generateBtn.addEventListener('click', async () => {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
      try {
        await generateFilledPDF();
      } catch (err) {
        console.error(err);
        alert('Error generating PDF: ' + err.message);
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Filled PDF';
      }
    });

    document.getElementById('labSuppliesForm').addEventListener('reset', () => {
      setTimeout(() => {
        Object.values(signaturePads).forEach(p => p.clear());
      }, 10);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
