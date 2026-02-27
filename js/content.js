let frecuencias = [
  { frecuencia: 20, vol: 0 },
  { frecuencia: 25, vol: 0 },
  { frecuencia: 31.5, vol: 0 },
  { frecuencia: 40, vol: 0 },
  { frecuencia: 50, vol: 0 },
  { frecuencia: 63, vol: 0 },
  { frecuencia: 80, vol: 0 },
  { frecuencia: 100, vol: 0 },
  { frecuencia: 125, vol: 0 },
  { frecuencia: 160, vol: 0 },
  { frecuencia: 200, vol: 0 },
  { frecuencia: 250, vol: 0 },
  { frecuencia: 315, vol: 0 },
  { frecuencia: 400, vol: 0 },
  { frecuencia: 500, vol: 0 },
  { frecuencia: 630, vol: 0 },
  { frecuencia: 800, vol: 0 },
  { frecuencia: 1000, vol: 0 },
  { frecuencia: 1250, vol: 0 },
  { frecuencia: 1600, vol: 0 },
  { frecuencia: 2000, vol: 0 },
  { frecuencia: 2500, vol: 0 },
  { frecuencia: 3150, vol: 0 },
  { frecuencia: 4000, vol: 0 },
  { frecuencia: 5000, vol: 0 },
  { frecuencia: 6300, vol: 0 },
  { frecuencia: 8000, vol: 0 },
  { frecuencia: 10000, vol: 0 },
  { frecuencia: 12500, vol: 0 },
  { frecuencia: 16000, vol: 0 },
  { frecuencia: 20000, vol: 0 },
];

let bands = [];

// variables para los cortes de frecuencias y ganancias
let frecuenciaBaja;
let gananciaBaja;
let frecuenciaAlta;
let gananciaAlta;
let isActive;

// variables para los nodos de ganancias de bajas y altas
let gainLow;
let gainHight;
// let lowPassFilter;
// let hightPassFilter;

// variables para los nodos de BBE Sonic Maximizer
let bbeLowNode;
let bbeProcessNode;

// Parámetros BBE
let bbeParams = {
  lowContour: 4,
  bassBoost: 4,
  process: 3,
  lowEnabled: true,
  processEnabled: true,
};

// Función para crear el módulo BBE Low Contour
function createBBELowNode(ctx, inputNode, options = {}) {
  const isEnabled = options.enabled !== undefined ? options.enabled : true;

  if (!isEnabled) {
    return {
      output: inputNode,
    };
  }

  const lowContourGain = options.lowContourGain || 0;
  const bassBoostGain = options.bassBoostGain || 0;
  const frequency = 80; // Hz

  // Crear nodos internos
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.707;

  const lowContourGainNode = ctx.createGain();
  // Al ser paralelo, sumamos el efecto al original
  lowContourGainNode.gain.value = isEnabled
    ? Math.pow(10, lowContourGain / 20) - 1
    : 0;

  const merger = ctx.createGain(); // Sumador final del módulo

  // Extra Bass Boost para tono más profundo
  const bassBoostFilter = ctx.createBiquadFilter();
  bassBoostFilter.type = "lowpass";
  bassBoostFilter.frequency.value = 50; // Hz para profundidad sub
  bassBoostFilter.Q.value = 0.707;

  const bassBoostGainNode = ctx.createGain();
  bassBoostGainNode.gain.value = isEnabled
    ? Math.pow(10, bassBoostGain / 20) - 1
    : 0;

  // Arquitectura:
  // input -> dry path -> merger
  // input -> filter -> lowContourGainNode -> merger
  // input -> bassBoostFilter -> bassBoostGainNode -> merger

  inputNode.connect(merger);
  inputNode.connect(filter);
  filter.connect(lowContourGainNode);
  lowContourGainNode.connect(merger);

  inputNode.connect(bassBoostFilter);
  bassBoostFilter.connect(bassBoostGainNode);
  bassBoostGainNode.connect(merger);

  return {
    output: merger,
    lowContourGainNode: lowContourGainNode,
    bassBoostGainNode: bassBoostGainNode,
  };
}

// Función para crear el módulo BBE Process (Claridad)
function createBBEProcessNode(ctx, inputNode, options = {}) {
  const isEnabled = options.enabled !== undefined ? options.enabled : true;

  if (!isEnabled) {
    return {
      output: inputNode,
    };
  }

  const processGain = options.processGain || 0;
  const frequency = 4500; // Hz (entre 3kHz y 5kHz)

  // Crear nodos internos
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.707;

  const processGainNode = ctx.createGain();
  // Convertir dB a ganancia lineal
  processGainNode.gain.value = isEnabled
    ? Math.pow(10, processGain / 20) - 1
    : 0;

  const merger = ctx.createGain(); // Sumador final del módulo

  // Arquitectura:
  // input -> dry path -> merger
  // input -> filter -> processGainNode -> merger

  inputNode.connect(merger);
  inputNode.connect(filter);
  filter.connect(processGainNode);
  processGainNode.connect(merger);

  return {
    output: merger,
    processGainNode: processGainNode,
  };
}

// Función para crear filtros LR o Butterworth parametrizables
function createFilter({
  type = "highpass", // "highpass" o "lowpass"
  frequency = 1000, // Frecuencia de corte (Hz)
  slope = 24, // Pendiente (24, 48 dB/octava)
  filterType = "LR", // "LR" (Linkwitz-Riley) o "butterworth",
  ctx,
}) {
  const stages = slope / 12; // Etapas necesarias (2 para 24 dB, 4 para 48 dB)
  const filters = [];

  // Configurar Q según el tipo de filtro
  const Q = filterType === "LR" ? 0.5 : 0.7071; // Q para LR o Butterworth

  // Crear y configurar cada etapa
  for (let i = 0; i < stages; i++) {
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = Q;
    filters.push(filter);
  }

  // Conectar en serie
  filters.reduce((prev, curr) => prev.connect(curr));

  return {
    input: filters[0],
    output: filters[filters.length - 1],
    filters: filters, // Opcional: acceso a cada etapa
  };
}

// Create filters
let hightFilter;

let lowFilter;

const main = () => {
  // frecuencias bajas
  if (localStorage.getItem("frecuenciaBaja")) {
    frecuenciaBaja = localStorage.getItem("frecuenciaBaja");
  } else {
    frecuenciaBaja = 85;
  }

  // ganancia de frecuencias bajas
  if (localStorage.getItem("gananciaBaja")) {
    gananciaBaja = localStorage.getItem("gananciaBaja");
  } else {
    gananciaBaja = 1;
  }

  // Frecuencias Altas
  if (localStorage.getItem("frecuenciaAlta")) {
    frecuenciaAlta = localStorage.getItem("frecuenciaAlta");
  } else {
    frecuenciaAlta = 300;
  }

  // Ganancia de frecuencias altas
  if (localStorage.getItem("gananciaAlta")) {
    gananciaAlta = localStorage.getItem("gananciaAlta");
  } else {
    gananciaAlta = 1;
  }

  if (typeof localStorage.getItem("isActive") !== "undefined") {
    const temp = localStorage.getItem("isActive");
    if (temp === "false" || temp === false) {
      isActive = false;
      return;
    } else {
      isActive = true;
    }
  }

  const audioElement = document.querySelector("video");

  const Context = window.webkitAudioContext
    ? window.webkitAudioContext
    : window.AudioContext;
  ctx = new Context();
  const mediaElement = ctx.createMediaElementSource(audioElement);

  frecuencias.forEach((item, index) => {
    bands[index] = ctx.createBiquadFilter();
    bands[index].type = "peaking"; // 5 || 'peaking'
    bands[index].frequency.value = item.frecuencia;
    bands[index].Q.value = 4.3;
    bands[index].gain.value = item.vol;
  });

  // filtro pasa bajo
  lowFilter = createFilter({
    ctx,
    filterType: "LR",
    frequency: frecuenciaBaja,
    slope: 24,
    type: "lowpass",
  });
  // lowPassFilter = ctx.createBiquadFilter();
  // lowPassFilter.frequency.value = frecuenciaBaja;
  // lowPassFilter.Q.value = Math.SQRT1_2;

  // filtro pasa alto
  hightFilter = createFilter({
    ctx,
    filterType: "LR",
    frequency: frecuenciaAlta,
    slope: 24,
    type: "highpass",
  });
  // hightPassFilter = ctx.createBiquadFilter();
  // hightPassFilter.type = "highpass";
  // hightPassFilter.frequency.value = frecuenciaAlta;
  // hightPassFilter.Q.value = Math.SQRT1_2;

  // ganacia por canal
  gainLow = ctx.createGain();
  gainLow.gain.value = gananciaBaja;

  gainHight = ctx.createGain();
  gainHight.gain.value = gananciaAlta;
  // separar los canales
  let splitter = ctx.createChannelSplitter(2);

  // unir los canales
  let merger = ctx.createChannelMerger(2);

  gainLow.connect(lowFilter.input);
  gainHight.connect(hightFilter.input);

  for (i = 1; i < frecuencias.length; i++) {
    bands[i - 1].connect(bands[i]);
  }
  // crear splitter y merge para poder separar los dos canales L y R
  // para derecha altos
  const splitterRight = ctx.createChannelSplitter(2);
  const mergeRight = ctx.createChannelMerger(2);

  // para izquierda bajos
  const splitterLeft = ctx.createChannelSplitter(2);
  const mergeLeft = ctx.createChannelMerger(2);

  // merge une los dos canales ya en mono
  const merge = ctx.createChannelMerger(2);

  // se conecta los dos separadores de canales al source
  mediaElement.connect(splitterLeft);
  mediaElement.connect(splitterRight);

  // uniendo los dos canales L y R en uno solo que sera R
  splitterRight.connect(mergeRight, 0, 1);
  splitterRight.connect(mergeRight, 0, 1);

  // uniendo los dos canales L y R en uno solo que sera L
  splitterLeft.connect(mergeLeft, 1, 0);
  splitterLeft.connect(mergeLeft, 1, 0);

  // Uniendo los canales L y R antes modificados y
  // dando un canal cada uno final
  mergeLeft.connect(merge, 0, 0);
  mergeRight.connect(merge, 0, 1);

  merge.connect(bands[0]);

  // mediaElement.connect(bands[0]);
  // asignando los filtros a cada canal
  bands[frecuencias.length - 1].connect(splitter);

  splitter.connect(gainLow, 0);
  splitter.connect(gainHight, 1);

  // Integración del módulo BBE Sonic Maximizer
  // Aplicamos Low Contour y Bass Boost a la banda de bajos
  bbeLowNode = createBBELowNode(ctx, lowFilter.output, {
    lowContourGain: bbeParams.lowContour,
    bassBoostGain: bbeParams.bassBoost,
    enabled: bbeParams.lowEnabled,
  });

  // Aplicamos Process (realce de armónicos) a la banda de altos
  bbeProcessNode = createBBEProcessNode(ctx, hightFilter.output, {
    processGain: bbeParams.process,
    enabled: bbeParams.processEnabled,
  });

  bbeLowNode.output.connect(merger, 0, 0);
  bbeProcessNode.output.connect(merger, 0, 1);

  let lowCutFilter = Array(4)
    .fill()
    .map(() => {
      const lowCut = ctx.createBiquadFilter();
      lowCut.type = "highpass";
      lowCut.frequency.value = getLowCut();
      lowCut.Q.value = 0.5;
      return lowCut;
    });

  merger.connect(lowCutFilter[0]);
  lowCutFilter.forEach((filter, index) => {
    if (index < lowCutFilter.length - 1) {
      filter.connect(lowCutFilter[index + 1]);
    }
  });
  lowCutFilter[lowCutFilter.length - 1].connect(ctx.destination);
};

const setDefaultValue = () => {
  let old = frecuencias.map((item) => {
    let oldObj = { ...item };
    let local = localStorage.getItem(`vol-frecuencia-${oldObj.frecuencia}`);
    if (local === null || local === "") {
      localStorage.setItem(`vol-frecuencia-${oldObj.frecuencia}`, oldObj.vol);
    } else {
      oldObj.vol = local;
    }
    return oldObj;
  });
  frecuencias = [...old];

  if (!localStorage.getItem("frecuenciaBaja")) {
    localStorage.setItem("frecuenciaBaja", 85);
  }

  if (!localStorage.getItem("gananciaBaja")) {
    localStorage.setItem("gananciaBaja", 1);
  }

  if (!localStorage.getItem("frecuenciaAlta")) {
    localStorage.setItem("frecuenciaAlta", 85);
  }

  if (!localStorage.getItem("gananciaAlta")) {
    localStorage.setItem("gananciaAlta", 1);
  }

  if (!localStorage.getItem("isActive")) {
    localStorage.setItem("isActive", true);
  }

  // Inicialización de parámetros BBE
  if (localStorage.getItem("bbeLowContour") === null) {
    localStorage.setItem("bbeLowContour", 4);
  }
  if (localStorage.getItem("bbeBassBoost") === null) {
    localStorage.setItem("bbeBassBoost", 4);
  }
  if (localStorage.getItem("bbeProcess") === null) {
    localStorage.setItem("bbeProcess", 3);
  }
  if (localStorage.getItem("bbeLowEnabled") === null) {
    localStorage.setItem("bbeLowEnabled", true);
  }
  if (localStorage.getItem("bbeProcessEnabled") === null) {
    localStorage.setItem("bbeProcessEnabled", true);
  }

  bbeParams = {
    lowContour: parseFloat(localStorage.getItem("bbeLowContour")),
    bassBoost: parseFloat(localStorage.getItem("bbeBassBoost")),
    process: parseFloat(localStorage.getItem("bbeProcess")),
    lowEnabled: localStorage.getItem("bbeLowEnabled") !== "false",
    processEnabled: localStorage.getItem("bbeProcessEnabled") !== "false",
  };
};

const resetFrequency = (index) => {
  let old = frecuencias.map((frequency) => {
    localStorage.setItem(`vol-frecuencia-${frequency.frecuencia}`, 0);
    return { ...frequency, vol: 0 };
  });
  frecuencias = [...old];

  let oldBands = bands.map((band) => {
    if (band.gain && band.gain.value) {
      band.gain.value = 0;
    }
    return band;
  });

  bands = [...oldBands];
};

// listen for events
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(request, "in onMessage");
  if (request.action === "load-main") {
    setDefaultValue();
    main();
  }

  if (request.action === "load-info") {
    let old = frecuencias.map((item) => {
      let oldObj = { ...item };
      let local = localStorage.getItem(`vol-frecuencia-${oldObj.frecuencia}`);
      if (local === null || local === "") {
        localStorage.setItem(`vol-frecuencia-${oldObj.frecuencia}`, oldObj.vol);
      } else {
        oldObj.vol = local;
      }
      return oldObj;
    });
    frecuencias = [...old];

    bbeParams = {
      lowContour: parseFloat(localStorage.getItem("bbeLowContour")) || 4,
      bassBoost: parseFloat(localStorage.getItem("bbeBassBoost")) || 4,
      process: parseFloat(localStorage.getItem("bbeProcess")) || 3,
      lowEnabled: localStorage.getItem("bbeLowEnabled") !== "false",
      processEnabled: localStorage.getItem("bbeProcessEnabled") !== "false",
    };

    chrome.runtime.sendMessage({
      action: "load-info",
      gananciaBaja,
      gananciaAlta,
      frecuenciaBaja,
      frecuenciaAlta,
      frecuencias: [...old],
      isActive: isActive,
      bbeParams: bbeParams,
    });
  }

  if (request.action === "resetFrecuency") {
    resetFrequency();
  }

  if (request.action === "toggle-status") {
    isActive = request.value;
    localStorage.setItem("isActive", isActive);
    location.reload();
  }

  if (request.action === "changeLowFrecuency") {
    frecuenciaBaja = request.value;
    // lowPassFilter.frequency.value = request.value;
    lowFilter?.filters?.forEach(
      (filter) => (filter.frequency.value = request.value),
    );
    localStorage.setItem("frecuenciaBaja", frecuenciaBaja);
  }

  if (request.action === "changeHightFrecuency") {
    frecuenciaAlta = request.value;
    // hightPassFilter.frequency.value = request.value;
    hightFilter?.filters?.forEach(
      (filter) => (filter.frequency.value = request.value),
    );
    localStorage.setItem("frecuenciaAlta", frecuenciaAlta);
  }

  if (request.action === "changeLowGain") {
    gananciaBaja = request.value;
    gainLow.gain.value = request.value;
    localStorage.setItem("gananciaBaja", gananciaBaja);
  }

  if (request.action === "changeHightGain") {
    gananciaAlta = request.value;
    gainHight.gain.value = request.value;
    localStorage.setItem("gananciaAlta", gananciaAlta);
  }

  if (request.action === "changeBandFrecuency") {
    const { value, frecuency } = request;

    let oldFrecuencies = frecuencias.map((item) => {
      if (item.frecuencia === frecuency) {
        return { ...item, vol: value };
      }
      return item;
    });
    frecuencias = [...oldFrecuencies];
    let oldBands = bands.map((band) => {
      if (band.frequency.value === frecuency) {
        band.gain.value = value;
        return band;
      }
      return band;
    });
    bands = [...oldBands];

    localStorage.setItem(`vol-frecuencia-${frecuency}`, value);
  }

  if (request.action === "changeBbeLowContour") {
    bbeParams.lowContour = parseFloat(request.value);
    localStorage.setItem("bbeLowContour", bbeParams.lowContour);
    if (bbeLowNode && bbeParams.lowEnabled) {
      bbeLowNode.lowContourGainNode.gain.value =
        Math.pow(10, bbeParams.lowContour / 20) - 1;
    }
  }

  if (request.action === "changeBbeBassBoost") {
    bbeParams.bassBoost = parseFloat(request.value);
    localStorage.setItem("bbeBassBoost", bbeParams.bassBoost);
    if (bbeLowNode && bbeParams.lowEnabled) {
      bbeLowNode.bassBoostGainNode.gain.value =
        Math.pow(10, bbeParams.bassBoost / 20) - 1;
    }
  }

  if (request.action === "changeBbeProcess") {
    bbeParams.process = parseFloat(request.value);
    localStorage.setItem("bbeProcess", bbeParams.process);
    if (bbeProcessNode && bbeParams.processEnabled) {
      bbeProcessNode.processGainNode.gain.value =
        Math.pow(10, bbeParams.process / 20) - 1;
    }
  }

  if (request.action === "toggleBbeLow") {
    bbeParams.lowEnabled = request.value;
    localStorage.setItem("bbeLowEnabled", bbeParams.lowEnabled);
    location.reload();
  }

  if (request.action === "toggleBbeProcess") {
    bbeParams.processEnabled = request.value;
    localStorage.setItem("bbeProcessEnabled", bbeParams.processEnabled);
    location.reload();
  }
});

function getLowCut() {
  const lowCut = localStorage.getItem("lowCutFrequency");
  if (isNaN(Number(lowCut))) {
    return 30;
  }
  return Number(lowCut);
}
