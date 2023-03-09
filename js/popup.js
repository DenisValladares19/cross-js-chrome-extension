chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {
    action: "load-info",
  });
});

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
let isActive;

document.querySelector(".copyright").innerHTML = `&copy; DENIS VALLADARES ${new Date().getFullYear()}`

/**
 * Funcion para quitar o mostrar decimales de un
 * numero pasado por parametros
 * @param {Number} number
 * @param {Number} numDecimal numero de decimales que desea mostrar
 * @returns Number
 */
const deleteDecimal = (number, numDecimal = 0) => {
  if (number % 1 == 0) {
    return Number(number);
  } else {
    return Number(number).toFixed(numDecimal);
  }
};

/**
 * Funcion que crea las barras de cada frecuencia
 * definida en el array anterior
 */
let createBarraBand = () => {
  let contenedorFrecuencias = document.querySelector(".contenido");
  let html = ``;
  frecuencias.forEach((item, i) => {
    html += `
        <div class="bar">
            <span style="text-align: center; width: 80px; position: relative;left: -13px;" id="span-vol-${
              i + 1
            }">Vol: ${deleteDecimal(item.vol, 2)}</span>
            <input 
                type="range" 
                min="-10" 
                max="10" 
                step="0.00001" 
                class="range-vertical"
                value=${item.vol}
                id="band-${i + 1}"
            >
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

  // Altas frecuencias controles
  const inputFrecuenciaAlta = document.getElementById("frecuenciaAlta");
  const mostrarFrecuenciaAlta = document.getElementById("verFrecuenciaAlta");
  const inputGananciaAlta = document.getElementById("gananciaAlta");
  const mostrarGananciaAlta = document.getElementById("verGananciaAlta");
  // container del modal
  const modal = document.querySelector(".modal-container");
  const close = document.querySelector(".close");
  const open = document.querySelector(".iconEq");
  const btnCerrar = document.querySelector("#btn-cerrar");
  const btnReset = document.querySelector("#btn-reset");

  const switchStatus = document.querySelector("#status");

  switchStatus.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggle-status",
          value: !isActive
        });
      });
  });

  // creando las barras de ecualizacion
  createBarraBand();

  // mostrar el modal
  open.addEventListener("click", (e) => {
    modal.style.display = "block";
  });

  // cerrar el modal desde la "X"
  close.addEventListener("click", (e) => {
    modal.style.display = "none";
  });

  // cerrar modal desde el boton de cerrar
  btnCerrar.addEventListener("click", (e) => {
    modal.style.display = "none";
  });

  // resetear todo el ecualizador
  btnReset.addEventListener("click", (e) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "resetFrecuency",
      });
    });
    frecuencias.forEach((item, i) => {
      document.getElementById(`band-${i + 1}`).value = 0; // modificando el input para reflejar el cambio
      document.getElementById(`span-vol-${i + 1}`).innerText = `Vol: 0`; // modificando el span para reflejar que cambio el volumen
    });
  });

  // handle change of inputs range

  inputFrecuenciaBaja.addEventListener("change", (e) => {
    try {
      mostrarFrecuenciaBaja.innerText = deleteDecimal(e.target.value);
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "changeLowFrecuency",
          value: e.target.value,
        });
      });
    } catch (error) {
      console.log(error);
    }
  });

  inputFrecuenciaAlta.addEventListener("change", (e) => {
    try {
      mostrarFrecuenciaAlta.innerText = deleteDecimal(e.target.value);
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "changeHightFrecuency",
          value: e.target.value,
        });
      });
    } catch (error) {
      console.log(error);
    }
  });

  inputGananciaBaja.addEventListener("change", (e) => {
    try {
      mostrarGananciaBaja.innerText = deleteDecimal(e.target.value, 2);
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "changeLowGain",
          value: e.target.value,
        });
      });
    } catch (error) {
      console.log(error);
    }
  });

  inputGananciaAlta.addEventListener("change", (e) => {
    try {
      mostrarGananciaAlta.innerText = deleteDecimal(e.target.value, 2);
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "changeHightGain",
          value: e.target.value,
        });
      });
    } catch (error) {
      console.log(error);
    }
  });

  frecuencias.map((item, index) => {
    document
      .getElementById(`band-${index + 1}`)
      .addEventListener("change", function (e) {
        document.getElementById(
          `span-vol-${index + 1}`
        ).innerText = `Vol: ${deleteDecimal(e.target.value, 2)}`;

        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "changeBandFrecuency",
              value: e.target.value,
              index: index,
              frecuency: item.frecuencia,
            });
          }
        );
      });
  });
});

// listen for event from page message handler
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(request, "in popup window");

  if (request.action === "load-info") {
    const mostrarFrecuenciaBaja = document.getElementById("verFrecuenciaBaja");
    const mostrarGananciaBaja = document.getElementById("verGananciaBaja");
    const mostrarFrecuenciaAlta = document.getElementById("verFrecuenciaAlta");
    const mostrarGananciaAlta = document.getElementById("verGananciaAlta");
    const inputFrecuenciaBaja = document.getElementById("frecuenciaBaja");
    const inputGananciaBaja = document.getElementById("gananciaBaja");
    const inputFrecuenciaAlta = document.getElementById("frecuenciaAlta");
    const inputGananciaAlta = document.getElementById("gananciaAlta");
    const switchStatus = document.querySelector("#status");

    
    const {
        gananciaBaja,
        gananciaAlta,
        frecuenciaBaja,
        frecuenciaAlta,
        frecuencias: oldFrecuencies,
        isActive: active
    } = request;
    isActive = Boolean(active);
    switchStatus.className = `wrapper-switch ${isActive ? "active" : "disabled"}`;

    mostrarFrecuenciaBaja.innerText = deleteDecimal(frecuenciaBaja);
    inputFrecuenciaBaja.value = frecuenciaBaja;

    mostrarGananciaBaja.innerText = deleteDecimal(gananciaBaja, 2);
    inputGananciaBaja.value = gananciaBaja;

    mostrarFrecuenciaAlta.innerText = deleteDecimal(frecuenciaAlta);
    inputFrecuenciaAlta.value = frecuenciaAlta;

    mostrarGananciaAlta.innerText = deleteDecimal(gananciaAlta, 2);
    inputGananciaAlta.value = gananciaAlta;

    frecuencias = [...oldFrecuencies];

    frecuencias.forEach((item, i) => {
        document.getElementById(`band-${i + 1}`).value = item.vol; // modificando el input para reflejar el cambio
        document.getElementById(`span-vol-${i + 1}`).innerText = `Vol: ${deleteDecimal(item.vol, 2)}`; // modificando el span para reflejar que cambio el volumen
      });
  }
});
