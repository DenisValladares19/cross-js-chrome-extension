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

// variables para los nodos de Aphex
let exciterNode;
let bigBottomNode;

// Parámetros Aphex
let aphexParams = {
  exciterTune: 3000,
  exciterMix: 0,
  exciterEnabled: true,
  bigBottomTune: 80,
  bigBottomDrive: 0,
  bigBottomMix: 0,
  bigBottomEnabled: true,
};

// Implementación simplificada de la curva para armónicos
function makeExciterCurve() {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; i++) {
    const x = (i * 2) / n_samples - 1;
    // Generación asimétrica: para x > 0 aplicamos una no-linealidad suave
    // Esto genera armónicos pares e impares
    if (x > 0) {
      curve[i] = Math.tanh(x * 1.5) / Math.tanh(1.5);
    } else {
      // Para x < 0, mantenemos más linealidad o una curva diferente
      curve[i] = x * 0.9;
    }
  }
  return curve;
}

// Función para crear el módulo Aphex Aural Exciter
function createAphexExciterNode(ctx, inputNode, options = {}) {
  const tune = options.tune || 3000;
  const mix = options.mix || 0;
  const isEnabled = options.enabled !== undefined ? options.enabled : true;

  // Filtro pasa-alto para el sidechain
  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = tune;
  hpf.Q.value = 0.707;

  // Generador de armónicos
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeExciterCurve();
  shaper.oversample = "4x";

  // Control de mezcla
  const mixGain = ctx.createGain();
  mixGain.gain.value = isEnabled ? Math.pow(10, mix / 20) - 1 : 0;
  if (mixGain.gain.value < 0) mixGain.gain.value = 0;

  const merger = ctx.createGain();

  // Conexión Dry
  inputNode.connect(merger);

  // Conexión Sidechain (Exciter)
  inputNode.connect(hpf);
  hpf.connect(shaper);
  shaper.connect(mixGain);
  mixGain.connect(merger);

  return {
    output: merger,
    hpf: hpf,
    mixGain: mixGain,
  };
}

// Función para crear el módulo Aphex Big Bottom
function createAphexBigBottomNode(ctx, inputNode, options = {}) {
  const tune = options.tune || 80;
  const drive = options.drive || 0;
  const mix = options.mix || 0;
  const isEnabled = options.enabled !== undefined ? options.enabled : true;

  // Filtro pasa-bajo para el sidechain
  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = tune;
  lpf.Q.value = 0.707;

  // Drive (intensidad de entrada al compresor)
  const driveGain = ctx.createGain();
  driveGain.gain.value = Math.pow(10, drive / 20);

  // Compresor (Simulando comportamiento óptico)
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.01; // 10ms
  compressor.release.value = 0.1; // 100ms

  // Control de mezcla
  const mixGain = ctx.createGain();
  mixGain.gain.value = isEnabled ? Math.pow(10, mix / 20) - 1 : 0;
  if (mixGain.gain.value < 0) mixGain.gain.value = 0;

  const merger = ctx.createGain();

  // Conexión Dry
  inputNode.connect(merger);

  // Conexión Sidechain (Big Bottom)
  inputNode.connect(lpf);
  lpf.connect(driveGain);
  driveGain.connect(compressor);
  compressor.connect(mixGain);
  mixGain.connect(merger);

  return {
    output: merger,
    lpf: lpf,
    driveGain: driveGain,
    mixGain: mixGain,
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

  // filtro pasa alto
  hightFilter = createFilter({
    ctx,
    filterType: "LR",
    frequency: frecuenciaAlta,
    slope: 24,
    type: "highpass",
  });

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
  const splitterRight = ctx.createChannelSplitter(2);
  const mergeRight = ctx.createChannelMerger(2);

  const splitterLeft = ctx.createChannelSplitter(2);
  const mergeLeft = ctx.createChannelMerger(2);

  const merge = ctx.createChannelMerger(2);

  mediaElement.connect(splitterLeft);
  mediaElement.connect(splitterRight);

  splitterRight.connect(mergeRight, 0, 1);
  splitterRight.connect(mergeRight, 0, 1);

  splitterLeft.connect(mergeLeft, 1, 0);
  splitterLeft.connect(mergeLeft, 1, 0);

  mergeLeft.connect(merge, 0, 0);
  mergeRight.connect(merge, 0, 1);

  merge.connect(bands[0]);

  bands[frecuencias.length - 1].connect(splitter);

  splitter.connect(gainLow, 0);
  splitter.connect(gainHight, 1);

  // Integración de Aphex Aural Exciter y Big Bottom
  bigBottomNode = createAphexBigBottomNode(ctx, lowFilter.output, {
    tune: aphexParams.bigBottomTune,
    drive: aphexParams.bigBottomDrive,
    mix: aphexParams.bigBottomMix,
    enabled: aphexParams.bigBottomEnabled,
  });

  exciterNode = createAphexExciterNode(ctx, hightFilter.output, {
    tune: aphexParams.exciterTune,
    mix: aphexParams.exciterMix,
    enabled: aphexParams.exciterEnabled,
  });

  bigBottomNode.output.connect(merger, 0, 0);
  exciterNode.output.connect(merger, 0, 1);

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

  // Inicialización de parámetros Aphex
  if (localStorage.getItem("aphexExciterTune") === null) {
    localStorage.setItem("aphexExciterTune", 3000);
  }
  if (localStorage.getItem("aphexExciterMix") === null) {
    localStorage.setItem("aphexExciterMix", 0);
  }
  if (localStorage.getItem("aphexExciterEnabled") === null) {
    localStorage.setItem("aphexExciterEnabled", true);
  }
  if (localStorage.getItem("aphexBigBottomTune") === null) {
    localStorage.setItem("aphexBigBottomTune", 80);
  }
  if (localStorage.getItem("aphexBigBottomDrive") === null) {
    localStorage.setItem("aphexBigBottomDrive", 0);
  }
  if (localStorage.getItem("aphexBigBottomMix") === null) {
    localStorage.setItem("aphexBigBottomMix", 0);
  }
  if (localStorage.getItem("aphexBigBottomEnabled") === null) {
    localStorage.setItem("aphexBigBottomEnabled", true);
  }

  aphexParams = {
    exciterTune: parseFloat(localStorage.getItem("aphexExciterTune")),
    exciterMix: parseFloat(localStorage.getItem("aphexExciterMix")),
    exciterEnabled: localStorage.getItem("aphexExciterEnabled") !== "false",
    bigBottomTune: parseFloat(localStorage.getItem("aphexBigBottomTune")),
    bigBottomDrive: parseFloat(localStorage.getItem("aphexBigBottomDrive")),
    bigBottomMix: parseFloat(localStorage.getItem("aphexBigBottomMix")),
    bigBottomEnabled: localStorage.getItem("aphexBigBottomEnabled") !== "false",
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

    aphexParams = {
      exciterTune: parseFloat(localStorage.getItem("aphexExciterTune")) || 3000,
      exciterMix: parseFloat(localStorage.getItem("aphexExciterMix")) || 0,
      exciterEnabled: localStorage.getItem("aphexExciterEnabled") !== "false",
      bigBottomTune: parseFloat(localStorage.getItem("aphexBigBottomTune")) || 80,
      bigBottomDrive: parseFloat(localStorage.getItem("aphexBigBottomDrive")) || 0,
      bigBottomMix: parseFloat(localStorage.getItem("aphexBigBottomMix")) || 0,
      bigBottomEnabled: localStorage.getItem("aphexBigBottomEnabled") !== "false",
    };

    chrome.runtime.sendMessage({
      action: "load-info",
      gananciaBaja,
      gananciaAlta,
      frecuenciaBaja,
      frecuenciaAlta,
      frecuencias: [...old],
      isActive: isActive,
      aphexParams: aphexParams,
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
    lowFilter?.filters?.forEach(
      (filter) => (filter.frequency.value = request.value),
    );
    localStorage.setItem("frecuenciaBaja", frecuenciaBaja);
  }

  if (request.action === "changeHightFrecuency") {
    frecuenciaAlta = request.value;
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

  // Mensajes para Aphex
  if (request.action === "changeAphexExciterTune") {
    aphexParams.exciterTune = parseFloat(request.value);
    localStorage.setItem("aphexExciterTune", aphexParams.exciterTune);
    if (exciterNode) {
      exciterNode.hpf.frequency.value = aphexParams.exciterTune;
    }
  }

  if (request.action === "changeAphexExciterMix") {
    aphexParams.exciterMix = parseFloat(request.value);
    localStorage.setItem("aphexExciterMix", aphexParams.exciterMix);
    if (exciterNode && aphexParams.exciterEnabled) {
      let g = Math.pow(10, aphexParams.exciterMix / 20) - 1;
      exciterNode.mixGain.gain.value = g < 0 ? 0 : g;
    }
  }

  if (request.action === "toggleAphexExciter") {
    aphexParams.exciterEnabled = request.value;
    localStorage.setItem("aphexExciterEnabled", aphexParams.exciterEnabled);
    if (exciterNode) {
      let g = aphexParams.exciterEnabled ? Math.pow(10, aphexParams.exciterMix / 20) - 1 : 0;
      exciterNode.mixGain.gain.value = g < 0 ? 0 : g;
    }
  }

  if (request.action === "changeAphexBigBottomTune") {
    aphexParams.bigBottomTune = parseFloat(request.value);
    localStorage.setItem("aphexBigBottomTune", aphexParams.bigBottomTune);
    if (bigBottomNode) {
      bigBottomNode.lpf.frequency.value = aphexParams.bigBottomTune;
    }
  }

  if (request.action === "changeAphexBigBottomDrive") {
    aphexParams.bigBottomDrive = parseFloat(request.value);
    localStorage.setItem("aphexBigBottomDrive", aphexParams.bigBottomDrive);
    if (bigBottomNode) {
      bigBottomNode.driveGain.gain.value = Math.pow(10, aphexParams.bigBottomDrive / 20);
    }
  }

  if (request.action === "changeAphexBigBottomMix") {
    aphexParams.bigBottomMix = parseFloat(request.value);
    localStorage.setItem("aphexBigBottomMix", aphexParams.bigBottomMix);
    if (bigBottomNode && aphexParams.bigBottomEnabled) {
      let g = Math.pow(10, aphexParams.bigBottomMix / 20) - 1;
      bigBottomNode.mixGain.gain.value = g < 0 ? 0 : g;
    }
  }

  if (request.action === "toggleAphexBigBottom") {
    aphexParams.bigBottomEnabled = request.value;
    localStorage.setItem("aphexBigBottomEnabled", aphexParams.bigBottomEnabled);
    if (bigBottomNode) {
      let g = aphexParams.bigBottomEnabled ? Math.pow(10, aphexParams.bigBottomMix / 20) - 1 : 0;
      bigBottomNode.mixGain.gain.value = g < 0 ? 0 : g;
    }
  }
});

function getLowCut() {
  const lowCut = localStorage.getItem("lowCutFrequency");
  if (isNaN(Number(lowCut))) {
    return 30;
  }
  return Number(lowCut);
}
