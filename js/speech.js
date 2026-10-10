// Speaking the mantra and the syllables, shared by the reading page, the about
// page and the static pages. It uses the browser's built-in speech voice (no
// audio files). Speech engines guess at unfamiliar words, so each syllable is
// respelled the way it is said; edit a value here to change how it sounds.
const SAY = {
  mantra: "Om, Ah, Rah, Pah, Tsah, Nah, Dee",
  a: "Ah",
  ra: "Rah",
  pa: "Pah",
  tsa: "Tsah",
  na: "Nah",
  dhi: "Dee",
};

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

const speakSay = (key, e) => {
  if (e) e.stopPropagation(); // do not open the panel behind the button
  if (!canSpeak) return;
  const u = new SpeechSynthesisUtterance(SAY[key] || key);
  u.rate = key === "mantra" ? 0.7 : 0.8;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
};

const sayKey = (key, e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    speakSay(key, e);
  }
};

const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';

// a speaker <button>; returns "" when the browser cannot speak
const sayButton = (key, label, cls = "detail-say") =>
  canSpeak
    ? `<button type="button" class="${cls}" title="Hear it" aria-label="Hear ${label}" onclick="speakSay('${key}', event)">${SPEAKER_SVG}</button>`
    : "";
