"use strict";

/* CONFIGURAÇÃO */
const API_KEY = "AIzaSyCoG9A0z1M7ag1vP8vq7oEgXQb95aO-mbY";

const APPROVED_CHANNELS = [
  {
    id: "UCJAO3KgZdEhCqwpkZyAYY6A",
    name: "Adventistas Brasil"
  }
];

const CATEGORY_SEARCH = {
  "Todos": "Jesus Cristo evangelho louvor cristão adoração",
  "Jesus": "Jesus Cristo milagres parábolas ensinamentos",
  "Pregação": "pregação adventista doutrinas bíblicas sermão",
  "Louvor": "louvor cristão música gospel adoração",
  "Bíblia": "estudo bíblico adventista Daniel Apocalipse sábado",
  "Oração": "oração cristã oração a Deus",
  "Testemunho": "testemunho cristão transformação de vida"
};

const DOCTRINE_SEARCHES = {
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
    "mensagem sobre o Espírito Santo",
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
    "batismo bíblico estudo adventista"
  ]
};

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

/* ESTADO DO APLICATIVO */

let videos = [];
let currentCategory = "Todos";
let currentQuery = "";
let currentPage = "home";
let loading = false;
let currentSources = [];
let activeVideoId = null;
let soundEnabled = false;
let youtubeReady = false;
let observer = null;
let toastTimer = null;
let requestNumber = 0;

const players = new Map();
const manuallyPaused = new Set();
const seenForYou = new Set();

/* FUNÇÕES BÁSICAS */

function byId(id) {
  return document.getElementById(id);
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function showToast(message) {
  const toast = byId("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function setWelcome(show) {
  byId("welcome")?.classList.toggle("hidden", !show);
}

function setFeedMessage(message) {
  const feed = byId("feed");
  if (!feed) return;

  const old = byId("feedMessage");
  if (old) old.remove();

  if (!message) return;

  const element = document.createElement("div");
  element.id = "feedMessage";
  element.className = "feed-message";
  element.textContent = message;

  feed.appendChild(element);
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    showToast("Não foi possível salvar neste aparelho.");
  }
}

const likedVideos = new Set(
  readStorage("conectaFeLiked", [])
);

const savedVideoData = readStorage(
  "conectaFeSavedVideos",
  {}
);

const savedVideos = new Set(
  Object.keys(savedVideoData)
);

function getRandomQueries(array, amount) {
  return shuffle(array).slice(0, amount);
    }
/* PREPARAR PESQUISAS */

function prepareSearchSources() {
  const sources = [];

  if (
    currentCategory === "Pregação" ||
    currentCategory === "Bíblia"
  ) {
    getRandomQueries(
      DOCTRINE_SEARCHES[currentCategory] || [],
      2
    ).forEach(query => {
      sources.push({
        query,
        channelId: null,
        token: null
      });
    });

    return sources;
  }

  if (currentCategory === "Todos" && !currentQuery) {
    const queries = getRandomQueries(FOR_YOU_SEARCHES, 1);

    queries.forEach(query => {
      sources.push({
        query,
        channelId: null,
        token: null
      });
    });

    APPROVED_CHANNELS.forEach(channel => {
      sources.push({
        query: queries[0],
        channelId: channel.id,
        token: null
      });
    });

    return sources;
  }

  return [{
    query: currentQuery ||
      CATEGORY_SEARCH[currentCategory] ||
      CATEGORY_SEARCH.Todos,
    channelId: null,
    token: null
  }];
}

/* YOUTUBE DATA API */

async function youtubeSearch(source, pageToken) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "25",
    q: source.query,
    regionCode: "BR",
    relevanceLanguage: "pt",
    safeSearch: "strict",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    key: API_KEY
  });

  if (source.channelId) {
    params.set("channelId", source.channelId);
  }

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/search?" +
    params.toString()
  );

  const data = await response.json();

  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason;

    if (reason === "quotaExceeded") {
      throw new Error(
        "A cota diária do YouTube foi atingida. Tente novamente amanhã."
      );
    }

    if (reason === "keyInvalid") {
      throw new Error("A chave da API é inválida.");
    }

    throw new Error(
      data.error?.message || "Erro ao buscar vídeos."
    );
  }

  return {
    items: (data.items || []).map(item => {
      const snippet = item.snippet || {};

      return {
        id: item.id?.videoId,
        title: snippet.title || "",
        description: snippet.description || "",
        channelId: snippet.channelId || "",
        channelTitle: snippet.channelTitle || ""
      };
    }).filter(video => video.id),

    nextPageToken: data.nextPageToken || null
  };
}

/* CONTROLE DOS PLAYERS */

function stopPlayers() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  players.forEach(player => {
    try {
      player.destroy();
    } catch (_) {}
  });

  players.clear();
  manuallyPaused.clear();
  activeVideoId = null;
}

function clearFeed() {
  stopPlayers();

  const feed = byId("feed");

  if (feed) {
    feed.innerHTML = "";
  }

  videos = [];
}

/* EVITAR TÍTULOS REPETIDOS */

function titleSimilarity(a, b) {
  const normalize = text => String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(word => word.length > 2);

  const first = new Set(normalize(a));
  const second = new Set(normalize(b));

  if (!first.size || !second.size) {
    return false;
  }

  let common = 0;

  first.forEach(word => {
    if (second.has(word)) common++;
  });

  return common /
    (first.size + second.size - common) > 0.78;
    }
  
function renderVideos() {
  feed.innerHTML = "";

  if (!videos.length) {
    showEmpty("Nenhum vídeo encontrado. Tente outra categoria ou pesquisa.");
    return;
  }

  videos.forEach((video, index) => {
    const card = document.createElement("article");
    card.className = "video-card";
    card.dataset.videoId = video.id;
    card.dataset.index = index;

    const liked = likedVideos.includes(video.id);
    const saved = savedVideos.includes(video.id);

    card.innerHTML = `
      <div class="player-shell">
        <div id="player-${video.id}"></div>
      </div>

      <div class="video-shade"></div>

      <button class="video-tap-layer"
        data-action="play"
        aria-label="Reproduzir ou pausar vídeo"></button>

      <div class="play-state">▶</div>

      <button class="sound-button ${soundEnabled ? "hidden" : ""}"
        data-action="sound">
        ${soundEnabled ? "Som ativado" : "Ativar som"}
      </button>

      <div class="video-info">
        <div class="video-channel">
          ${escapeHTML(video.channelTitle || "Canal cristão")}
        </div>
        <div class="video-title">
          ${escapeHTML(video.title)}
        </div>
      </div>

      <div class="video-actions">
        <button class="action-button ${liked ? "active" : ""}"
          data-action="like">
          <span class="action-icon">${liked ? "♥" : "♡"}</span>
          <small>Curtir</small>
        </button>

        <button class="action-button ${saved ? "active" : ""}"
          data-action="save">
          <span class="action-icon">${saved ? "★" : "☆"}</span>
          <small>Salvar</small>
        </button>

        <button class="action-button"
          data-action="share">
          <span class="action-icon">↗</span>
          <small>Compartilhar</small>
        </button>
      </div>
    `;

    feed.appendChild(card);
  });

  setupObserver();
}

function createPlayer(videoId) {
  if (!window.YT || !YT.Player) return;
  if (players[videoId]) return;

  const playerElement = document.getElementById(`player-${videoId}`);
  if (!playerElement) return;

  players[videoId] = new YT.Player(playerElement, {
    videoId: videoId,

    playerVars: {
      autoplay: 0,
      controls: 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      enablejsapi: 1,
      origin: window.location.origin
    },

    events: {
      onReady: function(event) {
        event.target.mute();

        if (videoId === activeVideoId) {
          event.target.playVideo();
        }
      },

      onStateChange: function(event) {
        if (event.data === YT.PlayerState.ENDED) {
          playNextVideo(videoId);
        }

        if (event.data === YT.PlayerState.PAUSED) {
          updatePlaybackIndicator(videoId, true);
        }

        if (event.data === YT.PlayerState.PLAYING) {
          updatePlaybackIndicator(videoId, false);
        }
      },

      onError: function() {
        showToast("Este vídeo não pode ser reproduzido aqui.");
      }
    }
  });
}

function setupObserver() {
  if (window.feedObserver) {
    window.feedObserver.disconnect();
  }

  window.feedObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        const card = entry.target;
        const videoId = card.dataset.videoId;

        if (videoId) {
          activateVideo(videoId);
        }
      }
    });
  }, {
    root: feed,
    threshold: [0.6, 0.8]
  });

  document.querySelectorAll(".video-card").forEach(card => {
    window.feedObserver.observe(card);
  });
}

function activateVideo(videoId) {
  if (!videoId) return;

  if (activeVideoId && activeVideoId !== videoId) {
    const previousPlayer = players[activeVideoId];

    if (previousPlayer && previousPlayer.pauseVideo) {
      previousPlayer.pauseVideo();
    }
  }

  activeVideoId = videoId;

  if (!players[videoId]) {
    createPlayer(videoId);
    return;
  }

  const player = players[videoId];

  if (player && player.playVideo) {
    if (soundEnabled) {
      player.unMute();
    } else {
      player.mute();
    }

    player.playVideo();
  }
}

function togglePlayback(videoId) {
  const player = players[videoId];

  if (!player || !player.getPlayerState) return;

  const state = player.getPlayerState();

  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
    updatePlaybackIndicator(videoId, true);
  } else {
    activeVideoId = videoId;
    player.playVideo();
    updatePlaybackIndicator(videoId, false);
  }
}

function updatePlaybackIndicator(videoId, paused) {
  const card = document.querySelector(
    `.video-card[data-video-id="${videoId}"]`
  );

  if (!card) return;

  const indicator = card.querySelector(".play-state");
  if (!indicator) return;

  indicator.textContent = paused ? "▶" : "Ⅱ";
  indicator.classList.toggle("visible", paused);
}

function pauseVideo(videoId) {
  const player = players[videoId];

  if (player && player.pauseVideo) {
    player.pauseVideo();
  }
}

function playNextVideo(videoId) {
  const index = videos.findIndex(video => video.id === videoId);

  if (index >= 0 && index < videos.length - 1) {
    const nextCard = document.querySelector(
      `.video-card[data-index="${index + 1}"]`
    );

    if (nextCard) {
      nextCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }
                    }
  
function toggleSound() {
  soundEnabled = !soundEnabled;

  Object.values(players).forEach(player => {
    if (!player || !player.mute) return;

    if (soundEnabled) {
      player.unMute();
      player.setVolume(100);
    } else {
      player.mute();
    }
  });

  updateSoundIndicators();
}

function updateSoundIndicators() {
  document.querySelectorAll(".sound-button").forEach(button => {
    button.classList.toggle("hidden", soundEnabled);
    button.textContent = soundEnabled ? "Som ativado" : "Ativar som";
  });
}

function toggleLike(videoId) {
  if (likedVideos.includes(videoId)) {
    likedVideos = likedVideos.filter(id => id !== videoId);
  } else {
    likedVideos.push(videoId);
  }

  localStorage.setItem("conectaFeLikes", JSON.stringify(likedVideos));

  const video = videos.find(item => item.id === videoId);
  if (video) renderVideos();
}

function toggleSave(videoId) {
  if (savedVideos.includes(videoId)) {
    savedVideos = savedVideos.filter(id => id !== videoId);
    showToast("Vídeo removido dos salvos.");
  } else {
    savedVideos.push(videoId);
    showToast("Vídeo salvo!");
  }

  localStorage.setItem("conectaFeSaved", JSON.stringify(savedVideos));

  const card = document.querySelector(
    `.video-card[data-video-id="${videoId}"]`
  );

  if (card) {
    const button = card.querySelector('[data-action="save"]');

    if (button) {
      const saved = savedVideos.includes(videoId);
      button.classList.toggle("active", saved);
      button.querySelector(".action-icon").textContent = saved ? "★" : "☆";
    }
  }
}

async function shareVideo(video) {
  const url = `https://www.youtube.com/watch?v=${video.id}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: video.title,
        text: "Assista a este vídeo no Conecta Fé!",
        url: url
      });
    } catch (error) {
      if (error.name !== "AbortError") {
        showToast("Não foi possível compartilhar.");
      }
    }
  } else {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiado!");
    } catch (error) {
      showToast("Não foi possível copiar o link.");
    }
  }
}

function openSearch() {
  searchPanel.classList.add("open");
  searchInput.focus();
}

function closeSearch() {
  searchPanel.classList.remove("open");
  searchInput.value = "";
}

function performSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    showToast("Digite algo para pesquisar.");
    return;
  }

  currentQuery = query;
  currentCategory = "Todos";

  closeSearch();
  feed.scrollTop = 0;

  loadVideos();
}

function updateCategoryButtons(category) {
  document.querySelectorAll(".category").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.category === category
    );
  });
}

function showSavedVideos() {
  stopAllPlayers();

  const saved = savedVideos
    .map(id => videos.find(video => video.id === id))
    .filter(Boolean);

  videos = saved;
  renderVideos();

  if (!saved.length) {
    showEmpty("Seus vídeos salvos aparecerão aqui.");
  }
}

function showHome() {
  currentQuery = "";
  currentCategory = "Todos";

  updateCategoryButtons("Todos");
  stopAllPlayers();

  feed.scrollTop = 0;
  loadVideos();
}

function showExplore() {
  openSearch();
}

function loadSavedVideosFromStorage() {
  try {
    savedVideos = JSON.parse(
      localStorage.getItem("conectaFeSaved") || "[]"
    );

    likedVideos = JSON.parse(
      localStorage.getItem("conectaFeLikes") || "[]"
    );

    if (!Array.isArray(savedVideos)) savedVideos = [];
    if (!Array.isArray(likedVideos)) likedVideos = [];
  } catch (error) {
    savedVideos = [];
    likedVideos = [];
  }
}

/* Ações dos botões dentro dos vídeos */
feed.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const card = button.closest(".video-card");
  if (!card) return;

  const videoId = card.dataset.videoId;
  const action = button.dataset.action;

  if (action === "play") {
    togglePlayback(videoId);
  }

  if (action === "sound") {
    soundEnabled = true;
    toggleSound();
  }

  if (action === "like") {
    toggleLike(videoId);
  }

  if (action === "save") {
    toggleSave(videoId);
  }

  if (action === "share") {
    const video = videos.find(item => item.id === videoId);
    if (video) shareVideo(video);
  }
});

/* Categorias */
document.querySelectorAll(".category").forEach(button => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;

    currentCategory = category;
    currentQuery = "";

    updateCategoryButtons(category);
    stopAllPlayers();

    feed.scrollTop = 0;
    loadVideos();
  });
});

/* Navegação inferior */
document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    if (page === "home") {
      showHome();
    }

    if (page === "explore") {
      showExplore();
    }

    if (page === "saved") {
      showSavedVideos();
    }
  });
});

/* Botões da pesquisa */
document.getElementById("searchButton").addEventListener(
  "click",
  openSearch
);

document.getElementById("closeSearch").addEventListener(
  "click",
  closeSearch
);

document.getElementById("doSearch").addEventListener(
  "click",
  performSearch
);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    performSearch();
  }
});

/* Tela inicial */
document.getElementById("startButton").addEventListener("click", () => {
  welcome.classList.add("hidden");
  userActivatedSound = true;
  loadVideos();
});

/* Inicialização da API do YouTube */
window.onYouTubeIframeAPIReady = function() {
  playerReady = true;
};

/* Recupera os vídeos salvos e curtidas */
loadSavedVideosFromStorage();

/* Carrega o feed quando a API estiver pronta */
let initialLoadStarted = false;

function startInitialFeed() {
  if (initialLoadStarted || !playerReady) return;

  initialLoadStarted = true;
  showLoading();
  loadVideos();
}

/* Aguarda a API do YouTube */
const youtubeApiCheck = setInterval(() => {
  if (playerReady) {
    clearInterval(youtubeApiCheck);
    startInitialFeed();
  }
}, 300);

/* Segurança: interrompe vídeos quando o aplicativo fica em segundo plano */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAllPlayers();
  }
});
