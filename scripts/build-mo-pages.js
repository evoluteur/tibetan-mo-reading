#!/usr/bin/env node
// Generates the static divination pages: mo/<n>-<name>.html (one per
// divination) and mo/index.html (all 36), plus sitemap.xml and robots.txt.
//
//   node scripts/build-mo-pages.js
//
// Data comes from js/mo-data.js (the same file the app uses) and the symbol
// notes from scripts/mo-extra.js. The pages are plain HTML so search engines
// can read them without running any JavaScript; re-run the script after
// editing either file, and commit the generated files.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const SITE = "https://evoluteur.github.io/tibetan-mo-reading/";
const TODAY = new Date().toISOString().slice(0, 10);

const { moData, SYLLABLES, OMENS, TOPICS } = vm.runInNewContext(
  fs.readFileSync(path.join(root, "js/mo-data.js"), "utf8") +
    ";({ moData, SYLLABLES, OMENS, TOPICS })",
);
const EXTRA = require("./mo-extra.js");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const firstSentence = (s) => s.split(/(?<=[.:])\s/)[0].replace(/:$/, ".");
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// the GitHub link markup is taken from index.html so the two stay identical
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const GITHUB_LINK = indexHtml.match(/<a\s[^>]*id="omg-github"[\s\S]*?<\/a>/)?.[0];
if (!GITHUB_LINK) throw new Error('index.html has no <a id="omg-github"> link to copy');

const SPEAKER =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const sayButton = (key, label) =>
  `<button type="button" class="detail-say" title="Hear it" aria-label="Hear ${label}" onclick="speakSay('${key}', event)">${SPEAKER}</button>`;

const pairName = (m) => m.syl.map((s) => s.name).join(" ");
const pairTib = (m) => m.syl.map((s) => s.tib).join('<span class="tsheg">་</span>');
const omenTag = (m) =>
  `<span class="omen-tag omen-${m.omen}" title="${OMENS[m.omen].text}">${OMENS[m.omen].name}</span>`;

const head = ({ title, description, url, ogType = "article", jsonld }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-063933E3C2"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());
      gtag("config", "G-063933E3C2");
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="author" content="Olivier Giulieri" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" type="image/png" href="../favicon.png" />
    <meta name="theme-color" content="#1a212d" />
    <meta property="og:site_name" content="Tibetan Mo Reading" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}tibetan-mo-reading.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${SITE}tibetan-mo-reading.png" />
    <script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
    </script>

    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Overpass" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+Tibetan:wght@400;700&display=swap" />
    <link id="omg-core-css" rel="stylesheet" href="../css/core.css" />
    <script>
      // Themes (dark, light, evol-blue) are copies of omg-themes; the base is "../" because this page is in mo/.
      window.OMG_THEMES_BASE = "../";
      window.OMG_DEFAULT_THEME = "dark";
      (function () {
        var t = window.OMG_DEFAULT_THEME;
        try {
          t = localStorage.getItem("omg-theme") || t;
        } catch (e) {}
        if (t !== "dark" && t !== "light" && t !== "evol-blue") t = window.OMG_DEFAULT_THEME;
        document.documentElement.setAttribute("data-theme", t);
        // written here (not in the markup) so the saved theme loads before first paint
        document.write(
          '<link id="omg-theme-css" rel="stylesheet" href="' + window.OMG_THEMES_BASE + "css/themes/" + t + "/" + t + '.css" />',
        );
      })();
    </script>
    <link id="omg-density-css" rel="stylesheet" href="../css/densities.css" />
    <link rel="stylesheet" href="../css/mo.css" />
    <link rel="stylesheet" href="../css/about.css" />
    <link rel="stylesheet" href="../css/mo-page.css" />

    <script src="../js/omg.js"></script>
    <script src="../js/speech.js"></script>
    <script>
      // no speech support: hide the speaker buttons
      addEventListener("DOMContentLoaded", () => {
        if (!canSpeak) document.querySelectorAll(".detail-say").forEach((b) => b.remove());
      });
    </script>
  </head>
`;

const header = () => `
  <body onload="setupPage('mo');" id="omg-body" class="medium">
    <div id="omg-header">
      <h1><a href="../index.html">Tibetan Mo Reading</a></h1>
      <div id="omg-header-tools">
        <div id="omg-theme-picker"></div>
        ${GITHUB_LINK}
      </div>
    </div>`;

const footer = () => `
      <div class="footer">
        <p><a href="../index.html">Ask the Mo</a> · <a href="index.html">All 36 divinations</a> · <a href="../about.html">About Mo</a></p>
        <p>The six syllables and the names and order of the 36 divinations follow Jamgön Mipham’s Mo; meanings and advice were written for this app.</p>
        <p>
          Tibetan Mo Reading is open source on
          <a href="https://github.com/evoluteur/tibetan-mo-reading">GitHub</a>
          with an MIT license. Had fun browsing the app?
          <a href="https://github.com/sponsors/evoluteur">Buy me a coffee by becoming a sponsor</a>.
        </p>
        <p>
          You may also enjoy other readings like <a href="https://evoluteur.github.io/i-ching-reading/">I Ching</a>, <a href="https://evoluteur.github.io/tarot-reading/">Tarot</a>, <a href="https://evoluteur.github.io/rune-reading/">Runes</a>, and <a href="https://evoluteur.github.io/motivational-numerology/">Numerology</a>. For more mystic arts as small web apps, see
          <a href="https://evoluteur.github.io/esoterica.html">Esoterica</a>.
        </p>
        <p class="copyright">
          &#169; 2026
          <a href="https://evoluteur.github.io/">Olivier Giulieri</a>
        </p>
      </div>
    </div>
  </body>
</html>
`;

const author = { "@type": "Person", name: "Olivier Giulieri", url: "https://evoluteur.github.io/" };
const breadcrumb = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })),
});
const website = { "@type": "WebSite", name: "Tibetan Mo Reading", url: SITE };

const throwButton = `<p><button type="button" class="interpret-btn" onclick="location.href='../index.html'">Ask the Mo Now</button></p>`;

// ---------------------------------------------------------------- one divination

const moChip = (m, current) =>
  `<li><a class="mo-pick${current ? " current" : ""}" href="${m.slug}.html"${
    current ? ' aria-current="page"' : ""
  }><span class="mp-tib" lang="bo">${pairTib(m)}</span><span class="rn">${pairName(m)}</span><span class="rs">${m.name.replace(/^The /, "")}</span></a></li>`;

const moPage = (m, i) => {
  const symbol = EXTRA[m.n];
  if (!symbol) throw new Error(`no symbol text for ${m.n}`);
  const [s1, s2] = m.syl;
  const siblings = moData.filter((o) => o.s[0] === m.s[0]);
  const prev = moData[i - 1];
  const next = moData[i + 1];
  const url = `${SITE}mo/${m.slug}.html`;
  const title = `${m.name} (${pairName(m)}) – Mo Divination ${m.n} | Tibetan Mo Reading`;
  const description = `${m.name}, ${pairName(m)}, is divination ${m.n} of 36 in the Tibetan Mo: ${lc(
    firstSentence(m.meaning),
  )} Its meaning for home, plans, wealth, health and more.`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: `${m.name} (${pairName(m)}), Tibetan Mo divination ${m.n}`,
        description,
        url,
        mainEntityOfPage: url,
        inLanguage: "en",
        about: `The Mo divination ${m.name}`,
        keywords: [m.name, pairName(m), "Mo divination", "Tibetan divination", ...m.keywords].join(", "),
        image: `${SITE}tibetan-mo-reading.png`,
        datePublished: TODAY,
        dateModified: TODAY,
        author,
        isPartOf: website,
      },
      breadcrumb([
        ["Tibetan Mo Reading", SITE],
        ["The 36 divinations", `${SITE}mo/`],
        [m.name, url],
      ]),
    ],
  };
  const moNav = (where) => `<nav class="mo-nav ${where}" aria-label="Previous and next divination${where === "top" ? " (top)" : ""}">
        <span>${prev ? `<a href="${prev.slug}.html" rel="prev">← ${pairName(prev)}</a>` : ""}</span>
        <a href="index.html">All 36</a>
        <span>${next ? `<a href="${next.slug}.html" rel="next">${pairName(next)} →</a>` : ""}</span>
      </nav>`;
  const sylBlock = (s, which) => `
        <div class="mo-syl">
          <span class="tib ms-tib" lang="bo">${s.tib}</span>
          <div>
            <div class="ms-name">${which}: ${s.name}${sayButton(s.id, s.name)} <span class="ms-el">· ${s.element}</span></div>
            <p>${s.text}</p>
          </div>
        </div>`;
  return (
    head({ title, description, url, jsonld }) +
    header() +
    `
    <h2 class="mo-title">${m.name}</h2>
    <div class="content about mo-page">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="../index.html">Tibetan Mo Reading</a> › <a href="index.html">The 36 divinations</a> › ${m.name}</nav>
      ${moNav("top")}

      <div class="mo-hero omen-${m.omen}">
        <span class="tib-pair hero-tib" lang="bo">${pairTib(m)}</span>
        <div>
          <p class="mo-facts">Divination ${m.n} of 36 · ${pairName(m)} ${omenTag(m)}</p>
          <p class="mo-image">${m.image}</p>
          <div class="keywords">${m.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>
        </div>
      </div>

      <p class="lede">${m.meaning}</p>

      <h3>${m.name} by question</h3>
      <dl class="anatomy topic-anatomy">
        ${TOPICS.slice(1)
          .map((t) => `<dt>${t.name}</dt><dd>${m.topics[t.id]}</dd>`)
          .join("\n        ")}
      </dl>

      <h3>Advice</h3>
      <p class="fortune">${m.advice}</p>

      <h3>Practice</h3>
      <p>${m.remedy}</p>

      <h3>The symbol</h3>
      <p>${symbol}</p>

      <h3>The two throws</h3>
      <p>${m.name} comes up when the first throw of the die shows ${s1.name} (${lc(s1.element)}) and the second shows ${s2.name} (${lc(s2.element)}).</p>
      <div class="mo-syls">${sylBlock(s1, "First")}${sylBlock(s2, "Second")}
      </div>
      ${throwButton}

      <h3>The six divinations that begin with ${s1.name}</h3>
      <ol class="glyphs mo-glyphs">
        ${siblings.map((o) => moChip(o, o === m)).join("\n        ")}
      </ol>

      ${moNav("bottom")}
` +
    footer()
  );
};

// ---------------------------------------------------------------- hub

const hubPage = () => {
  const url = `${SITE}mo/`;
  const title = "The 36 Mo Divinations: Meanings of Tibetan Mo | Tibetan Mo Reading";
  const description =
    "All 36 divinations of the Tibetan Mo, from The Stainless Sky (A A) to The Jeweled Banner of Victory (DHI DHI), with their syllables, omens and meanings.";
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "The 36 divinations of the Tibetan Mo",
        description,
        url,
        inLanguage: "en",
        author,
        isPartOf: website,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: moData.map((m, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: `${m.name} (${pairName(m)})`,
            url: `${SITE}mo/${m.slug}.html`,
          })),
        },
      },
      breadcrumb([
        ["Tibetan Mo Reading", SITE],
        ["The 36 divinations", url],
      ]),
    ],
  };
  const sections = SYLLABLES.map((s) => {
    const list = moData
      .filter((m) => m.s[0] === s.id)
      .map(
        (m) => `
        <li><a class="mo-row" href="${m.slug}.html">
          <span class="tib-pair row-tib" lang="bo">${pairTib(m)}</span>
          <span class="rr-text">
            <span class="rr-name">${m.n}. ${m.name}</span> <span class="rr-sub">· ${pairName(m)}</span> ${omenTag(m)}
            <span class="rr-line">${firstSentence(m.meaning)}</span>
          </span>
        </a></li>`,
      )
      .join("");
    return `
      <h3><span class="tib" lang="bo">${s.tib}</span> First throw ${s.name} <span class="h-el">· ${s.element}</span></h3>
      <ol class="mo-list">${list}
      </ol>`;
  }).join("\n");
  const omenCounts = Object.keys(OMENS)
    .map((k) => `${moData.filter((m) => m.omen === k).length} ${OMENS[k].name.toLowerCase()}`)
    .join(", ");
  return (
    head({ title, description, url, ogType: "website", jsonld }) +
    header() +
    `
    <h2>The 36 divinations of the Mo</h2>
    <div class="content about mo-page">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="../index.html">Tibetan Mo Reading</a> › The 36 divinations</nav>
      <p class="lede">The Mo die carries the six syllables of Manjushri’s mantra, A RA PA TSA NA DHI. It is thrown twice, and the two syllables, in order, give one of 36 divinations, each with a name, an omen and an answer for the main areas of life.</p>
      <p>They are grouped here by the first throw, in the order of Jamgön Mipham’s Mo (${omenCounts}). Choose one for its meaning, its answer by question, its symbol and its advice. For a personal reading, <a href="../index.html">ask the Mo</a>; to learn where it comes from, see <a href="../about.html">about Mo</a>.</p>
      ${sections}
      ${throwButton}
` +
    footer()
  );
};

// ---------------------------------------------------------------- write

const outDir = path.join(root, "mo");
fs.mkdirSync(outDir, { recursive: true });

const titles = new Set();
const descriptions = new Set();
moData.forEach((m, i) => {
  const html = moPage(m, i);
  fs.writeFileSync(path.join(outDir, `${m.slug}.html`), html);
  const t = html.match(/<title>(.*?)<\/title>/)[1];
  const d = html.match(/name="description" content="(.*?)"/)[1];
  if (titles.has(t) || descriptions.has(d)) throw new Error(`duplicate title/description for ${m.n}`);
  titles.add(t);
  descriptions.add(d);
});
fs.writeFileSync(path.join(outDir, "index.html"), hubPage());

const urls = [
  ["", "1.0"],
  ["mo/", "0.9"],
  ["about.html", "0.7"],
  ...moData.map((m) => [`mo/${m.slug}.html`, "0.8"]),
];
fs.writeFileSync(
  path.join(root, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ([u, p]) => `  <url>
    <loc>${SITE}${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <priority>${p}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`,
);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);

const lens = [...descriptions].map((d) => d.length);
console.log(
  `${moData.length} divination pages + hub + sitemap.xml + robots.txt; description length ${Math.min(...lens)}-${Math.max(...lens)}`,
);
