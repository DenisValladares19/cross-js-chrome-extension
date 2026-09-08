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

// refuerzo de graves
let bigBottom;
let bbEnabled;
let bbTune;
let bbDrive;
let bbMix;
let bbHarmonics;

const BB_DEFAULTS = { bbTune: 80, bbDrive: 6, bbMix: 70, bbHarmonics: 0 };
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

  // refuerzo de graves
  bbTune = localStorage.getItem("bbTune") || BB_DEFAULTS.bbTune;
  bbDrive = localStorage.getItem("bbDrive") || BB_DEFAULTS.bbDrive;
  bbMix = localStorage.getItem("bbMix") || BB_DEFAULTS.bbMix;
  bbHarmonics = localStorage.getItem("bbHarmonics") || BB_DEFAULTS.bbHarmonics;
  bbEnabled = localStorage.getItem("bbEnabled") === "1";

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

  // addModule es asincrono. Armar el grafo dentro de su .then() evita el caso
  // en que el nodo del compresor no existe todavia y los controles del popup
  // no tienen nada que mover.
  loadBigBottomWorklet(
    ctx,
    chrome.runtime.getURL("js/worklets/opto-compressor.js"),
  )
    .catch((error) => {
      console.log("no se pudo cargar el worklet de refuerzo de graves", error);
    })
    .then(() => buildGraph(mediaElement));
};

const buildGraph = (mediaElement) => {
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

  // Refuerzo de graves al inicio de la cadena: la mono-izacion, el EQ, el
  // crossover y el low-cut parten de su salida.
  bigBottom = createBigBottom(ctx, {
    tune: Number(bbTune),
    drive: Number(bbDrive),
    mix: Number(bbMix),
    harmonics: Number(bbHarmonics),
    enabled: bbEnabled,
  });
  mediaElement.connect(bigBottom.input);

  // se conecta los dos separadores de canales al source
  bigBottom.output.connect(splitterLeft);
  bigBottom.output.connect(splitterRight);

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

  Object.keys(BB_DEFAULTS).forEach((key) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, BB_DEFAULTS[key]);
    }
  });

  if (!localStorage.getItem("bbEnabled")) {
    localStorage.setItem("bbEnabled", "0");
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
      bbEnabled,
      bbTune,
      bbDrive,
      bbMix,
      bbHarmonics,
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

  if (request.action === "toggleBigBottom") {
    bbEnabled = Boolean(request.value);
    localStorage.setItem("bbEnabled", bbEnabled ? "1" : "0");
    bigBottom?.setEnabled(bbEnabled);
  }

  if (request.action === "changeBbTune") {
    bbTune = request.value;
    localStorage.setItem("bbTune", bbTune);
    bigBottom?.setTune(bbTune);
  }

  if (request.action === "changeBbDrive") {
    bbDrive = request.value;
    localStorage.setItem("bbDrive", bbDrive);
    bigBottom?.setDrive(bbDrive);
  }

  if (request.action === "changeBbMix") {
    bbMix = request.value;
    localStorage.setItem("bbMix", bbMix);
    bigBottom?.setMix(bbMix);
  }

  if (request.action === "changeBbHarmonics") {
    bbHarmonics = request.value;
    localStorage.setItem("bbHarmonics", bbHarmonics);
    bigBottom?.setHarmonics(bbHarmonics);
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
