"use strict";

/**
 * app.js — Kanto Pokédex
 *
 * Third-party libraries used (4 total):
 *   1. Anime.js  — card hover micro-animations, modal open/close, grid stagger
 *   2. Glide.js  — touch/swipe carousel in the Featured section
 *   3. Granim.js — animated gradient canvas in the hero background
 *   4. Typed.js  — cycling typewriter text in the hero heading
 *
 * Data source: PokéAPI (https://pokeapi.co) — internet required.
 */

/* ---------- Reduced-motion preference (accessibility) ---------- */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/* ---------- DOM element references ---------- */
const elLoadedCount = document.getElementById("loadedCount");
const elVisibleCount = document.getElementById("visibleCount");
const elStatus = document.getElementById("status");

const elGrid = document.getElementById("grid");
const elSearch = document.getElementById("searchInput");
const elType = document.getElementById("typeSelect");
const btnReset = document.getElementById("btnReset");

const elSlides = document.getElementById("slides");
const elBullets = document.getElementById("bullets");

const elModal = document.getElementById("modal");
const elModalBackdrop = document.getElementById("modalBackdrop");
const elModalClose = document.getElementById("modalClose");
const elModalSprite = document.getElementById("modalSprite");
const elModalTitle = document.getElementById("modalTitle");
const elModalSub = document.getElementById("modalSub");
const elModalTypes = document.getElementById("modalTypes");
const elModalStats = document.getElementById("modalStats");
const elModalHeight = document.getElementById("modalHeight");
const elModalWeight = document.getElementById("modalWeight");
const elModalAbilities = document.getElementById("modalAbilities");

/* ---------- App state ---------- */
let glide = null;
let pokedex = [];
let filtered = [];
let typeList = [];

/* ---------- Utility helpers ---------- */
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const setStatus = (text) => {
  if (elStatus) elStatus.textContent = text;
};

const dexNum = (id) => `#${String(id).padStart(3, "0")}`;

const statShort = (key) => {
  const map = {
    hp: "HP",
    attack: "ATK",
    defense: "DEF",
    "special-attack": "SP.ATK",
    "special-defense": "SP.DEF",
    speed: "SPD",
  };

  return map[key] || key.toUpperCase();
};

const statToPct = (value) => {
  const max = 180;
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return pct;
};

const typeColors = (typeName) => {
  const map = {
    normal: ["#94a3b8", "#64748b"],
    fire: ["#fb7185", "#f97316"],
    water: ["#60a5fa", "#2563eb"],
    electric: ["#fde047", "#f59e0b"],
    grass: ["#4ade80", "#16a34a"],
    ice: ["#67e8f9", "#22d3ee"],
    fighting: ["#f97316", "#c2410c"],
    poison: ["#a855f7", "#7c3aed"],
    ground: ["#fbbf24", "#a16207"],
    flying: ["#93c5fd", "#3b82f6"],
    psychic: ["#f472b6", "#db2777"],
    bug: ["#a3e635", "#65a30d"],
    rock: ["#f59e0b", "#92400e"],
    ghost: ["#a78bfa", "#6d28d9"],
    dragon: ["#60a5fa", "#1d4ed8"],
    dark: ["#94a3b8", "#0f172a"],
    steel: ["#cbd5e1", "#64748b"],
    fairy: ["#f9a8d4", "#db2777"],
  };

  return map[typeName] || ["#94a3b8", "#64748b"];
};

const createTypePill = (typeName) => {
  const pill = document.createElement("span");
  pill.className = "type";
  pill.textContent = typeName;

  const [c1, c2] = typeColors(typeName);
  pill.style.background = `linear-gradient(90deg, ${c1}55, ${c2}33)`;
  pill.style.borderColor = `${c1}55`;

  return pill;
};

const createStatLine = (label, value) => {
  const row = document.createElement("div");
  row.className = "statline";

  const lab = document.createElement("label");
  lab.textContent = label;

  const bar = document.createElement("div");
  bar.className = "bar";

  const fill = document.createElement("div");
  fill.className = "fill";
  fill.style.width = `${statToPct(value)}%`;

  const val = document.createElement("div");
  val.className = "val";
  val.textContent = String(value);

  bar.appendChild(fill);
  row.appendChild(lab);
  row.appendChild(bar);
  row.appendChild(val);

  return row;
};

/* ---------- PokéAPI fetch helpers ---------- */
const fetchList151 = async () => {
  const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=151&offset=0");
  if (!res.ok) throw new Error("Failed to fetch list");
  const json = await res.json();
  return json.results;
};

const fetchPokemon = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch pokemon");
  return res.json();
};

const runPool = async (items, worker, concurrency = 12) => {
  const results = new Array(items.length);
  let i = 0;

  const runners = new Array(concurrency).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      // eslint-disable-next-line no-await-in-loop
      results[idx] = await worker(items[idx], idx);
    }
  });

  await Promise.all(runners);
  return results;
};

/* ---------- Modal — open/close with Anime.js animation ---------- */
const openModal = (p) => {
  if (!elModal) return;

  elModalSprite.innerHTML = "";
  const img = document.createElement("img");
  img.alt = `${cap(p.name)} sprite`;
  img.src = p.sprite || "";
  elModalSprite.appendChild(img);

  elModalTitle.textContent = p.name;
  elModalSub.textContent = `${dexNum(p.id)} • ${p.types.join(" / ")}`;

  elModalTypes.innerHTML = "";
  p.types.forEach((t) => elModalTypes.appendChild(createTypePill(t)));

  elModalStats.innerHTML = "";
  p.stats.forEach((s) => {
    elModalStats.appendChild(createStatLine(statShort(s.key), s.val));
  });

  elModalHeight.textContent = `${(p.height / 10).toFixed(1)} m`;
  elModalWeight.textContent = `${(p.weight / 10).toFixed(1)} kg`;
  elModalAbilities.textContent = p.abilities.map(cap).join(", ");

  elModal.classList.add("is-open");
  elModal.setAttribute("aria-hidden", "false");

  if (!prefersReducedMotion) {
    // eslint-disable-next-line no-undef
    anime({
      targets: ".modal-backdrop",
      opacity: [0, 1],
      duration: 220,
      ease: "linear",
    });

    // eslint-disable-next-line no-undef
    anime({
      targets: ".modal-panel",
      opacity: [0, 1],
      scale: [0.96, 1],
      translateY: [10, 0],
      duration: 260,
      ease: "outCubic",
    });
  } else {
    const backdrop = document.querySelector(".modal-backdrop");
    if (backdrop) backdrop.style.opacity = "1";
    const panel = document.querySelector(".modal-panel");
    if (panel) panel.style.opacity = "1";
  }
};

const closeModal = () => {
    if (!elModal) return;
  
    // If it's not open, do nothing
    if (!elModal.classList.contains("is-open")) return;
  
    // Always close even if animation fails
    const hardClose = () => {
      elModal.classList.remove("is-open");
      elModal.setAttribute("aria-hidden", "true");
    };
  
    if (prefersReducedMotion || typeof anime === "undefined") {
      hardClose();
      return;
    }
  
    try {
      anime({
        targets: ".modal-panel",
        opacity: [1, 0],
        scale: [1, 0.98],
        translateY: [0, 10],
        duration: 200,
        ease: "inCubic",
        onComplete: hardClose,
      });
  
      anime({
        targets: ".modal-backdrop",
        opacity: [1, 0],
        duration: 200,
        ease: "linear",
      });
    } catch (err) {
      hardClose();
      console.error(err);
    }
  };

/* ---------- Card builder — creates one Pokémon card element ---------- */
const buildCard = (p) => {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.dataset.id = String(p.id);
  card.dataset.name = p.name;

  const top = document.createElement("div");
  top.className = "card-top";

  const left = document.createElement("div");
  left.className = "poke";

  const sprite = document.createElement("div");
  sprite.className = "sprite";

  const img = document.createElement("img");
  img.alt = `${cap(p.name)} sprite`;
  img.loading = "lazy";
  img.src = p.sprite || "";

  sprite.appendChild(img);

  const nameWrap = document.createElement("div");
  nameWrap.className = "name";

  const strong = document.createElement("strong");
  strong.textContent = p.name;

  const num = document.createElement("span");
  num.className = "dexno";
  num.textContent = `${dexNum(p.id)} • Kanto`;

  nameWrap.appendChild(strong);
  nameWrap.appendChild(num);

  left.appendChild(sprite);
  left.appendChild(nameWrap);

  const types = document.createElement("div");
  types.className = "types";
  p.types.forEach((t) => types.appendChild(createTypePill(t)));

  top.appendChild(left);
  top.appendChild(types);

  const preview = document.createElement("div");
  preview.className = "preview";

  const hp = p.stats.find((s) => s.key === "hp")?.val ?? 0;
  const atk = p.stats.find((s) => s.key === "attack")?.val ?? 0;

  preview.appendChild(createStatLine("HP", hp));
  preview.appendChild(createStatLine("ATK", atk));

  card.appendChild(top);
  card.appendChild(preview);

  card.addEventListener("click", () => openModal(p));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openModal(p);
  });

  if (!prefersReducedMotion) {
    card.addEventListener("mouseenter", () => {
      // eslint-disable-next-line no-undef
      anime({
        targets: card,
        scale: 1.01,
        duration: 120,
        ease: "outQuad",
      });
    });

    card.addEventListener("mouseleave", () => {
      // eslint-disable-next-line no-undef
      anime({
        targets: card,
        scale: 1,
        duration: 120,
        ease: "outQuad",
      });
    });
  }

  return card;
};

const renderGrid = (list, withAnimation = true) => {
  elGrid.innerHTML = "";

  const frag = document.createDocumentFragment();
  list.forEach((p) => frag.appendChild(buildCard(p)));
  elGrid.appendChild(frag);

  if (elVisibleCount) elVisibleCount.textContent = String(list.length);

  if (!prefersReducedMotion && withAnimation) {
    // eslint-disable-next-line no-undef
    anime({
      targets: ".card",
      opacity: [0, 1],
      translateY: [10, 0],
      delay: (el, idx) => Math.min(400, idx * 12),
      duration: 520,
      ease: "outCubic",
    });
  }
};

/* ---------- Featured carousel — Glide.js, picks 10 random Pokémon ---------- */
const buildFeaturedCarousel = (baseList) => {
  if (!elSlides || !elBullets) return;

  const pickCount = 10;
  const copy = [...baseList];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  const featured = copy.slice(0, pickCount);

  elSlides.innerHTML = "";
  featured.forEach((p) => {
    const li = document.createElement("li");
    li.className = "glide__slide";

    const card = document.createElement("div");
    card.className = "slide-card";

    /* type-based gradient background — use the pokemon's primary type colours */
    const [c1, c2] = typeColors(p.types[0]);
    card.style.background = `linear-gradient(160deg, ${c1}40 0%, ${c2}28 60%, rgba(0,0,0,0.55) 100%)`;

    /* sprite — sits above the text, no surrounding box */
    const sprite = document.createElement("div");
    sprite.className = "slide-sprite";

    const img = document.createElement("img");
    img.alt = `${cap(p.name)} sprite`;
    img.loading = "lazy";
    img.src = p.sprite || "";

    sprite.appendChild(img);

    /* text content below sprite */
    const title = document.createElement("p");
    title.className = "slide-title";
    title.textContent = p.name;

    const sub = document.createElement("p");
    sub.className = "slide-sub";
    sub.textContent = `${dexNum(p.id)} • ${p.types.join(" / ")}`;

    const inner = document.createElement("div");
    inner.className = "slide-inner";
    inner.appendChild(sprite);
    inner.appendChild(title);
    inner.appendChild(sub);

    card.appendChild(inner);
    li.appendChild(card);

    li.addEventListener("click", () => openModal(p));
    elSlides.appendChild(li);
  });

  elBullets.innerHTML = "";
  for (let i = 0; i < featured.length; i += 1) {
    const b = document.createElement("button");
    b.className = "glide__bullet";
    b.setAttribute("data-glide-dir", `=${i}`);
    elBullets.appendChild(b);
  }

  if (glide) {
    glide.destroy();
    glide = null;
  }

  // eslint-disable-next-line no-undef
  glide = new Glide(".glide", {
    type: "carousel",
    gap: 14,
    perView: 1,
    focusAt: "center",
    breakpoints: {
      720: { perView: 2 },
      1024: { perView: 3 },
    },
  });

  glide.mount();

  if (!prefersReducedMotion) {
    // eslint-disable-next-line no-undef
    anime({
      targets: ".glide",
      opacity: [0.4, 1],
      duration: 420,
      ease: "outQuad",
    });
  }
};

const buildTypeOptions = (types) => {
  elType.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "All types";
  elType.appendChild(optAll);

  types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = cap(t);
    elType.appendChild(opt);
  });
};

/* ---------- Filtering — search by name/# and type ---------- */
const applyFilters = () => {
  const q = (elSearch.value || "").trim().toLowerCase();
  const t = elType.value || "all";

  filtered = pokedex.filter((p) => {
    const matchType = t === "all" ? true : p.types.includes(t);

    if (!q) return matchType;

    const qIsNum = /^\d+$/.test(q);
    const matchQ = qIsNum ? String(p.id) === q : p.name.includes(q);

    return matchType && matchQ;
  });

  renderGrid(filtered, true);
};

/* ---------- Library initialisers ---------- */

/** Typed.js — typewriter cycling words in the hero h1 */
const initTyped = () => {
  if (!document.getElementById("typed")) return;

  // eslint-disable-next-line no-undef
  new Typed("#typed", {
    strings: [ "Stats.", "Typing.", "Compare."],
    typeSpeed: 55,
    backSpeed: 28,
    backDelay: 900,
    loop: true,
    showCursor: true,
    cursorChar: "▍",
  });
};

/** Granim.js — animated gradient behind the hero */
const initGranim = () => {
  if (prefersReducedMotion) return;

  // eslint-disable-next-line no-undef
  new Granim({
    element: "#granim-canvas",
    direction: "diagonal",
    isPausedWhenNotInView: true,
    states: {
      "default-state": {
        transitionSpeed: 3200,
        gradients: [
          ["#2563eb", "#e11d48"],
          ["#1d4ed8", "#be123c"],
          ["#0ea5e9", "#facc15"],
        ],
      },
    },
  });
};

/* ---------- Event listeners ---------- */
const initEvents = () => {
    if (elSearch) elSearch.addEventListener("input", applyFilters);
    if (elType) elType.addEventListener("change", applyFilters);
  
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        if (elSearch) elSearch.value = "";
        if (elType) elType.value = "all";
        applyFilters();
  
        if (!prefersReducedMotion && typeof anime !== "undefined") {
          anime({
            targets: btnReset,
            scale: [1, 1.03, 1],
            duration: 220,
            ease: "inOutQuad",
          });
        }
      });
    }
  
    // ✅ Event delegation: close when clicking the X (anywhere) or backdrop
    document.addEventListener("click", (e) => {
      const clickedClose = e.target.closest("#modalClose");
      const clickedBackdrop = e.target.closest("#modalBackdrop");
      if (clickedClose || clickedBackdrop) closeModal();
    });
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  };

/* ---------- Data loading — fetches all 151 Pokémon in parallel ---------- */
const loadPokedex = async () => {
  setStatus("Loading Pokédex…");

  const list = await fetchList151();

  let loaded = 0;
  const details = await runPool(
    list,
    async (item) => {
      const data = await fetchPokemon(item.url);

      loaded += 1;
      if (elLoadedCount) elLoadedCount.textContent = String(loaded);

      return {
        id: data.id,
        name: data.name,
        sprite:
          data.sprites?.versions?.["generation-v"]?.["black-white"]?.animated
            ?.front_default ||
          data.sprites?.front_default ||
          "",
        spriteStatic: data.sprites?.front_default || "",
        types: data.types.map((t) => t.type.name),
        height: data.height,
        weight: data.weight,
        abilities: data.abilities.map((a) => a.ability.name),
        stats: data.stats.map((s) => ({ key: s.stat.name, val: s.base_stat })),
      };
    },
    12
  );

  details.sort((a, b) => a.id - b.id);

  pokedex = details;
  filtered = [...pokedex];

  const set = new Set();
  pokedex.forEach((p) => p.types.forEach((t) => set.add(t)));
  typeList = Array.from(set).sort((a, b) => a.localeCompare(b));
  buildTypeOptions(typeList);

  renderGrid(filtered, false);
  buildFeaturedCarousel(pokedex);

  if (elVisibleCount) elVisibleCount.textContent = String(filtered.length);
  setStatus("Loaded. Search or filter to explore.");

  if (!prefersReducedMotion) {
    // eslint-disable-next-line no-undef
    anime({
      targets: ".card",
      opacity: [0, 1],
      translateY: [10, 0],
      delay: (el, idx) => Math.min(500, idx * 10),
      duration: 560,
      ease: "outCubic",
    });
  }
};

/* ---------- Entry point ---------- */
const init = async () => {
  initTyped();
  initGranim();
  initEvents();

  try {
    await loadPokedex();
  } catch (err) {
    setStatus("Gen. 1");
    // eslint-disable-next-line no-console
    console.error(err);
  }
};

init();