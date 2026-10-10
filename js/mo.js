// Tibetan Mo Reading app logic -- syllable and divination data live in js/mo-data.js

const STATE_STORAGE_KEY = "tibetan-mo-reading-state";
const ROLL_MS = 1100;

const moBySyllables = Object.fromEntries(moData.map((m) => [m.id, m]));
const topicById = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

let topicId = "general";
let question = "";
let throws = []; // syllable ids, first throw then second
let rolling = false;
let fullMode = false;
let rollTurns = 0; // full turns so far, so the die always tumbles forward
let dieFace = "a"; // face the die is showing

const topic = () => topicById[topicId];
const isComplete = () => throws.length === 2;
const currentMo = () => (isComplete() ? moBySyllables[throws.join("-")] : null);

// ---------------------------------------------------------------- die

// Face layout of the cube, and the rotation that brings each face to the front.
const FACES = [
  { id: "a", side: "front", x: 0, y: 0 },
  { id: "ra", side: "right", x: 0, y: -90 },
  { id: "pa", side: "back", x: 0, y: -180 },
  { id: "tsa", side: "left", x: 0, y: 90 },
  { id: "na", side: "top", x: -90, y: 0 },
  { id: "dhi", side: "bottom", x: 90, y: 0 },
];
const faceById = Object.fromEntries(FACES.map((f) => [f.id, f]));

const dieTransform = (id, turns) => {
  const f = faceById[id];
  return `rotateX(${f.x + 360 * turns}deg) rotateY(${f.y + 360 * turns}deg)`;
};

const dieMarkup = () => `
  <div class="die-scene" aria-hidden="true">
    <div class="die" id="die" style="transform:${dieTransform(dieFace, rollTurns)}">
      ${FACES.map(
        (f) => `<div class="die-face face-${f.side} die-${f.id}"><span class="tib" lang="bo">${syllableById[f.id].tib}</span></div>`,
      ).join("")}
    </div>
  </div>`;

const omenTag = (m) =>
  `<span class="omen-tag omen-${m.omen}" title="${OMENS[m.omen].text}">${OMENS[m.omen].name}</span>`;

const keywordsMarkup = (m) =>
  `<div class="keywords">${m.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`;

const syllablePair = (m, cls = "") =>
  `<span class="tib-pair ${cls}" lang="bo">${m.syl.map((s) => s.tib).join("<span class=\"tsheg\">་</span>")}</span>`;

const pairName = (m) => m.syl.map((s) => s.name).join(" ");

// ---------------------------------------------------------------- controls

const renderTopicPicker = () => {
  const elem = document.getElementById("topic-picker");
  if (!elem) return;
  elem.innerHTML = TOPICS.map(
    (t) => `
      <button type="button" class="topic-btn${t.id === topicId ? " selected" : ""}"
        aria-pressed="${t.id === topicId}" onclick="setTopic('${t.id}')">${t.name}</button>`,
  ).join("");
};

const renderQuestion = () => {
  const input = document.getElementById("question");
  if (!input) return;
  if (document.activeElement !== input) input.value = question;
  input.placeholder = topic().q;
};

const renderMantra = () => {
  const elem = document.getElementById("mantra");
  if (!elem) return;
  elem.innerHTML = `
    <span class="mantra-tib" lang="bo">ༀ་ཨ་ར་པ་ཙ་ན་དྷཱི།</span>
    <span class="mantra-latin">OM A RA PA TSA NA DHI${sayButton("mantra", "the mantra")}</span>`;
};

const renderThrowArea = () => {
  const elem = document.getElementById("throw-area");
  if (!elem) return;
  if (isComplete()) {
    elem.innerHTML = "";
    elem.style.display = "none";
    return;
  }
  elem.style.display = "";
  const next = throws.length;
  elem.innerHTML = `
    ${dieMarkup()}
    <div class="throw-controls">
      <div class="throw-progress">Throw ${next + 1} of 2</div>
      <div class="throw-hint">${
        next === 0
          ? "Hold your question in mind, recite the mantra, then throw."
          : `The first throw gave ${syllableById[throws[0]].name}. Throw once more.`
      }</div>
      <div class="throw-buttons">
        <button type="button" class="throw-btn" onclick="throwClick()"${rolling ? " disabled" : ""}>
          ${next === 0 ? "Throw the Die" : "Throw Again"}
        </button>
        ${
          next === 0
            ? `<button type="button" class="throw-btn secondary" onclick="throwBothClick()"${rolling ? " disabled" : ""}>Throw Twice</button>`
            : ""
        }
      </div>
    </div>`;
};

const renderActions = () => {
  const elem = document.getElementById("actions-bar");
  if (!elem) return;
  if (!throws.length) {
    elem.innerHTML = "";
    return;
  }
  elem.innerHTML = `
    ${
      isComplete()
        ? `<button type="button" class="interpret-btn" onclick="toggleFull()">${
            fullMode ? "Back to the Answer" : "Read All Topics"
          }</button>`
        : ""
    }
    <button type="button" class="interpret-btn" onclick="newReading()">New Reading</button>`;
};

// ---------------------------------------------------------------- board

const slotMarkup = (i, isNew) => {
  const label = i === 0 ? "First throw" : "Second throw";
  const id = throws[i];
  if (!id) {
    return `
      <div class="syl-slot empty">
        <div class="slot-label">${label}</div>
        <div class="slot-num">${i + 1}</div>
      </div>`;
  }
  const s = syllableById[id];
  return `
    <div role="button" tabindex="0" class="syl-slot syl-tile${isNew ? " syl-new" : ""}" data-syl="${s.id}"
      onclick="showSyllableDetail('${s.id}')"
      onkeydown="if (event.target === this && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); showSyllableDetail('${s.id}'); }"
      aria-label="${label}: ${s.name}, ${s.element}">
      <div class="slot-label">${label}</div>
      <div class="tib syl-glyph" lang="bo">${s.tib}</div>
      <div class="tile-name">${s.name}${canSpeak ? `<span class="syl-say" role="button" tabindex="0" title="Hear it" aria-label="Hear ${s.name}" onclick="speakSay('${s.id}', event)" onkeydown="sayKey('${s.id}', event)">${SPEAKER_SVG}</span>` : ""}</div>
      <div class="tile-sub">${s.element}</div>
    </div>`;
};

let newFrom = 99; // index of the first tile thrown by the last action, to animate it

const renderBoard = () => {
  const elem = document.getElementById("syl-board");
  if (!elem) return;
  elem.innerHTML = throws.length ? [0, 1].map((i) => slotMarkup(i, i >= newFrom)).join("") : "";
  newFrom = 99;
};

const topicLine = (m, t) => (t.id === "general" ? m.meaning : m.topics[t.id]);

const answerMarkup = (m) => {
  const t = topic();
  return `
    <div class="answer-card omen-${m.omen}">
      <div class="answer-head">
        ${syllablePair(m, "answer-glyph")}
        <div>
          <div class="answer-num">Divination ${m.n} of 36 · ${pairName(m)}</div>
          <h3 class="answer-name">${m.name}${omenTag(m)}</h3>
          <div class="answer-image">${m.image}</div>
          ${keywordsMarkup(m)}
        </div>
      </div>
      ${question ? `<p class="answer-question">“${escapeHtml(question)}”</p>` : ""}
      <p class="answer-meaning">${m.meaning}</p>
      ${
        t.id === "general"
          ? ""
          : `<div class="answer-topic"><h4>${t.name}</h4><p>${m.topics[t.id]}</p></div>`
      }
      <h4>Advice</h4>
      <p class="fortune">${m.advice}</p>
      <h4>Practice</h4>
      <p>${m.remedy}</p>
      <p class="detail-more"><a href="mo/${m.slug}.html">Read more about ${m.name} &rarr;</a></p>
    </div>`;
};

const fullMarkup = (m) => `
    <div class="answer-card omen-${m.omen}">
      <div class="answer-head">
        ${syllablePair(m, "answer-glyph")}
        <div>
          <div class="answer-num">Divination ${m.n} of 36 · ${pairName(m)}</div>
          <h3 class="answer-name">${m.name}${omenTag(m)}</h3>
          <div class="answer-image">${m.image}</div>
        </div>
      </div>
      <p class="answer-meaning">${m.meaning}</p>
      <dl class="topic-list">
        ${TOPICS.slice(1)
          .map(
            (t) =>
              `<dt${t.id === topicId ? ' class="current"' : ""}>${t.name}</dt><dd${
                t.id === topicId ? ' class="current"' : ""
              }>${m.topics[t.id]}</dd>`,
          )
          .join("")}
      </dl>
      <h4>Advice</h4>
      <p class="fortune">${m.advice}</p>
      <h4>Practice</h4>
      <p>${m.remedy}</p>
      <p class="detail-more"><a href="mo/${m.slug}.html">Read more about ${m.name} &rarr;</a></p>
    </div>`;

const renderAnswer = () => {
  const elem = document.getElementById("answer");
  if (!elem) return;
  const m = currentMo();
  elem.innerHTML = m
    ? (fullMode ? fullMarkup(m) : answerMarkup(m)) +
      `<p class="interpret-note">${OMENS[m.omen].text}. A Mo answer is a mirror for your own judgment, not a verdict. Ask once, with a clear question, and take the first answer.</p>
       <p class="interpret-credit">${CREDIT_HTML}</p>`
    : "";
};

const renderAll = () => {
  renderTopicPicker();
  renderQuestion();
  renderMantra();
  renderThrowArea();
  renderBoard();
  renderActions();
  renderAnswer();
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------------------------------------------------------------- throwing

const randomSyllable = () => SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)].id;

// Tumble the die to a face; resolves when it has landed.
const rollDie = (id) =>
  new Promise((resolve) => {
    rollTurns += 2;
    dieFace = id;
    const die = document.getElementById("die");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (die) {
      die.classList.add("rolling");
      die.style.transform = dieTransform(id, rollTurns);
    }
    setTimeout(
      () => {
        die?.classList.remove("rolling");
        resolve();
      },
      reduce ? 150 : ROLL_MS,
    );
  });

const setButtonsDisabled = () =>
  document.querySelectorAll(".throw-btn").forEach((b) => (b.disabled = true));

const throwClick = async () => {
  if (rolling || isComplete()) return;
  rolling = true;
  setButtonsDisabled();
  closeDetail();
  const id = randomSyllable();
  await rollDie(id);
  rolling = false;
  newFrom = throws.length;
  throws.push(id);
  saveState();
  renderAll();
};

const throwBothClick = async () => {
  if (rolling || throws.length) return;
  rolling = true;
  setButtonsDisabled();
  closeDetail();
  const first = randomSyllable();
  await rollDie(first);
  newFrom = 0;
  throws.push(first);
  renderBoard();
  const second = randomSyllable();
  await rollDie(second);
  rolling = false;
  newFrom = 1;
  throws.push(second);
  saveState();
  renderAll();
};

const resetReading = () => {
  throws = [];
  rolling = false;
  fullMode = false;
  closeDetail();
};

const newReading = () => {
  resetReading();
  saveState();
  renderAll();
  document.getElementById("question")?.focus({ preventScroll: true });
};

const setTopic = (id) => {
  if (!topicById[id] || id === topicId) return;
  topicId = id;
  saveState();
  renderTopicPicker();
  renderQuestion();
  renderAnswer();
};

const setQuestion = (text) => {
  question = text.slice(0, 300);
  saveState();
};

const toggleFull = () => {
  if (!isComplete()) return;
  fullMode = !fullMode;
  renderActions();
  renderAnswer();
};

// ---------------------------------------------------------------- persistence

const saveState = () => {
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ topic: topicId, question, throws }));
  } catch {
    // storage unavailable -- not worth failing the reading over
  }
};

const restoreState = () => {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(STATE_STORAGE_KEY) || "null");
  } catch {
    raw = null;
  }
  if (!raw) return;
  if (topicById[raw.topic]) topicId = raw.topic;
  if (typeof raw.question === "string") question = raw.question.slice(0, 300);
  if (
    Array.isArray(raw.throws) &&
    raw.throws.length <= 2 &&
    raw.throws.every((id) => syllableById[id])
  ) {
    throws = raw.throws.slice();
    if (throws.length) dieFace = throws[throws.length - 1];
  }
};

// ---------------------------------------------------------------- detail panel

const CREDIT_HTML =
  "The six syllables and the names and order of the 36 divinations follow Jamgön Mipham’s Mo. Meanings, advice and practices were written for this app.";

// The panel for one syllable of the die, with the six divinations it opens.
const syllableDetailMarkup = (s) => {
  const opens = moData.filter((m) => m.s[0] === s.id);
  return `
    <button type="button" class="detail-close" onclick="closeDetail()" aria-label="Close">&times;</button>
    <div class="detail-header">
      <div class="tib detail-glyph" lang="bo">${s.tib}</div>
      <div>
        <h3>${s.name}${sayButton(s.id, s.name)}</h3>
        <div class="detail-position">${s.element} · ${s.quality}</div>
      </div>
    </div>
    <p class="position-meaning">${s.text}</p>
    <h4>Divinations that begin with ${s.name}</h4>
    <ul class="detail-list">
      ${opens
        .map(
          (m) =>
            `<li><a href="mo/${m.slug}.html">${pairName(m)}: ${m.name}</a> ${omenTag(m)}</li>`,
        )
        .join("")}
    </ul>
    <p class="detail-credit">${CREDIT_HTML}</p>`;
};

const showSyllableDetail = (id) => {
  const panel = document.getElementById("card-detail");
  const s = syllableById[id];
  if (!panel || !s) return;
  if (window.event?.target?.closest?.(".syl-say")) return; // speaker, not the tile
  panel.innerHTML = syllableDetailMarkup(s);
  document.querySelectorAll(".syl-tile.active, .syl-pick.active").forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(`.syl-tile[data-syl="${id}"], .syl-pick[data-syl="${id}"]`)
    .forEach((el) => el.classList.add("active"));
  panel.classList.add("open");
  document.getElementById("detail-overlay")?.classList.add("open");
};

const closeDetail = () => {
  document.getElementById("card-detail")?.classList.remove("open");
  document.getElementById("detail-overlay")?.classList.remove("open");
  document.querySelectorAll(".syl-tile.active, .syl-pick.active").forEach((el) => el.classList.remove("active"));
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetail();
});

// Any click outside a syllable or the panel dismisses the panel.
document.addEventListener("click", (e) => {
  if (!document.getElementById("card-detail")?.classList.contains("open")) return;
  if (e.target.closest(".syl-tile") || e.target.closest(".syl-pick") || e.target.closest(".card-detail")) return;
  closeDetail();
});

// ---------------------------------------------------------------- init

const initMo = () => {
  restoreState();
  renderAll();
};
