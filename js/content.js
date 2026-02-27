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

// Nodos de Control de Tono
let bassToneNode;
let trebleToneNode;

let toneParams = {
  bassGain: 0,
  trebleGain: 0,
};

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

  // Configuración de Control de Tono (Simil Poweramp)
  // LowShelf para graves profundos
  bassToneNode = ctx.createBiquadFilter();
  bassToneNode.type = "lowshelf";
  bassToneNode.frequency.value = 80; // Frecuencia para graves más profundos (simil Poweramp)
  bassToneNode.gain.value = toneParams.bassGain;

  // HighShelf para agudos
  trebleToneNode = ctx.createBiquadFilter();
  trebleToneNode.type = "highshelf";
  trebleToneNode.frequency.value = 5000; // Frecuencia típica para claridad
  trebleToneNode.gain.value = toneParams.trebleGain;

  // filtro pasa bajo crossover
  lowFilter = createFilter({
    ctx,
    filterType: "LR",
    frequency: frecuenciaBaja,
    slope: 24,
    type: "lowpass",
  });

  // filtro pasa alto crossover
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

  // Conexión del grafo: media -> EQ -> Tone Control -> Crossover
  merge.connect(bands[0]);
  bands[frecuencias.length - 1].connect(bassToneNode);
  bassToneNode.connect(trebleToneNode);
  trebleToneNode.connect(splitter);

  splitter.connect(gainLow, 0);
  splitter.connect(gainHight, 1);

  lowFilter.output.connect(merger, 0, 0);
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

  // Inicialización de tonos
  if (localStorage.getItem("toneBassGain") === null) {
    localStorage.setItem("toneBassGain", 0);
  }
  if (localStorage.getItem("toneTrebleGain") === null) {
    localStorage.setItem("toneTrebleGain", 0);
  }

  toneParams = {
    bassGain: parseFloat(localStorage.getItem("toneBassGain")),
    trebleGain: parseFloat(localStorage.getItem("toneTrebleGain")),
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

    toneParams = {
      bassGain: parseFloat(localStorage.getItem("toneBassGain")) || 0,
      trebleGain: parseFloat(localStorage.getItem("toneTrebleGain")) || 0,
    };

    chrome.runtime.sendMessage({
      action: "load-info",
      gananciaBaja,
      gananciaAlta,
      frecuenciaBaja,
      frecuenciaAlta,
      frecuencias: [...old],
      isActive: isActive,
      toneParams: toneParams,
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

  // Mensajes para Control de Tono
  if (request.action === "changeBassTone") {
    toneParams.bassGain = parseFloat(request.value);
    localStorage.setItem("toneBassGain", toneParams.bassGain);
    if (bassToneNode) {
      bassToneNode.gain.value = toneParams.bassGain;
    }
  }

  if (request.action === "changeTrebleTone") {
    toneParams.trebleGain = parseFloat(request.value);
    localStorage.setItem("toneTrebleGain", toneParams.trebleGain);
    if (trebleToneNode) {
      trebleToneNode.gain.value = toneParams.trebleGain;
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
