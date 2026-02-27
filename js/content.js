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

// Nodos del Procesador de Bajo y Tono
let bassProcessorNode;
let trebleAirNode;
let masterLimiter;

let processorParams = {
  bassBody: 0,
  trebleAir: 0,
  bassEnabled: true,
  trebleEnabled: true,
};

// Curva de saturación suave para dar "cuerpo" al bajo
function makeBassSaturationCurve() {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; i++) {
    const x = (i * 2) / n_samples - 1;
    if (x > 0) {
      curve[i] = Math.tanh(x * 1.2);
    } else {
      curve[i] = x * 0.8;
    }
  }
  return curve;
}

// Función para crear el procesador de bajo profundo
function createDeepBassNode(ctx, inputNode, options = {}) {
  const amount = options.amount || 0;
  const isEnabled = options.enabled !== undefined ? options.enabled : true;

  // Sidechain para el bajo
  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 150;
  lpf.Q.value = 1.0;

  // Realce de sub-bajo (Thump)
  const hump = ctx.createBiquadFilter();
  hump.type = "peaking";
  hump.frequency.value = 55;
  hump.Q.value = 2.0;
  hump.gain.value = isEnabled ? (amount / 100) * 10 : 0;

  // Saturador (Cuerpo/Armónicos)
  const saturator = ctx.createWaveShaper();
  saturator.curve = makeBassSaturationCurve();
  saturator.oversample = "4x";

  // Compresor de bajo para dar sustain/consistencia
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.ratio.value = 4;
  comp.attack.value = 0.02;
  comp.release.value = 0.15;

  // Ganancia del efecto
  const mixGain = ctx.createGain();
  mixGain.gain.value = isEnabled ? (amount / 100) * 1.5 : 0;

  const merger = ctx.createGain();

  // Dry path
  inputNode.connect(merger);

  // Wet path
  inputNode.connect(lpf);
  lpf.connect(hump);
  hump.connect(saturator);
  saturator.connect(comp);
  comp.connect(mixGain);
  mixGain.connect(merger);

  return {
    output: merger,
    hump: hump,
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

  // Treble Air Node (Claridad)
  trebleAirNode = ctx.createBiquadFilter();
  trebleAirNode.type = "highshelf";
  trebleAirNode.frequency.value = 8000;
  trebleAirNode.gain.value = processorParams.trebleEnabled ? (processorParams.trebleAir / 100) * 12 : 0;

  // Master Limiter (Evitar saturación)
  masterLimiter = ctx.createDynamicsCompressor();
  masterLimiter.threshold.value = -1;
  masterLimiter.knee.value = 0;
  masterLimiter.ratio.value = 20;
  masterLimiter.attack.value = 0.003;
  masterLimiter.release.value = 0.1;

  // filtro crossover
  lowFilter = createFilter({
    ctx,
    filterType: "LR",
    frequency: frecuenciaBaja,
    slope: 24,
    type: "lowpass",
  });

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

  let splitter = ctx.createChannelSplitter(2);
  let merger = ctx.createChannelMerger(2);

  gainLow.connect(lowFilter.input);
  gainHight.connect(hightFilter.input);

  for (i = 1; i < frecuencias.length; i++) {
    bands[i - 1].connect(bands[i]);
  }

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

  // Cadena: Media -> EQ -> Treble Air -> Splitter
  merge.connect(bands[0]);
  bands[frecuencias.length - 1].connect(trebleAirNode);
  trebleAirNode.connect(splitter);

  splitter.connect(gainLow, 0);
  splitter.connect(gainHight, 1);

  // Procesador de bajo aplicado a la rama de bajos
  bassProcessorNode = createDeepBassNode(ctx, lowFilter.output, {
    amount: processorParams.bassBody,
    enabled: processorParams.bassEnabled
  });

  bassProcessorNode.output.connect(merger, 0, 0);
  hightFilter.output.connect(merger, 0, 1);

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

  // Limiter final
  lowCutFilter[lowCutFilter.length - 1].connect(masterLimiter);
  masterLimiter.connect(ctx.destination);
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

  if (!localStorage.getItem("frecuenciaBaja")) localStorage.setItem("frecuenciaBaja", 85);
  if (!localStorage.getItem("gananciaBaja")) localStorage.setItem("gananciaBaja", 1);
  if (!localStorage.getItem("frecuenciaAlta")) localStorage.setItem("frecuenciaAlta", 85);
  if (!localStorage.getItem("gananciaAlta")) localStorage.setItem("gananciaAlta", 1);
  if (!localStorage.getItem("isActive")) localStorage.setItem("isActive", true);

  if (localStorage.getItem("processorBassBody") === null) localStorage.setItem("processorBassBody", 0);
  if (localStorage.getItem("processorTrebleAir") === null) localStorage.setItem("processorTrebleAir", 0);
  if (localStorage.getItem("processorBassEnabled") === null) localStorage.setItem("processorBassEnabled", true);
  if (localStorage.getItem("processorTrebleEnabled") === null) localStorage.setItem("processorTrebleEnabled", true);

  processorParams = {
    bassBody: parseFloat(localStorage.getItem("processorBassBody")),
    trebleAir: parseFloat(localStorage.getItem("processorTrebleAir")),
    bassEnabled: localStorage.getItem("processorBassEnabled") !== "false",
    trebleEnabled: localStorage.getItem("processorTrebleEnabled") !== "false",
  };
};

const resetFrequency = (index) => {
  let old = frecuencias.map((frequency) => {
    localStorage.setItem(`vol-frecuencia-${frequency.frecuencia}`, 0);
    return { ...frequency, vol: 0 };
  });
  frecuencias = [...old];
  bands.forEach((band) => {
    if (band.gain && band.gain.value) band.gain.value = 0;
  });
};

// listen for events
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
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

    processorParams = {
      bassBody: parseFloat(localStorage.getItem("processorBassBody")) || 0,
      trebleAir: parseFloat(localStorage.getItem("processorTrebleAir")) || 0,
      bassEnabled: localStorage.getItem("processorBassEnabled") !== "false",
      trebleEnabled: localStorage.getItem("processorTrebleEnabled") !== "false",
    };

    chrome.runtime.sendMessage({
      action: "load-info",
      gananciaBaja,
      gananciaAlta,
      frecuenciaBaja,
      frecuenciaAlta,
      frecuencias: [...old],
      isActive: isActive,
      processorParams: processorParams,
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
    lowFilter?.filters?.forEach((f) => (f.frequency.value = request.value));
    localStorage.setItem("frecuenciaBaja", frecuenciaBaja);
  }

  if (request.action === "changeHightFrecuency") {
    frecuenciaAlta = request.value;
    hightFilter?.filters?.forEach((f) => (f.frequency.value = request.value));
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
    frecuencias = frecuencias.map((item) => item.frecuencia === frecuency ? { ...item, vol: value } : item);
    bands.forEach((band) => {
      if (band.frequency.value === frecuency) band.gain.value = value;
    });
    localStorage.setItem(`vol-frecuencia-${frecuency}`, value);
  }

  if (request.action === "changeBassBody") {
    processorParams.bassBody = parseFloat(request.value);
    localStorage.setItem("processorBassBody", processorParams.bassBody);
    if (bassProcessorNode && processorParams.bassEnabled) {
      bassProcessorNode.hump.gain.value = (processorParams.bassBody / 100) * 10;
      bassProcessorNode.mixGain.gain.value = (processorParams.bassBody / 100) * 1.5;
    }
  }

  if (request.action === "changeTrebleAir") {
    processorParams.trebleAir = parseFloat(request.value);
    localStorage.setItem("processorTrebleAir", processorParams.trebleAir);
    if (trebleAirNode && processorParams.trebleEnabled) {
      trebleAirNode.gain.value = (processorParams.trebleAir / 100) * 12;
    }
  }

  if (request.action === "toggleBassBody") {
    processorParams.bassEnabled = request.value;
    localStorage.setItem("processorBassEnabled", processorParams.bassEnabled);
    if (bassProcessorNode) {
      bassProcessorNode.hump.gain.value = processorParams.bassEnabled ? (processorParams.bassBody / 100) * 10 : 0;
      bassProcessorNode.mixGain.gain.value = processorParams.bassEnabled ? (processorParams.bassBody / 100) * 1.5 : 0;
    }
  }

  if (request.action === "toggleTrebleAir") {
    processorParams.trebleEnabled = request.value;
    localStorage.setItem("processorTrebleEnabled", processorParams.trebleEnabled);
    if (trebleAirNode) {
      trebleAirNode.gain.value = processorParams.trebleEnabled ? (processorParams.trebleAir / 100) * 12 : 0;
    }
  }
});

function getLowCut() {
  const lowCut = localStorage.getItem("lowCutFrequency");
  if (isNaN(Number(lowCut))) return 30;
  return Number(lowCut);
}
