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

// Función para crear filtros LR o Butterworth parametrizables
function createFilter({
  type = "highpass",
  frequency = 1000,
  slope = 24,
  filterType = "LR",
  ctx,
}) {
  const stages = slope / 6;

  const Q_TABLES = {
    LR: {
      2: [0.5],
      4: [0.7071, 0.7071],
      8: [0.5412, 1.3066, 0.5412, 1.3066],
    },
    butterworth: {
      2: [0.7071],
      4: [0.5412, 1.3066],
      8: [0.5098, 0.6013, 0.8999, 2.5629],
    },
  };

  const qValues = Q_TABLES[filterType]?.[stages];

  if (!qValues) {
    throw new Error(
      `Combinación no soportada: filterType="${filterType}", slope=${slope} dB/oct`,
    );
  }

  const filters = qValues.map((q) => {
    const filter = ctx.createBiquadFilter();
    filter.type = type;

    // Scheduled en el tiempo actual — sin clicks
    filter.frequency.setValueAtTime(frequency, ctx.currentTime);
    filter.Q.setValueAtTime(q, ctx.currentTime);
    filter.gain.setValueAtTime(0, ctx.currentTime);

    return filter;
  });

  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }

  return {
    input: filters[0],
    output: filters[filters.length - 1],
    filters,
  };
}

// Create filters
let hightFilter;

let lowFilter;

let profundidadGraves = 30;
let bassDepthNodes = null;
let masterGain = null;
let audioGraphBuilt = false;

/**
 * Curva sigmoide para WaveShaperNode (patrón MDN).
 * drive 0–100: cuánta distorsión / armónicos generar.
 */
function makeHarmonicCurve(drive = 50, samples = 2048) {
  const k = drive;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Aplica el % de profundidad de graves a los nodos (si el grafo ya existe).
 * Solo afecta la ruta de graves (gainLow); masterGain compensa el nivel total.
 */
function applyBassDepth(percent) {
  if (!bassDepthNodes) return;

  const wet = (percent / 100) * 0.7;
  const drive = 20 + (percent / 100) * 60;
  const master = 1 / (1 + wet * 0.35);
  const t = bassDepthNodes.ctx.currentTime;

  bassDepthNodes.enhancerMix.gain.setTargetAtTime(wet, t, 0.02);
  bassDepthNodes.masterGain.gain.setTargetAtTime(master, t, 0.02);
  bassDepthNodes.shaper.curve = makeHarmonicCurve(drive);
}

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

  // El grafo se construye una sola vez: createMediaElementSource() falla
  // si se vuelve a llamar sobre el mismo elemento <video>.
  if (audioGraphBuilt) {
    if (typeof ctx !== "undefined" && ctx.state === "suspended") ctx.resume();
    return;
  }
  audioGraphBuilt = true;

  const savedDepth = localStorage.getItem("profundidadGraves");
  if (savedDepth !== null && savedDepth !== "" && !isNaN(Number(savedDepth))) {
    profundidadGraves = Math.min(100, Math.max(0, Number(savedDepth)));
  } else {
    profundidadGraves = 30;
  }

  const audioElement = document.querySelector("video");

  const Context = window.webkitAudioContext
    ? window.webkitAudioContext
    : window.AudioContext;
  ctx = new Context();
  if (ctx.state === "suspended") ctx.resume();
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

  // Dry: graves y agudos por separado
  gainLow.connect(lowFilter.input);
  gainHight.connect(hightFilter.input);

  // ---- Profundidad de graves (solo canal de graves) ----
  const bassBandFilter = ctx.createBiquadFilter();
  bassBandFilter.type = "lowpass";
  bassBandFilter.frequency.value = 80;
  bassBandFilter.Q.value = Math.SQRT1_2;

  const shaper = ctx.createWaveShaper();
  shaper.oversample = "4x";
  shaper.curve = makeHarmonicCurve(20);

  const harmonicsLowpass = ctx.createBiquadFilter();
  harmonicsLowpass.type = "lowpass";
  harmonicsLowpass.frequency.value = 80;
  harmonicsLowpass.Q.value = Math.SQRT1_2;

  const harmonicsHighpass = ctx.createBiquadFilter();
  harmonicsHighpass.type = "highpass";
  harmonicsHighpass.frequency.value = 50;
  harmonicsHighpass.Q.value = Math.SQRT1_2;

  const enhancerMix = ctx.createGain();
  enhancerMix.gain.value = 0;

  masterGain = ctx.createGain();
  masterGain.gain.value = 1;

  bassDepthNodes = {
    ctx,
    bassBandFilter,
    shaper,
    harmonicsLowpass,
    harmonicsHighpass,
    enhancerMix,
    masterGain,
  };

  // Profundidad SOLO en graves (paralelo a lowFilter → merger ch0)
  gainLow.connect(bassBandFilter);
  bassBandFilter.connect(shaper);
  shaper.connect(harmonicsLowpass);
  harmonicsLowpass.connect(harmonicsHighpass);
  harmonicsHighpass.connect(enhancerMix);
  enhancerMix.connect(merger, 0, 0);

  applyBassDepth(profundidadGraves);

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
  splitterRight.connect(mergeRight, 1, 0);
  splitterRight.connect(mergeRight, 1, 0);

  // uniendo los dos canales L y R en uno solo que sera L
  splitterLeft.connect(mergeLeft, 0, 1);
  splitterLeft.connect(mergeLeft, 0, 1);

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

  lowFilter.output.connect(merger, 0, 0);
  hightFilter.output.connect(merger, 0, 1);

  /**
   * 4: [0.5412, 1.3066],
   * 8: [0.5098, 0.6013, 0.8999, 2.5629],
   */
  const Q_BUTTERWORTH_4TH = [0.5412, 1.3066];

  let lowCutFilter = Q_BUTTERWORTH_4TH.map((q) => {
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = "highpass";
    lowCut.frequency.value = getLowCut();
    lowCut.Q.value = q;
    return lowCut;
  });

  merger.connect(lowCutFilter[0]);
  lowCutFilter.forEach((filter, index) => {
    if (index < lowCutFilter.length - 1) {
      filter.connect(lowCutFilter[index + 1]);
    }
  });
  lowCutFilter[lowCutFilter.length - 1].connect(masterGain);
  masterGain.connect(ctx.destination);
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

  if (!localStorage.getItem("profundidadGraves")) {
    localStorage.setItem("profundidadGraves", 30);
  }
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

    chrome.runtime.sendMessage({
      action: "load-info",
      gananciaBaja,
      gananciaAlta,
      frecuenciaBaja,
      frecuenciaAlta,
      frecuencias: [...old],
      isActive: isActive,
      profundidadGraves: (() => {
        const saved = localStorage.getItem("profundidadGraves");
        if (saved !== null && saved !== "" && !isNaN(Number(saved))) {
          return Math.min(100, Math.max(0, Number(saved)));
        }
        return profundidadGraves ?? 30;
      })(),
    });
  }

  if (request.action === "resetFrecuency") {
    resetFrequency();
  }

  if (request.action === "changeProfundidad") {
    profundidadGraves = Math.min(100, Math.max(0, Number(request.value)));
    localStorage.setItem("profundidadGraves", String(profundidadGraves));
    applyBassDepth(profundidadGraves);
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
});

function getLowCut() {
  const lowCut = localStorage.getItem("lowCutFrequency");
  if (isNaN(Number(lowCut))) {
    return 30;
  }
  return Number(lowCut);
}
