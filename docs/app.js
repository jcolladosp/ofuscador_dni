// Variables globales
let anversoImage = null;
let reversoImage = null;
let croppedAnverso = null;
let croppedReverso = null;
let processedAnverso = null;
let processedReverso = null;

// Áreas de difuminado añadidas por el usuario, por cara
const customAreas = { anverso: [], reverso: [] };
let customAreaCount = 0;

// Ancho estándar para redimensionar (típico DNI escaneado)
const STANDARD_WIDTH = 850;

// Variables para el sistema de edición de áreas
let editingState = {
  anverso: {
    canvas: null,
    dragging: false,
    resizing: false,
    selectedArea: null,
    resizeHandle: null,
    startX: 0,
    startY: 0,
    scale: 1,
  },
  reverso: {
    canvas: null,
    dragging: false,
    resizing: false,
    selectedArea: null,
    resizeHandle: null,
    startX: 0,
    startY: 0,
    scale: 1,
  },
};

// Variables para el recorte
let cropState = {
  anverso: {
    canvas: null,
    ctx: null,
    image: null,
    selecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    cropRect: null,
  },
  reverso: {
    canvas: null,
    ctx: null,
    image: null,
    selecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    cropRect: null,
  },
};

// Inicialización
document.addEventListener('DOMContentLoaded', function () {
  setupFileUpload('fileAnverso', 'uploadAnverso', handleAnversoUpload);
  setupFileUpload('fileReverso', 'uploadReverso', handleReversoUpload);
});

function setupFileUpload(inputId, zoneId, handler) {
  const input = document.getElementById(inputId);
  const zone = document.getElementById(zoneId);

  input.addEventListener('change', handler);

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('active');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('active');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('active');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      input.files = files;
      handler();
    }
  });
}

function handleAnversoUpload() {
  const file = document.getElementById('fileAnverso').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        anversoImage = img;
        markZoneLoaded('uploadAnverso', 'Anverso cargado');
        checkBothUploaded();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function handleReversoUpload() {
  const file = document.getElementById('fileReverso').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        reversoImage = img;
        markZoneLoaded('uploadReverso', 'Reverso cargado');
        checkBothUploaded();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function markZoneLoaded(zoneId, title) {
  const zone = document.getElementById(zoneId);
  zone.classList.add('is-loaded');
  zone.innerHTML =
    '<span class="upload-check" aria-hidden="true">✓</span>' +
    '<span class="upload-title"></span>' +
    '<span class="upload-hint">Pulsa para elegir otra imagen</span>';
  zone.querySelector('.upload-title').textContent = title;
}

function checkBothUploaded() {
  if (anversoImage && reversoImage) {
    updateStep(1, 'completed');
    updateStep(2, 'active');
    document.getElementById('line1').classList.add('completed');
    showCropAnversoSection();
  }
}

function showCropAnversoSection() {
  document.getElementById('cropAnversoSection').classList.remove('hidden');
  initCropCanvas('anverso', anversoImage);
  document
    .getElementById('cropAnversoSection')
    .scrollIntoView({ behavior: 'smooth' });
}

function initCropCanvas(side, image) {
  const canvas = document.getElementById(
    side === 'anverso' ? 'cropCanvasAnverso' : 'cropCanvasReverso',
  );
  const ctx = canvas.getContext('2d');

  // Ajustar tamaño del canvas
  const maxWidth = 800;
  const scale = Math.min(1, maxWidth / image.width);
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;

  cropState[side].canvas = canvas;
  cropState[side].ctx = ctx;
  cropState[side].image = image;
  cropState[side].scale = scale;
  cropState[side].cropRect = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  };

  drawCropCanvas(side);
  setupCropEvents(side);
}

function drawCropCanvas(side) {
  const state = cropState[side];
  const ctx = state.ctx;
  const canvas = state.canvas;

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dibujar imagen
  ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);

  // Dibujar overlay oscuro
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Si hay selección, mostrar área clara
  if (state.cropRect) {
    const rect = state.cropRect;
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    ctx.drawImage(
      state.image,
      rect.x / state.scale,
      rect.y / state.scale,
      rect.width / state.scale,
      rect.height / state.scale,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );

    // Dibujar borde de selección
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Dibujar esquinas
    const cornerSize = 10;
    ctx.fillStyle = '#667eea';
    ctx.fillRect(
      rect.x - cornerSize / 2,
      rect.y - cornerSize / 2,
      cornerSize,
      cornerSize,
    );
    ctx.fillRect(
      rect.x + rect.width - cornerSize / 2,
      rect.y - cornerSize / 2,
      cornerSize,
      cornerSize,
    );
    ctx.fillRect(
      rect.x - cornerSize / 2,
      rect.y + rect.height - cornerSize / 2,
      cornerSize,
      cornerSize,
    );
    ctx.fillRect(
      rect.x + rect.width - cornerSize / 2,
      rect.y + rect.height - cornerSize / 2,
      cornerSize,
      cornerSize,
    );
  }
}

function setupCropEvents(side) {
  const canvas = cropState[side].canvas;
  const state = cropState[side];

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.startX = e.clientX - rect.left;
    state.startY = e.clientY - rect.top;
    state.selecting = true;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!state.selecting) return;

    const rect = canvas.getBoundingClientRect();
    state.currentX = e.clientX - rect.left;
    state.currentY = e.clientY - rect.top;

    const x = Math.min(state.startX, state.currentX);
    const y = Math.min(state.startY, state.currentY);
    const width = Math.abs(state.currentX - state.startX);
    const height = Math.abs(state.currentY - state.startY);

    state.cropRect = { x, y, width, height };
    drawCropCanvas(side);
  });

  canvas.addEventListener('mouseup', () => {
    state.selecting = false;
  });

  // Touch events para móvil
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    state.startX = touch.clientX - rect.left;
    state.startY = touch.clientY - rect.top;
    state.selecting = true;
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!state.selecting) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    state.currentX = touch.clientX - rect.left;
    state.currentY = touch.clientY - rect.top;

    const x = Math.min(state.startX, state.currentX);
    const y = Math.min(state.startY, state.currentY);
    const width = Math.abs(state.currentX - state.startX);
    const height = Math.abs(state.currentY - state.startY);

    state.cropRect = { x, y, width, height };
    drawCropCanvas(side);
  });

  canvas.addEventListener('touchend', () => {
    state.selecting = false;
  });
}

function resetCropAnverso() {
  initCropCanvas('anverso', anversoImage);
}

function resetCropReverso() {
  initCropCanvas('reverso', reversoImage);
}

async function skipCropAnverso() {
  croppedAnverso = await resizeToStandard(anversoImage);
  proceedToReverso();
}

function applyCropAnverso() {
  const state = cropState.anverso;
  if (
    !state.cropRect ||
    state.cropRect.width < 10 ||
    state.cropRect.height < 10
  ) {
    alert('Por favor selecciona un área válida para recortar');
    return;
  }

  // Crear canvas temporal para el recorte
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  const rect = state.cropRect;
  tempCanvas.width = rect.width / state.scale;
  tempCanvas.height = rect.height / state.scale;

  tempCtx.drawImage(
    state.image,
    rect.x / state.scale,
    rect.y / state.scale,
    tempCanvas.width,
    tempCanvas.height,
    0,
    0,
    tempCanvas.width,
    tempCanvas.height,
  );

  // Convertir a imagen y redimensionar
  const img = new Image();
  img.onload = async function () {
    croppedAnverso = await resizeToStandard(img);
    proceedToReverso();
  };
  img.src = tempCanvas.toDataURL();
}

function proceedToReverso() {
  document.getElementById('cropAnversoSection').classList.add('hidden');
  updateStep(2, 'completed');
  updateStep(3, 'active');
  document.getElementById('line2').classList.add('completed');
  document.getElementById('cropReversoSection').classList.remove('hidden');
  initCropCanvas('reverso', reversoImage);
  document
    .getElementById('cropReversoSection')
    .scrollIntoView({ behavior: 'smooth' });
}

async function skipCropReverso() {
  croppedReverso = await resizeToStandard(reversoImage);
  proceedToProcess();
}

function applyCropReverso() {
  const state = cropState.reverso;
  if (
    !state.cropRect ||
    state.cropRect.width < 10 ||
    state.cropRect.height < 10
  ) {
    alert('Por favor selecciona un área válida para recortar');
    return;
  }

  // Crear canvas temporal para el recorte
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  const rect = state.cropRect;
  tempCanvas.width = rect.width / state.scale;
  tempCanvas.height = rect.height / state.scale;

  tempCtx.drawImage(
    state.image,
    rect.x / state.scale,
    rect.y / state.scale,
    tempCanvas.width,
    tempCanvas.height,
    0,
    0,
    tempCanvas.width,
    tempCanvas.height,
  );

  // Convertir a imagen y redimensionar
  const img = new Image();
  img.onload = async function () {
    croppedReverso = await resizeToStandard(img);
    proceedToProcess();
  };
  img.src = tempCanvas.toDataURL();
}

function resizeToStandard(image) {
  // Redimensionar imagen a ancho estándar manteniendo proporción
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Obtener ancho estándar del input o usar valor por defecto
  const standardWidth =
    parseInt(document.getElementById('standardWidth')?.value) || STANDARD_WIDTH;

  const scale = standardWidth / image.width;
  canvas.width = standardWidth;
  canvas.height = image.height * scale;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Espera a que la imagen esté decodificada: dibujarla antes deja el canvas en blanco
  return new Promise((resolve, reject) => {
    const resizedImg = new Image();
    resizedImg.onload = () => resolve(resizedImg);
    resizedImg.onerror = reject;
    resizedImg.src = canvas.toDataURL();
  });
}

function proceedToProcess() {
  document.getElementById('cropReversoSection').classList.add('hidden');
  updateStep(3, 'completed');
  updateStep(4, 'active');
  document.getElementById('line3').classList.add('completed');
  document.getElementById('processSection').classList.remove('hidden');

  // Inicializar previsualizaciones
  setupPreviewListeners();
  updatePreviews();

  document
    .getElementById('processSection')
    .scrollIntoView({ behavior: 'smooth' });
}

function setupPreviewListeners() {
  // Lista de todos los controles que afectan la previsualización
  const controls = [
    'overlayText',
    'fontSize',
    'textColor',
    'addWatermark',
    'blurFoto',
    'fotoX',
    'fotoY',
    'fotoWidth',
    'fotoHeight',
    'blurFirma',
    'firmaX',
    'firmaY',
    'firmaWidth',
    'firmaHeight',
    'blurEquipo',
    'equipoX',
    'equipoY',
    'equipoWidth',
    'equipoHeight',
    'blurIntensity',
  ];

  attachPreviewListeners(controls);
}

// Debounce para evitar demasiadas actualizaciones
let previewTimeoutId;
function debouncedUpdatePreviews() {
  clearTimeout(previewTimeoutId);
  previewTimeoutId = setTimeout(() => updatePreviews(), 300);
}

function attachPreviewListeners(ids) {
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;

    if (element.type === 'checkbox') {
      element.addEventListener('change', updatePreviews);
    } else {
      element.addEventListener('input', debouncedUpdatePreviews);
    }
  });
}

function toggleAreaDisplay() {
  document
    .getElementById('showAreasLabel')
    .classList.toggle(
      'active',
      document.getElementById('showBlurAreas').checked,
    );

  updatePreviews();
}

function toggleGrayscaleDisplay() {
  document
    .getElementById('grayscaleLabel')
    .classList.toggle(
      'active',
      document.getElementById('grayscaleMode').checked,
    );

  updatePreviews();
}

function addCustomArea(side) {
  customAreaCount++;
  const key = 'custom' + customAreaCount;
  const area = {
    key,
    label: 'Área ' + customAreaCount,
    checkboxId: 'blur' + key,
    xId: key + 'X',
    yId: key + 'Y',
    widthId: key + 'Width',
    heightId: key + 'Height',
    color: 'orange',
  };
  customAreas[side].push(area);

  const fields = [
    { id: area.xId, label: 'X (%)', value: 35 },
    { id: area.yId, label: 'Y (%)', value: 35 },
    { id: area.widthId, label: 'Ancho (%)', value: 25 },
    { id: area.heightId, label: 'Alto (%)', value: 15 },
  ];

  const item = document.createElement('div');
  item.className = 'area';
  item.id = 'area-' + key;
  item.innerHTML =
    '<div class="area-head">' +
    '<label class="check">' +
    '<span class="area-swatch amber"></span>' +
    '<input type="checkbox" id="' +
    area.checkboxId +
    '" checked> ' +
    area.label +
    '</label>' +
    '<button type="button" class="btn btn-danger" data-remove="' +
    key +
    '">Eliminar</button>' +
    '</div>' +
    '<div class="area-grid">' +
    fields
      .map(
        (f) =>
          '<div><label for="' +
          f.id +
          '">' +
          f.label +
          '</label><input type="number" id="' +
          f.id +
          '" value="' +
          f.value +
          '" step="0.1" min="0" max="100"></div>',
      )
      .join('') +
    '</div>';

  item
    .querySelector('[data-remove]')
    .addEventListener('click', () => removeCustomArea(side, key));

  document
    .getElementById(
      side === 'anverso' ? 'customAreasAnverso' : 'customAreasReverso',
    )
    .appendChild(item);

  attachPreviewListeners([
    area.checkboxId,
    area.xId,
    area.yId,
    area.widthId,
    area.heightId,
  ]);

  updatePreviews();
}

function removeCustomArea(side, key) {
  customAreas[side] = customAreas[side].filter((area) => area.key !== key);
  document.getElementById('area-' + key)?.remove();
  updatePreviews();
}

// Los porcentajes se guardan en los inputs; aquí se traducen al lienzo activo
function getAreaRect(area, canvasWidth, canvasHeight) {
  return {
    x: Math.round(
      (parseFloat(document.getElementById(area.xId).value) / 100) * canvasWidth,
    ),
    y: Math.round(
      (parseFloat(document.getElementById(area.yId).value) / 100) *
        canvasHeight,
    ),
    width: Math.round(
      (parseFloat(document.getElementById(area.widthId).value) / 100) *
        canvasWidth,
    ),
    height: Math.round(
      (parseFloat(document.getElementById(area.heightId).value) / 100) *
        canvasHeight,
    ),
  };
}

function applyGrayscale(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
}

function updatePreviews() {
  updatePreview(croppedAnverso, 'anverso');
  updatePreview(croppedReverso, 'reverso');
}

function updatePreview(image, side) {
  if (!image) return;
  if (!image.complete || image.naturalWidth === 0) {
    image.addEventListener('load', () => updatePreview(image, side), {
      once: true,
    });
    return;
  }

  const canvasId =
    side === 'anverso' ? 'previewCanvasAnverso' : 'previewCanvasReverso';
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');

  // Ajustar tamaño del canvas para la previsualización
  const maxWidth = 500;
  const scale = Math.min(1, maxWidth / image.width);
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;

  // Guardar referencia del canvas y escala en editingState
  editingState[side].canvas = canvas;
  editingState[side].scale = scale;

  // Configurar event listeners si no están configurados
  if (!canvas.dataset.listenersAdded) {
    setupCanvasInteraction(canvas, side, image);
    canvas.dataset.listenersAdded = 'true';
  }

  // Dibujar imagen original
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const showAreas = document.getElementById('showBlurAreas').checked;
  const blurIntensity =
    parseInt(document.getElementById('blurIntensity').value) || 20;

  if (side === 'anverso') {
    // El área de la foto define tanto el difuminado como la posición de la marca de agua
    const blurFoto = document.getElementById('blurFoto').checked;
    const watermark = document.getElementById('addWatermark').checked;

    if (blurFoto || watermark) {
      const xPercent = parseFloat(document.getElementById('fotoX').value);
      const yPercent = parseFloat(document.getElementById('fotoY').value);
      const widthPercent = parseFloat(
        document.getElementById('fotoWidth').value,
      );
      const heightPercent = parseFloat(
        document.getElementById('fotoHeight').value,
      );

      const x = Math.round((xPercent / 100) * image.width * scale);
      const y = Math.round((yPercent / 100) * image.height * scale);
      const width = Math.round((widthPercent / 100) * image.width * scale);
      const height = Math.round((heightPercent / 100) * image.height * scale);

      if (showAreas) {
        // Mostrar rectángulo sin difuminar
        drawAreaOutline(
          ctx,
          x,
          y,
          width,
          height,
          'red',
          blurFoto ? 'Foto' : 'Marca de agua',
        );
      } else {
        if (blurFoto) {
          applyBlurToCanvas(
            ctx,
            x,
            y,
            width,
            height,
            Math.max(5, Math.round(blurIntensity * scale)),
          );
        }

        if (watermark) {
          addTextOverlayToCanvas(ctx, x, y, width, height, scale);
        }
      }
    }

    // Procesar firma
    if (document.getElementById('blurFirma').checked) {
      const xPercent = parseFloat(document.getElementById('firmaX').value);
      const yPercent = parseFloat(document.getElementById('firmaY').value);
      const widthPercent = parseFloat(
        document.getElementById('firmaWidth').value,
      );
      const heightPercent = parseFloat(
        document.getElementById('firmaHeight').value,
      );

      const x = Math.round((xPercent / 100) * image.width * scale);
      const y = Math.round((yPercent / 100) * image.height * scale);
      const width = Math.round((widthPercent / 100) * image.width * scale);
      const height = Math.round((heightPercent / 100) * image.height * scale);

      if (showAreas) {
        drawAreaOutline(ctx, x, y, width, height, 'blue', 'Firma');
      } else {
        applyBlurToCanvas(
          ctx,
          x,
          y,
          width,
          height,
          Math.max(5, Math.round(blurIntensity * scale)),
        );
      }
    }
  } else {
    // Procesar EQUIPO
    if (document.getElementById('blurEquipo').checked) {
      const xPercent = parseFloat(document.getElementById('equipoX').value);
      const yPercent = parseFloat(document.getElementById('equipoY').value);
      const widthPercent = parseFloat(
        document.getElementById('equipoWidth').value,
      );
      const heightPercent = parseFloat(
        document.getElementById('equipoHeight').value,
      );

      const x = Math.round((xPercent / 100) * image.width * scale);
      const y = Math.round((yPercent / 100) * image.height * scale);
      const width = Math.round((widthPercent / 100) * image.width * scale);
      const height = Math.round((heightPercent / 100) * image.height * scale);

      if (showAreas) {
        drawAreaOutline(ctx, x, y, width, height, 'green', 'EQUIPO');
      } else {
        applyBlurToCanvas(
          ctx,
          x,
          y,
          width,
          height,
          Math.max(5, Math.round(blurIntensity * scale)),
        );
      }
    }
  }

  customAreas[side].forEach((area) => {
    if (!document.getElementById(area.checkboxId).checked) return;

    const rect = getAreaRect(area, canvas.width, canvas.height);

    if (showAreas) {
      drawAreaOutline(
        ctx,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        'orange',
        area.label,
      );
    } else {
      applyBlurToCanvas(
        ctx,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        Math.max(5, Math.round(blurIntensity * scale)),
      );
    }
  });

  if (document.getElementById('grayscaleMode').checked) {
    applyGrayscale(ctx, canvas.width, canvas.height);
  }
}

function drawAreaOutline(ctx, x, y, width, height, color, label) {
  ctx.save();

  // Dibujar fondo semitransparente del área
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.fillRect(x, y, width, height);

  // Dibujar rectángulo de borde
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  ctx.strokeRect(x, y, width, height);

  // Dibujar manijas de redimensionamiento (círculos en las esquinas)
  const handleSize = 10;
  ctx.fillStyle = 'white';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  const handles = [
    { x: x, y: y, cursor: 'nw-resize' },
    { x: x + width, y: y, cursor: 'ne-resize' },
    { x: x, y: y + height, cursor: 'sw-resize' },
    { x: x + width, y: y + height, cursor: 'se-resize' },
  ];

  handles.forEach((handle) => {
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Fondo para el label
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  const labelPadding = 8;
  const labelHeight = 24;
  const labelWidth = ctx.measureText(label).width + labelPadding * 2;
  const labelX = x + (width - labelWidth) / 2;
  const labelY = y - labelHeight - 5;

  // Dibujar label arriba del área (rectángulo con esquinas redondeadas)
  ctx.beginPath();
  const radius = 5;
  ctx.moveTo(labelX + radius, labelY);
  ctx.lineTo(labelX + labelWidth - radius, labelY);
  ctx.quadraticCurveTo(
    labelX + labelWidth,
    labelY,
    labelX + labelWidth,
    labelY + radius,
  );
  ctx.lineTo(labelX + labelWidth, labelY + labelHeight - radius);
  ctx.quadraticCurveTo(
    labelX + labelWidth,
    labelY + labelHeight,
    labelX + labelWidth - radius,
    labelY + labelHeight,
  );
  ctx.lineTo(labelX + radius, labelY + labelHeight);
  ctx.quadraticCurveTo(
    labelX,
    labelY + labelHeight,
    labelX,
    labelY + labelHeight - radius,
  );
  ctx.lineTo(labelX, labelY + radius);
  ctx.quadraticCurveTo(labelX, labelY, labelX + radius, labelY);
  ctx.closePath();
  ctx.fill();

  // Texto del label
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'white';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, labelX + labelWidth / 2, labelY + labelHeight / 2);

  ctx.restore();
}

function applyBlurToCanvas(ctx, x, y, width, height, intensity) {
  if (width <= 0 || height <= 0) return;

  const imageData = ctx.getImageData(x, y, width, height);
  const blurred = stackBlur(imageData, intensity);
  ctx.putImageData(blurred, x, y);
}

function addTextOverlayToCanvas(ctx, x, y, width, height, scale) {
  const text = document.getElementById('overlayText').value;
  if (!text) return;

  const fontSizePercent = parseFloat(document.getElementById('fontSize').value);
  const color = document.getElementById('textColor').value;

  // Calcular tamaño de fuente basado en el canvas de previsualización
  const fontSize = Math.round((fontSizePercent / 100) * ctx.canvas.width);

  ctx.save();
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = Math.max(2, fontSize * 0.1);
  ctx.shadowOffsetX = Math.max(1, fontSize * 0.05);
  ctx.shadowOffsetY = Math.max(1, fontSize * 0.05);

  const textX = x + width / 2;
  const textY = y + height / 2;
  ctx.fillText(text, textX, textY);

  ctx.restore();
}

function setupCanvasInteraction(canvas, side, image) {
  const state = editingState[side];

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function getAreas() {
    const areas = [];

    if (side === 'anverso') {
      if (
        document.getElementById('blurFoto').checked ||
        document.getElementById('addWatermark').checked
      ) {
        areas.push({
          id: 'foto',
          xId: 'fotoX',
          yId: 'fotoY',
          widthId: 'fotoWidth',
          heightId: 'fotoHeight',
          color: 'red',
          label: 'Foto',
        });
      }
      if (document.getElementById('blurFirma').checked) {
        areas.push({
          id: 'firma',
          xId: 'firmaX',
          yId: 'firmaY',
          widthId: 'firmaWidth',
          heightId: 'firmaHeight',
          color: 'blue',
          label: 'Firma',
        });
      }
    } else {
      if (document.getElementById('blurEquipo').checked) {
        areas.push({
          id: 'equipo',
          xId: 'equipoX',
          yId: 'equipoY',
          widthId: 'equipoWidth',
          heightId: 'equipoHeight',
          color: 'green',
          label: 'EQUIPO',
        });
      }
    }

    customAreas[side].forEach((area) => {
      if (document.getElementById(area.checkboxId).checked) {
        areas.push({
          id: area.key,
          xId: area.xId,
          yId: area.yId,
          widthId: area.widthId,
          heightId: area.heightId,
          color: area.color,
          label: area.label,
        });
      }
    });

    return areas.map((area) => {
      const xPercent = parseFloat(document.getElementById(area.xId).value);
      const yPercent = parseFloat(document.getElementById(area.yId).value);
      const widthPercent = parseFloat(
        document.getElementById(area.widthId).value,
      );
      const heightPercent = parseFloat(
        document.getElementById(area.heightId).value,
      );

      return {
        ...area,
        x: Math.round((xPercent / 100) * image.width * state.scale),
        y: Math.round((yPercent / 100) * image.height * state.scale),
        width: Math.round((widthPercent / 100) * image.width * state.scale),
        height: Math.round((heightPercent / 100) * image.height * state.scale),
      };
    });
  }

  function getResizeHandle(mousePos, area) {
    const handleSize = 15;
    const handles = [
      { x: area.x, y: area.y, type: 'nw' },
      { x: area.x + area.width, y: area.y, type: 'ne' },
      { x: area.x, y: area.y + area.height, type: 'sw' },
      { x: area.x + area.width, y: area.y + area.height, type: 'se' },
    ];

    for (let handle of handles) {
      const dist = Math.sqrt(
        Math.pow(mousePos.x - handle.x, 2) + Math.pow(mousePos.y - handle.y, 2),
      );
      if (dist < handleSize) {
        return handle.type;
      }
    }
    return null;
  }

  function isInsideArea(mousePos, area) {
    return (
      mousePos.x >= area.x &&
      mousePos.x <= area.x + area.width &&
      mousePos.y >= area.y &&
      mousePos.y <= area.y + area.height
    );
  }

  function updateCursor(mousePos) {
    if (!document.getElementById('showBlurAreas').checked) {
      canvas.style.cursor = 'default';
      return;
    }

    const areas = getAreas();
    for (let area of areas) {
      const handle = getResizeHandle(mousePos, area);
      if (handle) {
        canvas.style.cursor = handle + '-resize';
        return;
      }
      if (isInsideArea(mousePos, area)) {
        canvas.style.cursor = 'move';
        return;
      }
    }
    canvas.style.cursor = 'default';
  }

  function updateInputs(area) {
    // Convertir píxeles a porcentajes
    const xPercent = (area.x / state.scale / image.width) * 100;
    const yPercent = (area.y / state.scale / image.height) * 100;
    const widthPercent = (area.width / state.scale / image.width) * 100;
    const heightPercent = (area.height / state.scale / image.height) * 100;

    document.getElementById(area.xId).value = xPercent.toFixed(1);
    document.getElementById(area.yId).value = yPercent.toFixed(1);
    document.getElementById(area.widthId).value = widthPercent.toFixed(1);
    document.getElementById(area.heightId).value = heightPercent.toFixed(1);
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!document.getElementById('showBlurAreas').checked) return;

    const mousePos = getMousePos(e);
    const areas = getAreas();

    for (let area of areas) {
      const handle = getResizeHandle(mousePos, area);
      if (handle) {
        state.resizing = true;
        state.resizeHandle = handle;
        state.selectedArea = area;
        state.startX = mousePos.x;
        state.startY = mousePos.y;
        state.originalArea = { ...area };
        return;
      }

      if (isInsideArea(mousePos, area)) {
        state.dragging = true;
        state.selectedArea = area;
        state.startX = mousePos.x - area.x;
        state.startY = mousePos.y - area.y;
        return;
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const mousePos = getMousePos(e);

    if (state.dragging && state.selectedArea) {
      const newX = Math.max(
        0,
        Math.min(
          mousePos.x - state.startX,
          canvas.width - state.selectedArea.width,
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          mousePos.y - state.startY,
          canvas.height - state.selectedArea.height,
        ),
      );

      state.selectedArea.x = newX;
      state.selectedArea.y = newY;

      updateInputs(state.selectedArea);
      updatePreviews();
    } else if (state.resizing && state.selectedArea) {
      const dx = mousePos.x - state.startX;
      const dy = mousePos.y - state.startY;
      const orig = state.originalArea;

      let newX = orig.x;
      let newY = orig.y;
      let newWidth = orig.width;
      let newHeight = orig.height;

      switch (state.resizeHandle) {
        case 'nw':
          newX = Math.max(0, Math.min(orig.x + dx, orig.x + orig.width - 20));
          newY = Math.max(0, Math.min(orig.y + dy, orig.y + orig.height - 20));
          newWidth = orig.width - (newX - orig.x);
          newHeight = orig.height - (newY - orig.y);
          break;
        case 'ne':
          newY = Math.max(0, Math.min(orig.y + dy, orig.y + orig.height - 20));
          newWidth = Math.max(
            20,
            Math.min(orig.width + dx, canvas.width - orig.x),
          );
          newHeight = orig.height - (newY - orig.y);
          break;
        case 'sw':
          newX = Math.max(0, Math.min(orig.x + dx, orig.x + orig.width - 20));
          newWidth = orig.width - (newX - orig.x);
          newHeight = Math.max(
            20,
            Math.min(orig.height + dy, canvas.height - orig.y),
          );
          break;
        case 'se':
          newWidth = Math.max(
            20,
            Math.min(orig.width + dx, canvas.width - orig.x),
          );
          newHeight = Math.max(
            20,
            Math.min(orig.height + dy, canvas.height - orig.y),
          );
          break;
      }

      state.selectedArea.x = newX;
      state.selectedArea.y = newY;
      state.selectedArea.width = newWidth;
      state.selectedArea.height = newHeight;

      updateInputs(state.selectedArea);
      updatePreviews();
    } else {
      updateCursor(mousePos);
    }
  });

  canvas.addEventListener('mouseup', () => {
    state.dragging = false;
    state.resizing = false;
    state.selectedArea = null;
    state.resizeHandle = null;
  });

  canvas.addEventListener('mouseleave', () => {
    state.dragging = false;
    state.resizing = false;
    state.selectedArea = null;
    state.resizeHandle = null;
    canvas.style.cursor = 'default';
  });
}

function processImages() {
  // Procesar anverso
  processedAnverso = processImage(croppedAnverso, 'anverso');

  // Procesar reverso
  processedReverso = processImage(croppedReverso, 'reverso');

  // Mostrar sección de descarga
  updateStep(4, 'completed');
  document.getElementById('downloadSection').classList.remove('hidden');
  document
    .getElementById('downloadSection')
    .scrollIntoView({ behavior: 'smooth' });
}

function processImage(image, side) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = image.width;
  canvas.height = image.height;

  // Dibujar imagen original
  ctx.drawImage(image, 0, 0);

  // Aplicar difuminados
  const blurIntensity =
    parseInt(document.getElementById('blurIntensity').value) || 20;

  if (side === 'anverso') {
    const blurFoto = document.getElementById('blurFoto').checked;
    const watermark = document.getElementById('addWatermark').checked;

    if (blurFoto || watermark) {
      // Convertir porcentajes a píxeles
      const xPercent = parseFloat(document.getElementById('fotoX').value);
      const yPercent = parseFloat(document.getElementById('fotoY').value);
      const widthPercent = parseFloat(
        document.getElementById('fotoWidth').value,
      );
      const heightPercent = parseFloat(
        document.getElementById('fotoHeight').value,
      );

      const x = Math.round((xPercent / 100) * canvas.width);
      const y = Math.round((yPercent / 100) * canvas.height);
      const width = Math.round((widthPercent / 100) * canvas.width);
      const height = Math.round((heightPercent / 100) * canvas.height);

      if (blurFoto) {
        applyBlur(ctx, x, y, width, height, blurIntensity);
      }

      if (watermark) {
        addTextOverlay(ctx, x, y, width, height);
      }
    }

    if (document.getElementById('blurFirma').checked) {
      // Convertir porcentajes a píxeles
      const xPercent = parseFloat(document.getElementById('firmaX').value);
      const yPercent = parseFloat(document.getElementById('firmaY').value);
      const widthPercent = parseFloat(
        document.getElementById('firmaWidth').value,
      );
      const heightPercent = parseFloat(
        document.getElementById('firmaHeight').value,
      );

      const x = Math.round((xPercent / 100) * canvas.width);
      const y = Math.round((yPercent / 100) * canvas.height);
      const width = Math.round((widthPercent / 100) * canvas.width);
      const height = Math.round((heightPercent / 100) * canvas.height);

      applyBlur(ctx, x, y, width, height, blurIntensity);
    }
  } else {
    if (document.getElementById('blurEquipo').checked) {
      // Convertir porcentajes a píxeles
      const xPercent = parseFloat(document.getElementById('equipoX').value);
      const yPercent = parseFloat(document.getElementById('equipoY').value);
      const widthPercent = parseFloat(
        document.getElementById('equipoWidth').value,
      );
      const heightPercent = parseFloat(
        document.getElementById('equipoHeight').value,
      );

      const x = Math.round((xPercent / 100) * canvas.width);
      const y = Math.round((yPercent / 100) * canvas.height);
      const width = Math.round((widthPercent / 100) * canvas.width);
      const height = Math.round((heightPercent / 100) * canvas.height);

      applyBlur(ctx, x, y, width, height, blurIntensity);
    }
  }

  customAreas[side].forEach((area) => {
    if (!document.getElementById(area.checkboxId).checked) return;

    const rect = getAreaRect(area, canvas.width, canvas.height);
    applyBlur(ctx, rect.x, rect.y, rect.width, rect.height, blurIntensity);
  });

  if (document.getElementById('grayscaleMode').checked) {
    applyGrayscale(ctx, canvas.width, canvas.height);
  }

  return canvas.toDataURL('image/png');
}

function applyBlur(ctx, x, y, width, height, intensity) {
  // Extraer la región a difuminar
  const imageData = ctx.getImageData(x, y, width, height);
  const blurred = stackBlur(imageData, intensity);
  ctx.putImageData(blurred, x, y);
}

function stackBlur(imageData, radius) {
  // Implementación simplificada de blur gaussiano
  const pixels = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Blur horizontal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0;

      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          const idx = (y * width + nx) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          a += pixels[idx + 3];
          count++;
        }
      }

      const idx = (y * width + x) * 4;
      pixels[idx] = r / count;
      pixels[idx + 1] = g / count;
      pixels[idx + 2] = b / count;
      pixels[idx + 3] = a / count;
    }
  }

  // Blur vertical
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          const idx = (ny * width + x) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          a += pixels[idx + 3];
          count++;
        }
      }

      const idx = (y * width + x) * 4;
      pixels[idx] = r / count;
      pixels[idx + 1] = g / count;
      pixels[idx + 2] = b / count;
      pixels[idx + 3] = a / count;
    }
  }

  return imageData;
}

function addTextOverlay(ctx, x, y, width, height) {
  const text = document.getElementById('overlayText').value;
  const fontSizePercent = parseFloat(document.getElementById('fontSize').value);
  const color = document.getElementById('textColor').value;

  // Calcular tamaño de fuente basado en porcentaje del ancho de la imagen
  const fontSize = Math.round((fontSizePercent / 100) * ctx.canvas.width);

  ctx.save();

  // Configurar texto
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Añadir sombra para mejor legibilidad
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = Math.max(2, fontSize * 0.1);
  ctx.shadowOffsetX = Math.max(1, fontSize * 0.05);
  ctx.shadowOffsetY = Math.max(1, fontSize * 0.05);

  // Dibujar texto en el centro de la foto
  const textX = x + width / 2;
  const textY = y + height / 2;
  ctx.fillText(text, textX, textY);

  ctx.restore();
}

function downloadAnverso() {
  downloadImage(processedAnverso, 'DNI-anverso-procesado.png');
}

function downloadReverso() {
  downloadImage(processedReverso, 'DNI-reverso-procesado.png');
}

function downloadImage(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function loadImageFromSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Recomprime a JPEG porque el PDF solo puede embeber imágenes sin decodificar como DCTDecode (JPEG)
function imageToJpegBinary(img, quality = 0.92) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
  return {
    binary: atob(base64),
    width: canvas.width,
    height: canvas.height,
  };
}

// Genera un PDF válido a mano (sin librerías externas) con las dos imágenes apiladas
function buildTwoImagePdf(images) {
  const pageWidth = 595.28; // A4 en puntos
  const margin = 30;
  const gap = 20;
  const contentWidth = pageWidth - margin * 2;

  const dims = images.map((img) => ({
    w: contentWidth,
    h: img.height * (contentWidth / img.width),
  }));

  const pageHeight = margin * 2 + gap + dims[0].h + dims[1].h;
  const y1 = pageHeight - margin - dims[0].h;
  const y2 = y1 - gap - dims[1].h;
  const positions = [
    { x: margin, y: y1, w: dims[0].w, h: dims[0].h },
    { x: margin, y: y2, w: dims[1].w, h: dims[1].h },
  ];

  const content = positions
    .map(
      (p, i) =>
        `q\n${p.w.toFixed(2)} 0 0 ${p.h.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)} cm\n/Im${i + 1} Do\nQ\n`,
    )
    .join('');

  const chunks = [];
  const offsets = [];
  let offset = 0;
  const push = (str) => {
    chunks.push(str);
    offset += str.length;
  };

  push('%PDF-1.4\n');

  offsets[1] = offset;
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = offset;
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = offset;
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im1 4 0 R /Im2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
  );

  [4, 5].forEach((objNum, i) => {
    const img = images[i];
    offsets[objNum] = offset;
    push(
      `${objNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.binary.length} >>\nstream\n`,
    );
    push(img.binary);
    push('\nendstream\nendobj\n');
  });

  offsets[6] = offset;
  push(`6 0 obj\n<< /Length ${content.length} >>\nstream\n`);
  push(content);
  push('endstream\nendobj\n');

  const xrefOffset = offset;
  let xref = 'xref\n0 7\n0000000000 65535 f \n';
  for (let i = 1; i <= 6; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  push(xref);
  push(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const fullStr = chunks.join('');
  const bytes = new Uint8Array(fullStr.length);
  for (let i = 0; i < fullStr.length; i++) {
    bytes[i] = fullStr.charCodeAt(i) & 0xff;
  }
  return bytes;
}

async function exportToPDF() {
  if (!processedAnverso || !processedReverso) {
    alert('Primero procesa las imágenes');
    return;
  }
  try {
    const [imgAnverso, imgReverso] = await Promise.all([
      loadImageFromSrc(processedAnverso),
      loadImageFromSrc(processedReverso),
    ]);

    const pdfBytes = buildTwoImagePdf([
      imageToJpegBinary(imgAnverso),
      imageToJpegBinary(imgReverso),
    ]);

    const url = URL.createObjectURL(
      new Blob([pdfBytes], { type: 'application/pdf' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'DNI-procesado.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert('No se pudo generar el PDF');
  }
}

function updateStep(stepNum, status) {
  const step = document.getElementById('step' + stepNum);
  step.classList.remove('active', 'completed');
  if (status) {
    step.classList.add(status);
  }
}

function resetAll() {
  location.reload();
}
