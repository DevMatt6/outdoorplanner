export const TIPOLOGIE = ["Arredo Urbano", "Poster Standard", "Totem Digitale", "Progetto Speciale"];

export const FORMATI = ["6x3", "MUPI 120x180", "4x3", '75" LED', '55" LED', "Pensilina 200x100", "Maxi Ledwall", "Banner verticale", "Cartellone stradale", "Su misura"];

export const OPZIONI_TIPOLOGIA = {
  "Poster Standard": [
    { id: "formato", label: "Formato", tipo: "select", opzioni: ["6x3", "4x3", "Banner verticale", "Cartellone stradale"] },
    { id: "quantita", label: "Quantità impianti", tipo: "number" },
    { id: "orientamento", label: "Orientamento", tipo: "select", opzioni: ["Orizzontale", "Verticale"] },
  ],
  "Arredo Urbano": [
    { id: "formato", label: "Formato", tipo: "select", opzioni: ["MUPI 120x180", "Pensilina 200x100"] },
    { id: "quantita", label: "Quantità impianti", tipo: "number" },
  ],
  "Totem Digitale": [
    { id: "formato", label: "Formato", tipo: "select", opzioni: ['55" LED', '75" LED', "Maxi Ledwall"] },
    { id: "secondi_spot", label: "Durata spot (sec)", tipo: "select", opzioni: ["15", "30", "60"] },
  ],
  "Progetto Speciale": [
    { id: "superficie_mq", label: "Superficie (mq)", tipo: "number" },
    { id: "tipo_occupazione", label: "Tipo occupazione", tipo: "select", opzioni: ["Gazebo", "Palco", "Dehors", "Altro"] },
  ],
};

export const opzioniLabel = (opzioni = {}) =>
  Object.entries(opzioni).filter(([k]) => k !== "formato").map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" · ");
