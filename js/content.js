let frecuencias = [
  { frecuencia: 32, vol: 0 },
  { frecuencia: 63, vol: 0 },
  { frecuencia: 125, vol: 0 },
  { frecuencia: 250, vol: 0 },
  { frecuencia: 500, vol: 0 },
  { frecuencia: 1000, vol: 0 },
  { frecuencia: 2000, vol: 0 },
  { frecuencia: 4000, vol: 0 },
  { frecuencia: 8000, vol: 0 },
  { frecuencia: 16000, vol: 0 },
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
let lowPassFilter;
let hightPassFilter;

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
    bands[index].Q.value = 1.4;
    bands[index].gain.value = item.vol;
  });

  // filtro pasa bajo
  lowPassFilter = ctx.createBiquadFilter();
  lowPassFilter.frequency.value = frecuenciaBaja;

  // filtro pasa alto
  hightPassFilter = ctx.createBiquadFilter();
  hightPassFilter.type = "highpass";
  hightPassFilter.frequency.value = frecuenciaAlta;

  // ganacia por canal
  gainLow = ctx.createGain();
  gainLow.gain.value = gananciaBaja;

  gainHight = ctx.createGain();
  gainHight.gain.value = gananciaAlta;
  // separar los canales
  let spliter = ctx.createChannelSplitter(2);

  // unir los canales
  let merger = ctx.createChannelMerger(2);

  gainLow.connect(lowPassFilter);
  gainHight.connect(hightPassFilter);

  for (i = 1; i < 10; i++) {
    bands[i - 1].connect(bands[i]);
  }

  mediaElement.connect(bands[0]);
  // asignando los filtros a cada canal
  bands[9].connect(spliter);

  spliter.connect(gainLow, 0);
  spliter.connect(gainHight, 1);

  lowPassFilter.connect(merger, 0, 0);
  hightPassFilter.connect(merger, 0, 1);

  merger.connect(ctx.destination);
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
    lowPassFilter.frequency.value = request.value;
    localStorage.setItem("frecuenciaBaja", frecuenciaBaja);
  }

  if (request.action === "changeHightFrecuency") {
    frecuenciaAlta = request.value;
    hightPassFilter.frequency.value = request.value;
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
