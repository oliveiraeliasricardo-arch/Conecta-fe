
const API_KEY = "AIzaSyAS3BhR0B7d2ElA86jMirUB7hoMM_zWBc8";

// CANAIS CADASTRADOS
// Continuam sendo utilizados como fonte extra no Para você.

const APPROVED_CHANNELS = [
  {
    id: "UCJAO3KgZdEhCqwpkZyAYY6A",
    name: "Adventistas Brasil"
  }
];

const APPROVED_CREATOR_CHANNEL_IDS = [];

// PESQUISAS GERAIS

const categorySearch = {
  "Todos": "Jesus Cristo evangelho louvor cristão adoração",

  "Jesus": "Jesus Cristo vida de Jesus milagres parábolas evangelho",

  "Pregação": "pregação adventista doutrinas bíblicas",

  "Louvor": "louvor cristão música gospel clipe oficial -coletanea -playlist -medley -mix -1hora -2horas",

  "Bíblia": "estudo bíblico adventista Daniel Apocalipse profecias sábado",

  "Oração": "oração cristã oração a Deus",

  "Testemunho": "testemunho cristão transformação de vida"
};

// CATEGORIAS COM PESQUISAS DOUTRINÁRIAS

const doctrineSearches = {
  "Pregação": [
    "pregação adventista sábado bíblico",
    "sermão adventista segunda vinda de Jesus",
    "doutrina adventista santuário celestial",
    "três mensagens angélicas Apocalipse 14",
    "grande conflito Bíblia adventista",
    "estado dos mortos adventista",
    "justificação pela fé adventista",
    "profecias de Daniel e Apocalipse adventista",
    "lei e graça estudo adventista",
    "doutrinas bíblicas adventistas",
    "pregação sobre os dez mandamentos",
    "sermão sobre a volta de Jesus",
    "mensagem adventista sobre o Espírito Santo",
    "pregação sobre o sábado e a criação",
    "mensagem sobre salvação pela fé"
  ],

  "Bíblia": [
    "estudo bíblico adventista Daniel 2",
    "Apocalipse 14 três mensagens angélicas",
    "sábado bíblico quarto mandamento",
    "estudo do santuário celestial",
    "estado dos mortos Bíblia",
    "segunda vinda de Jesus estudo bíblico",
    "juízo investigativo Bíblia adventista",
    "28 crenças fundamentais adventistas",
    "profecias de Daniel estudo bíblico",
    "lei de Deus e graça estudo bíblico",
    "estudo bíblico sobre o sábado",
    "Daniel 7 profecia bíblica",
    "Apocalipse 13 e 14 estudo bíblico",
    "dom de profecia Bíblia",
    "mortalidade da alma estudo bíblico",
    "batismo bíblico estudo adventista",
    "santuário terrestre e celestial Bíblia"
  ]
};

// VARIEDADE PARA O PARA VOCÊ

const FOR_YOU_SEARCHES = [
  "Jesus Cristo milagres e ensinamentos",
  "histórias bíblicas emocionantes",
  "pregação cristã mensagem de Deus",
  "louvor cristão adoração a Deus",
  "testemunho cristão transformação de vida",
  "parábolas de Jesus explicadas",
  "mensagem bíblica para fortalecer a fé",
  "oração da manhã com Deus",
  "vida cristã e intimidade com Deus",
  "promessas de Deus na Bíblia",
  "Jesus Cristo esperança e salvação",
  "estudo bíblico cristão",
  "mensagem de fé para momentos difíceis",
  "louvores cristãos que tocam o coração",
  "histórias de personagens bíblicos",
  "palavra de Deus para hoje",
  "ensinamentos de Jesus Cristo",
  "mensagem cristã de esperança",
  "reflexão bíblica sobre fé",
  "adoração e louvor a Jesus"
];

// ESTADO DO APLICATIVO

let videos = [];
let currentCategory = "Todos";
let currentQuery = "";
let currentPage = "home";
let loading = false;
let nextPageToken = null;
let pageSources = [];

let soundEnabled = false;
let started = false;
let activeVideoId = null;
let observer = null;

const players = new Map();
const manuallyPaused = new Set();

// Evita repetir vídeos do Para você durante a sessão.
const forYouSeenIds = new Set();

const savedVideos = new Set(
  JSON.parse(localStorage.getItem("conectaFeSaved") || "[]")
);

const likedVideos = new Set(
  JSON.parse(localStorage.getItem("conectaFeLiked") || "[]")
);

// FUNÇÕES GERAIS

function byId(id) {
  return document.getElementById(id);
}

function showToast(message) {
  const el = byId("toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2300);
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(oficial|official|clipe|video|letra|lyrics|hd|4k)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesAreSimilar(titleA, titleB) {
  const a = new Set(
    normalizeTitle(titleA).split(" ").filter(w => w.length > 2)
  );

  const b = new Set(
    normalizeTitle(titleB).split(" ").filter(w => w.length > 2)
  );

  if (!a.size || !b.size) return false;

  let common = 0;

  for (const word of a) {
    if (b.has(word)) common++;
  }

  const similarity =
    common / (a.size + b.size - common);

  return similarity >= 0.68;
}

// EMBARALHAR RESULTADOS

function shuffleArray(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] =
      [result[j], result[i]];
  }

  return result;
}

function getRandomForYouQueries(amount = 3) {
  return shuffleArray(FOR_YOU_SEARCHES).slice(0, amount);
}

function getRandomDoctrineQueries(category, amount = 5) {
  const searches = doctrineSearches[category] || [];

  return shuffleArray(searches).slice(0, amount);
}

// FILTROS DE CONTEÚDO

function hasArtificialContentSignals(video) {
  const text = (
    video.title + " " + video.description
  ).toLowerCase();

  const signals = [
    "gerado por ia",
    "gerada por ia",
    "feito por ia",
    "criado por ia",
    "ai generated",
    "generated by ai",
    "ai cover",
    "suno ai",
    "udio ai",
    "voz artificial",
    "voz gerada"
  ];

  return signals.some(term => text.includes(term));
}

function isClearlyNonPortuguese(video) {
  const lang = String(
    video.defaultAudioLanguage ||
    video.defaultLanguage ||
    ""
  ).toLowerCase();

  if (!lang) return false;

  return !(lang === "pt" || lang.startsWith("pt-"));
}

function getAllApprovedChannelIds() {
  return [
    ...new Set([
      ...APPROVED_CHANNELS.map(c => c.id),
      ...APPROVED_CREATOR_CHANNEL_IDS
    ])
  ];
}

function getCategoryQuery() {
  return currentQuery ||
    categorySearch[currentCategory] ||
    categorySearch.Todos;
}

// INTERFACE

function setWelcome(visible) {
  byId("welcome").classList.toggle("hidden", !visible);
}

function setFeedMessage(message) {
  const old = byId("feedMessage");
  if (old) old.remove();

  if (!message) return;

  const el = document.createElement("div");
  el.id = "feedMessage";
  el.className = "feed-message";
  el.textContent = message;

  byId("feed").appendChild(el);
}

function stopObserver() {
  if (observer) observer.disconnect();
  observer = null;
}

function clearFeed() {
  stopObserver();

  for (const player of players.values()) {
    try {
      player.pauseVideo();
      player.destroy();
    } catch (_) {}
  }

  players.clear();
  manuallyPaused.clear();
  activeVideoId = null;

  byId("feed").innerHTML = "";

  videos = [];
  nextPageToken = null;
  pageSources = [];
}

// YOUTUBE API

async function youtubeSearch(query, channelId, pageToken) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "25",
    q: query,
    regionCode: "BR",
    relevanceLanguage: "pt",
    safeSearch: "strict",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    key: API_KEY
  });

  if (channelId) {
    params.set("channelId", channelId);
  }

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  if (currentCategory === "Louvor") {
    params.set("videoDuration", "medium");
  }

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/search?" +
    params.toString()
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Erro ao consultar o YouTube."
    );
  }

  return data;
}

async function getVideoDetails(ids) {
  if (!ids.length) return [];

  const params = new URLSearchParams({
    part: "snippet",
    id: ids.join(","),
    key: API_KEY
  });

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/videos?" +
    params.toString()
  );

  const data = await response.json();

  if (!response.ok) return [];

  return (data.items || []).map(item => ({
    id: item.id,
    title: item.snippet.title || "",
    description: item.snippet.description || "",
    channelId: item.snippet.channelId || "",
    channelTitle: item.snippet.channelTitle || "",
    defaultLanguage: item.snippet.defaultLanguage || "",
    defaultAudioLanguage: item.snippet.defaultAudioLanguage || ""
  }));
}

async function fetchSearchGroup(query, channelId, pageToken) {
  const result = await youtubeSearch(
    query,
    channelId,
    pageToken
  );

  const ids = (result.items || [])
    .map(item => item.id.videoId)
    .filter(Boolean);

  return {
    details: await getVideoDetails(ids),
    nextPageToken: result.nextPageToken || null
  };
}

// PREPARAR PESQUISAS

function prepareSearchSources() {
  const approvedIds = getAllApprovedChannelIds();

  // PREGAÇÕES E BÍBLIA
  // Qualquer canal pode aparecer.
  // A pesquisa é direcionada às doutrinas adventistas.

  if (
    currentCategory === "Pregação" ||
    currentCategory === "Bíblia"
  ) {
    const randomQueries = getRandomDoctrineQueries(
      currentCategory,
      5
    );

    pageSources = randomQueries.map(query => ({
      query,
      channelId: null,
      token: null
    }));

    return;
  }

  // PARA VOCÊ
  // Mistura vídeos cristãos gerais com conteúdo dos canais cadastrados.

  if (currentCategory === "Todos" && !currentQuery) {
    const randomQueries = getRandomForYouQueries(3);

    pageSources = randomQueries.map(query => ({
      query,
      channelId: null,
      token: null
    }));

    // Fonte extra dos canais cadastrados.
    approvedIds.forEach(id => {
      pageSources.push({
        query: randomQueries[0],
        channelId: id,
        token: null
      });
    });

    return;
  }

  // OUTRAS CATEGORIAS

  pageSources = [{
    query: getCategoryQuery(),
    channelId: null,
    token: null
  }];
}

// CARREGAR VÍDEOS

async function loadVideos({ reset = false, page = false } = {}) {
  if (loading) return;

  if (
    API_KEY === "COLOQUE_SUA_CHAVE_API_AQUI" ||
    !API_KEY
  ) {
    showToast("Adicione sua chave da API no app.js.");
    return;
  }

  if (reset) {
    clearFeed();

    prepareSearchSources();
  }

  loading = true;

  setFeedMessage(
    page
      ? "Descobrindo mais vídeos..."
      : "Buscando vídeos cristãos..."
  );

  try {
    let sourcesToFetch = [];

    if (page) {
      sourcesToFetch = pageSources.filter(
        source => source.token
      );
    } else {
      sourcesToFetch = pageSources;
    }

    if (!sourcesToFetch.length) {
      setFeedMessage(
        videos.length
          ? "Você chegou ao fim dos vídeos disponíveis."
          : "Não encontramos vídeos. Tente novamente."
      );

      nextPageToken = null;
      return;
    }

    // CADA PESQUISA TEM SUA PRÓPRIA PAGINAÇÃO.

    const results = await Promise.all(
      sourcesToFetch.map(async source => {

        const result = await fetchSearchGroup(
          source.query,
          source.channelId,
          page ? source.token : null
        );

        source.token = result.nextPageToken;

        return result;
      })
    );

    nextPageToken = pageSources.some(
      source => source.token
    ) ? "more" : null;

    const fetched = results.flatMap(
      group => group.details
    );

    const existingIds = new Set(
      videos.map(video => video.id)
    );

    const batchIds = new Set();

    let candidates = fetched.filter(video => {

      if (
        !video.id ||
        existingIds.has(video.id) ||
        batchIds.has(video.id)
      ) {
        return false;
      }

      batchIds.add(video.id);

      if (hasArtificialContentSignals(video)) {
        return false;
      }

      if (isClearlyNonPortuguese(video)) {
        return false;
      }

      if (
        currentCategory === "Todos" &&
        !currentQuery &&
        forYouSeenIds.has(video.id)
      ) {
        return false;
      }

      return true;
    });

    // EMBARALHAR O PARA VOCÊ

    if (currentCategory === "Todos" && !currentQuery) {
      candidates = shuffleArray(candidates);
    }

    // REMOVER TÍTULOS MUITO PARECIDOS

    const acceptedTitles = videos.map(
      video => video.title
    );

    const unique = [];

    for (const video of candidates) {

      if (
        acceptedTitles.some(title =>
          titlesAreSimilar(title, video.title)
        )
      ) {
        continue;
      }

      if (
        unique.some(item =>
          titlesAreSimilar(item.title, video.title)
        )
      ) {
        continue;
      }

      unique.push(video);
    }

    // DIVERSIDADE DE CANAIS

    const counts = {};

    videos.forEach(video => {
      counts[video.channelId] =
        (counts[video.channelId] || 0) + 1;
    });

    const diversified = [];

    for (const video of unique) {
      const count = counts[video.channelId] || 0;

      let limit = 2;

      if (
        currentCategory === "Pregação" ||
        currentCategory === "Bíblia"
      ) {
        // Sem limite por canal nessas categorias.
        limit = Infinity;

      } else if (
        currentCategory === "Todos" &&
        !currentQuery
      ) {
        limit = 2;

      } else if (currentCategory === "Louvor") {
        limit = 2;
      }

      if (count >= limit) continue;

      counts[video.channelId] = count + 1;
      diversified.push(video);
    }

    const finalVideos =
      currentCategory === "Todos" && !currentQuery
        ? shuffleArray(diversified)
        : diversified;

    if (!finalVideos.length && !videos.length) {

      setFeedMessage(
        "Não encontramos vídeos com esses filtros. Tente novamente."
      );

    } else if (!finalVideos.length) {

      setFeedMessage("");

      if (!nextPageToken) {
        showToast("Não encontramos mais vídeos.");
      }

    } else {

      setFeedMessage("");

      videos.push(...finalVideos);

      // REGISTRAR VÍDEOS JÁ EXIBIDOS NO PARA VOCÊ.

      if (
        currentCategory === "Todos" &&
        !currentQuery
      ) {
        finalVideos.forEach(video => {
          forYouSeenIds.add(video.id);
        });
      }

      renderVideos(finalVideos);
    }

  } catch (error) {
    console.error(error);

    setFeedMessage(error.message);
    showToast(error.message);

  } finally {
    loading = false;
  }
}

// CRIAR CARTÃO DO VÍDEO

function createVideoCard(video) {
  const card = document.createElement("article");

  card.className = "video-card";
  card.id = `card-${video.id}`;
  card.dataset.videoId = video.id;

  card.innerHTML = `
    <div class="player-shell">
      <div id="player-${video.id}"></div>
    </div>

    <div class="video-shade"></div>

    <button class="video-tap-layer"
      aria-label="Pausar ou reproduzir"></button>

    <div class="play-state" id="state-${video.id}">▶</div>

    <button class="sound-button"
      id="sound-${video.id}">
      Ativar som
    </button>

    <div class="video-info">
      <div class="video-channel">
        ${escapeHTML(video.channelTitle)}
      </div>

      <div class="video-title">
        ${escapeHTML(video.title)}
      </div>
    </div>

    <div class="video-actions">
      <button class="action-button" data-action="like">
        <span class="action-icon">♥</span>
        <small>Curtir</small>
      </button>

      <button class="action-button" data-action="save">
        <span class="action-icon">♡</span>
        <small>Salvar</small>
      </button>

      <button class="action-button" data-action="share">
        <span class="action-icon">↗</span>
        <small>Enviar</small>
      </button>
    </div>
  `;

  const likeButton =
    card.querySelector('[data-action="like"]');

  const saveButton =
    card.querySelector('[data-action="save"]');

  if (likedVideos.has(video.id)) {
    likeButton.classList.add("active");
  }

  if (savedVideos.has(video.id)) {
    saveButton.classList.add("active");
  }

  card.querySelector(".video-tap-layer")
    .addEventListener("click", () => {
      togglePlayback(video.id);
    });

  card.querySelector(`#sound-${video.id}`)
    .addEventListener("click", () => {
      activateSound(video.id);
    });

  likeButton.addEventListener("click", () => {
    toggleSet(
      likedVideos,
      video.id,
      "conectaFeLiked"
    );

    likeButton.classList.toggle(
      "active",
      likedVideos.has(video.id)
    );
  });

  saveButton.addEventListener("click", () => {
    toggleSet(
      savedVideos,
      video.id,
      "conectaFeSaved"
    );

    saveButton.classList.toggle(
      "active",
      savedVideos.has(video.id)
    );

    showToast(
      savedVideos.has(video.id)
        ? "Vídeo salvo."
        : "Vídeo removido dos salvos."
    );
  });

  card.querySelector('[data-action="share"]')
    .addEventListener("click", async () => {

      const url =
        `https://www.youtube.com/watch?v=${video.id}`;

      try {
        if (navigator.share) {

          await navigator.share({
            title: video.title,
            url
          });

        } else if (navigator.clipboard) {

          await navigator.clipboard.writeText(url);
          showToast("Link copiado.");

        } else {

          showToast(url);
        }

      } catch (_) {}
    });

  return card;
}

function toggleSet(set, id, key) {
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }

  localStorage.setItem(
    key,
    JSON.stringify([...set])
  );
}

function renderVideos(list) {
  const feed = byId("feed");

  list.forEach(video => {
    feed.appendChild(createVideoCard(video));
  });

  observeCards();
}

// OBSERVAR VÍDEOS VISÍVEIS

function observeCards() {
  if (observer) observer.disconnect();

  const cards =
    document.querySelectorAll(".video-card");

  observer = new IntersectionObserver(entries => {

    let best = null;

    entries.forEach(entry => {

      if (
        entry.isIntersecting &&
        (
          !best ||
          entry.intersectionRatio >
            best.intersectionRatio
        )
      ) {
        best = entry;
      }
    });

    if (
      best &&
      best.intersectionRatio >= 0.6
    ) {
      activateVideo(
        best.target.dataset.videoId
      );
    }

  }, {
    root: byId("feed"),
    threshold: [0.25, 0.5, 0.6, 0.8, 1]
  });

  cards.forEach(card => {
    observer.observe(card);
  });
}

// CONTROLE DE REPRODUÇÃO

function pauseInactivePlayers() {
  for (const [id, player] of players) {

    if (id !== activeVideoId) {

      try {
        player.pauseVideo();
      } catch (_) {}

      manuallyPaused.delete(id);
    }
  }
}

function activateVideo(videoId) {
  if (!videoId) return;

  if (
    activeVideoId &&
    activeVideoId !== videoId
  ) {
    const oldPlayer =
      players.get(activeVideoId);

    try {
      oldPlayer?.pauseVideo();
    } catch (_) {}

    manuallyPaused.delete(activeVideoId);
  }

  activeVideoId = videoId;

  manuallyPaused.delete(videoId);

  if (
    typeof YT === "undefined" ||
    !YT.Player
  ) {
    return;
  }

  let player = players.get(videoId);

  if (!player) {

    player = new YT.Player(
      `player-${videoId}`,
      {
        videoId: videoId,

        playerVars: {
          autoplay: 1,
          controls: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0
        },

        events: {

          onReady: event => {

            try {

              if (!soundEnabled) {
                event.targe
