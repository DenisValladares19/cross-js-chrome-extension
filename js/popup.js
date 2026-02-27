chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {
    action: "load-info",
  });
});

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
let isActive;

document.querySelector(
  ".copyright"
).innerHTML = `&copy; DENIS VALLADARES ${new Date().getFullYear()}`;

const deleteDecimal = (number, numDecimal = 0) => {
  if (number % 1 == 0) return Number(number);
  return Number(number).toFixed(numDecimal);
};

let createBarraBand = () => {
  let contenedorFrecuencias = document.querySelector(".contenido");
  let html = ``;
  frecuencias.forEach((item, i) => {
    html += `
        <div class="bar">
            <span style="text-align: center; width: 80px; position: relative;left: -13px;" id="span-vol-${i + 1}">Vol: ${deleteDecimal(item.vol, 2)}</span>
            <input type="range" min="-12" max="12" step="0.00001" class="range-vertical" value=${item.vol} id="band-${i + 1}">
            <span>${item.frecuencia}Hz</span>
          </div>
    `;
  });
  contenedorFrecuencias.innerHTML = html;
};

window.addEventListener("DOMContentLoaded", () => {
  const inputFrecuenciaBaja = document.getElementById("frecuenciaBaja");
  const inputGananciaBaja = document.getElementById("gananciaBaja");
  const mostrarFrecuenciaBaja = document.getElementById("verFrecuenciaBaja");
  const mostrarGananciaBaja = document.getElementById("verGananciaBaja");

  const inputFrecuenciaAlta = document.getElementById("frecuenciaAlta");
  const mostrarFrecuenciaAlta = document.getElementById("verFrecuenciaAlta");
  const inputGananciaAlta = document.getElementById("gananciaAlta");
  const mostrarGananciaAlta = document.getElementById("verGananciaAlta");

  const inputBassBody = document.getElementById("bassBody");
  const inputTrebleAir = document.getElementById("trebleAir");
  const checkBassBody = document.getElementById("enableBassBody");
  const checkTrebleAir = document.getElementById("enableTrebleAir");
  const verBassBody = document.getElementById("verBassBody");
  const verTrebleAir = document.getElementById("verTrebleAir");

  const modal = document.querySelector(".modal-container");
  const close = document.querySelector(".close");
  const open = document.querySelector(".iconEq");
  const btnCerrar = document.querySelector("#btn-cerrar");
  const btnReset = document.querySelector("#btn-reset");

  const switchStatus = document.querySelector("#status");

  switchStatus.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggle-status",
        value: !isActive,
      });
    });
  });

  createBarraBand();

  open.addEventListener("click", () => modal.style.display = "block");
  close.addEventListener("click", () => modal.style.display = "none");
  btnCerrar.addEventListener("click", () => modal.style.display = "none");

  btnReset.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "resetFrecuency" });
    });
    frecuencias.forEach((item, i) => {
      document.getElementById(`band-${i + 1}`).value = 0;
      document.getElementById(`span-vol-${i + 1}`).innerText = `Vol: 0`;
    });
  });

  inputFrecuenciaBaja.addEventListener("change", (e) => {
    mostrarFrecuenciaBaja.innerText = deleteDecimal(e.target.value);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "changeLowFrecuency", value: e.target.value });
    });
  });

  inputFrecuenciaAlta.addEventListener("change", (e) => {
    mostrarFrecuenciaAlta.innerText = deleteDecimal(e.target.value);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "changeHightFrecuency", value: e.target.value });
    });
  });

  inputGananciaBaja.addEventListener("change", (e) => {
    mostrarGananciaBaja.innerText = deleteDecimal(e.target.value, 2);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "changeLowGain", value: e.target.value });
    });
  });

  inputGananciaAlta.addEventListener("change", (e) => {
    mostrarGananciaAlta.innerText = deleteDecimal(e.target.value, 2);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "changeHightGain", value: e.target.value });
    });
  });

  inputBassBody.addEventListener("input", (e) => {
    verBassBody.innerText = e.target.value;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "changeBassBody", value: e.target.value });
    });
  });

  inputTrebleAir.addEventListener("input", (e) => {
    verTrebleAir.innerText = e.target.value;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "changeTrebleAir", value: e.target.value });
    });
  });

  checkBassBody.addEventListener("change", (e) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "toggleBassBody", value: e.target.checked });
    });
  });

  checkTrebleAir.addEventListener("change", (e) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "toggleTrebleAir", value: e.target.checked });
    });
  });

  frecuencias.forEach((item, index) => {
    document.getElementById(`band-${index + 1}`).addEventListener("change", function (e) {
      document.getElementById(`span-vol-${index + 1}`).innerText = `Vol: ${deleteDecimal(e.target.value, 2)}`;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "changeBandFrecuency", value: e.target.value, index, frecuency: item.frecuencia });
      });
    });
  });
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "load-info") {
    const { gananciaBaja, gananciaAlta, frecuenciaBaja, frecuenciaAlta, frecuencias: oldFrecuencies, isActive: active, processorParams } = request;
    isActive = Boolean(active);
    document.querySelector("#status").className = `wrapper-switch ${isActive ? "active" : "disabled"}`;

    document.getElementById("verFrecuenciaBaja").innerText = deleteDecimal(frecuenciaBaja);
    document.getElementById("frecuenciaBaja").value = frecuenciaBaja;
    document.getElementById("verGananciaBaja").innerText = deleteDecimal(gananciaBaja, 2);
    document.getElementById("gananciaBaja").value = gananciaBaja;
    document.getElementById("verFrecuenciaAlta").innerText = deleteDecimal(frecuenciaAlta);
    document.getElementById("frecuenciaAlta").value = frecuenciaAlta;
    document.getElementById("verGananciaAlta").innerText = deleteDecimal(gananciaAlta, 2);
    document.getElementById("gananciaAlta").value = gananciaAlta;

    if (processorParams) {
      document.getElementById("bassBody").value = processorParams.bassBody;
      document.getElementById("trebleAir").value = processorParams.trebleAir;
      document.getElementById("verBassBody").innerText = processorParams.bassBody;
      document.getElementById("verTrebleAir").innerText = processorParams.trebleAir;
      document.getElementById("enableBassBody").checked = processorParams.bassEnabled;
      document.getElementById("enableTrebleAir").checked = processorParams.trebleEnabled;
    }

    frecuencias = [...oldFrecuencies];
    frecuencias.forEach((item, i) => {
      document.getElementById(`band-${i + 1}`).value = item.vol;
      document.getElementById(`span-vol-${i + 1}`).innerText = `Vol: ${deleteDecimal(item.vol, 2)}`;
    });
  }
});
