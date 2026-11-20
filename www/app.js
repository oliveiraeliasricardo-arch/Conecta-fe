
/* =====================================================
   CONECTA FÉ
   Aplicativo cristão com curadoria adventista
   ===================================================== */

const API_KEY = "AIzaSyAS3BhR0B7d2ElA86jMirUB7hoMM_zWBc8";

// =====================================================
// ELEMENTOS
// =====================================================

const feed = document.getElementById("feed");
const toast = document.getElementById("toast");
const welcome = document.getElementById("welcome");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");

// =====================================================
// CANAIS ADVENTISTAS APROVADOS
// =====================================================

// Cadastre aqui os IDs reais dos canais adventistas.
// Todos os vídeos desses canais serão aceitos nas
// categorias Pregações e Bíblia.

const APPROVED_CHANNELS = [
  {
    id: "UCJAO3KgZdEhCqwpkZyAYY6A",
    name: "Adventistas Brasil"
  }
];

const APPROVED_CREATOR_CHANNEL_IDS = [
  // Adicione outros IDs de canais adventistas aqui.
];

// =====================================================
// CATEGORIAS
// =====================================================

const categorySearch = {
  "Todos": "Jesus Cristo evangelho louvor cristão adoração",
  "Jesus": "Jesus Cristo vida de Jesus milagres parábolas evangelho",
  "Pregação": "pregação bíblica sermão cristão",
  "Louvor": "louvor cristão adoração hinos gospel música cristã",
  "Bíblia": "estudo bíblico interpretação bíblica palavra de Deus",
  "Oração": "oração cristã oração a Deus",
  "Testemunho": "testemunho cristão transformação de vida"
};

const ADVENTIST_ONLY_CATEGORIES = new Set([
  "Pregação",
  "Bíblia"
]);

// =====================================================
// ESTADOS
// =====================================================

let videos = [];
let channelPageTokens = {};
let channelIds = [];

let currentCategory = "Todos";
let currentQuery = "";
let currentPage = "home";

let loading = false;
let playerReady = false;
let activeVideoId = null;

let soundEnabled = false;
let userActivatedSound = false;

const players = new Map();
const manuallyPaused = new Set();

const savedVideos = new Set(
  JSON.parse(localStorage.getItem("conectaFeSaved") || "[]")
);

const likedVideos = new Set(
  JSON.parse(localStorage.getItem("conectaFeLiked") || "[]")
);

// =====================================================
// AVISOS
// =====================================================

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function apiKeyIsValid() {
  return API_KEY &&
    API_KEY !== "COLOQUE_SUA_CHAVE_API_AQUI";
}

function showLoading(message = "Carregando vídeos...") {
  feed.innerHTML = `
    <div class="loading-message">
      <div style="font-size:38px;color:#d8ae55">✝</div>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

function showEmpty(message) {
  feed.innerHTML = `
    <div class="empty-message">
      <div style="font-size:38px;color:#d8ae55">✝</div>
      <h3>Conecta Fé</h3>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

// =====================================================
// IDENTIFICAR CANAIS ADVENTISTAS
// =====================================================

async function resolveApprovedChannels() {
  const ids = [
    ...APPROVED_CREATOR_CHANNEL_IDS,
    ...APPROVED_CHANNELS
      .filter(channel => channel.id)
      .map(channel => channel.id)
  ];

  return [...new Set(ids)];
}

// =====================================================
// VERIFICAR SE A PESQUISA É RESTRITA
// =====================================================

function isAdventistSearch() {
  if (ADVENTIST_ONLY_CATEGORIES.has(currentCategory)) {
    return true;
  }

  if (currentQuery && (
    /\bpregação\b/i.test(currentQuery) ||
    /\bpregacao\b/i.test(currentQuery) ||
    /\bpregações\b/i.test(currentQuery) ||
    /\bpregacoes\b/i.test(currentQuery) ||
    /\bsermão\b/i.test(currentQuery) ||
    /\bsermao\b/i.test(currentQuery) ||
    /\bestudo bíblico\b/i.test(currentQuery) ||
    /\bestudo biblico\b/i.test(currentQuery) ||
    /\bdoutrina\b/i.test(currentQuery)
  )) {
    return true;
  }

  return false;
}

// =====================================================
// CARREGAR VÍDEOS
// =====================================================

async function loadVideos(reset = true) {
  if (loading) return;

  if (!apiKeyIsValid()) {
    showEmpty("Configure sua chave da API do YouTube no arquivo app.js.");
    return;
  }

  if (reset) {
    videos = [];
    channelPageTokens = {};
    feed.innerHTML = "";
    showLoading();
  }

  loading = true;

  try {
    const restrictedSearch = isAdventistSearch();

    const needsAdventistChannels =
      restrictedSearch || currentCategory === "Todos";

    if (needsAdventistChannels && channelIds.length === 0) {
      channelIds = await resolveApprovedChannels();
    }

    const groups = [];

    if (restrictedSearch) {
      // PREGAÇÕES E BÍBLIA:
      // Somente canais adventistas cadastrados.

      channelIds.forEach(channelId => {
        groups.push({
          key: channelId,
          channelId,
          query: currentQuery || categorySearch[currentCategory]
        });
      });

    } else if (currentCategory === "Todos" && !currentQuery) {
      // TODOS:
      // Conteúdo geral sobre Jesus e louvores.

      groups.push({
        key: "__general__",
        query: categorySearch["Todos"]
      });

      // Também inclui pregações e estudos dos canais
      // adventistas cadastrados.

      channelIds.forEach(channelId => {
        groups.push({
          key: channelId,
          channelId,
          query: "pregação bíblica estudo bíblico sermão"
        });
      });

    } else {
      // JESUS, LOUVORES, ORAÇÃO E TESTEMUNHOS:
      // Pesquisa geral no YouTube.

      groups.push({
        key: "__general__",
        query: currentQuery || categorySearch[currentCategory]
      });
    }

    if (groups.length === 0) {
      showEmpty("Nenhum canal adventista foi cadastrado.");
      return;
    }

    const requests = groups.map(async group => {
      const pageToken = channelPageTokens[group.key];

      if (!reset && !pageToken) return [];

      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        q: group.query,
        maxResults: "8",
        order: "date",
        regionCode: "BR",
        relevanceLanguage: "pt",
        safeSearch: "strict",
        videoEmbeddable: "true",
        videoSyndicated: "true",
        key: API_KEY
      });

      if (group.channelId) {
        params.set("channelId", group.channelId);
      }

      if (!reset && pageToken) {
        params.set("pageToken", pageToken);
      }

      const response = await fetch(
        "https://www.googleapis.com/youtube/v3/search?" +
        params.toString()
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Erro na pesquisa do YouTube:", data);
        channelPageTokens[group.key] = "";
        return [];
      }

      channelPageTokens[group.key] = data.nextPageToken || "";

      return (data.items || [])
        .filter(item => item.id && item.id.videoId)
        .map(item => ({
          id: item.id.videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          description: item.snippet.description || "",
          publishedAt: item.snippet.publishedAt
        }))
        .filter(video => {
          if (!restrictedSearch) return true;
          return channelIds.includes(video.channelId);
        });
    });

    const results = await Promise.all(requests);
    const newVideos = results.flat();

    const existing = new Set(videos.map(video => video.id));

    const uniqueVideos = newVideos.filter(
      video => !existing.has(video.id)
    );

    videos.push(...uniqueVideos);

    videos.sort((a, b) =>
      new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    if (videos.length === 0) {
      showEmpty(
        restrictedSearch
          ? "Não encontramos vídeos nos canais adventistas cadastrados."
          : "Não encontramos vídeos para esta categoria."
      );
      return;
    }

    renderVideos(uniqueVideos);
    setupObserver();

  } catch (error) {
    console.error(error);

    showEmpty(
      "Não foi possível carregar os vídeos. Verifique a conexão e a chave da API."
    );

  } finally {
    loading = false;
  }
}

// =====================================================
// CRIAR CARTÕES DOS VÍDEOS
// =====================================================

function renderVideos(list) {
  list.forEach(video => {
    if (document.getElementById("card-" + video.id)) return;

    const card = document.createElement("article");

    card.className = "video-card";
    card.id = "card-" + video.id;
    card.dataset.videoId = video.id;

    const liked = likedVideos.has(video.id);
    const saved = savedVideos.has(video.id);

    card.innerHTML = `
      <div class="player-shell">
        <div id="player-${video.id}"></div>
      </div>

      <button class="video-tap-layer"
        aria-label="Pausar ou continuar vídeo"></button>

      <div class="video-shade"></div>

      <div class="play-state">▶</div>

      <div class="sound-indicator">
        🔇 Toque para ativar o som
      </div>

      <div class="video-info">
        <div class="video-channel">
          ${escapeHTML(video.channel)}
        </div>

        <div class="video-title">
          ${escapeHTML(video.title)}
        </div>

        <div class="video-description">
          ✝ Conteúdo cristão • Conecta Fé
        </div>
      </div>

      <div class="video-actions">
        <button class="action-button sound-button">
          <span class="action-icon sound-icon">🔇</span>
          <span class="action-label">Som</span>
        </button>

        <button class="action-button like-button ${liked ? "liked" : ""}">
          <span class="action-icon">${liked ? "♥" : "♡"}</span>
          <span class="action-label">Curtir</span>
        </button>

        <button class="action-button save-button ${saved ? "saved" : ""}">
          <span class="action-icon">${saved ? "★" : "☆"}</span>
          <span class="action-label">Salvar</span>
        </button>

        <button class="action-button share-button">
          <span class="action-icon">↗</span>
          <span class="action-label">Compartilhar</span>
        </button>
      </div>
    `;

    feed.appendChild(card);

    card.querySelector(".video-tap-layer")
      .addEventListener("click", () => {
        togglePlayback(video.id);
      });

    card.querySelector(".sound-button")
      .addEventListener("click", () => {
        toggleSound(video.id);
      });

    card.querySelector(".like-button")
      .addEventListener("click", () => {
        toggleLike(video.id, card);
      });

    card.querySelector(".save-button")
      .addEventListener("click", () => {
        toggleSave(video.id, card);
      });

    card.querySelector(".share-button")
      .addEventListener("click", () => {
        shareVideo(video);
      });

    updatePlaybackIndicator(video.id);
  });

  updateSoundIndicators();
}

// =====================================================
// YOUTUBE IFRAME PLAYER
// =====================================================

window.onYouTubeIframeAPIReady = function () {
  playerReady = true;
  setupObserver();
};

function createPlayer(videoId) {
  if (!playerReady || !window.YT || !YT.Player) return;
  if (players.has(videoId)) return;

  const element = document.getElementById("player-" + videoId);
  if (!element) return;

  const player = new YT.Player(element, {
    videoId,

    playerVars: {
      autoplay: 1,
      controls: 0,
      playsinline: 1,
      rel: 0,
      fs: 0,
      disablekb: 1,
      iv_load_policy: 3,
      cc_load_policy: 0,
      enablejsapi: 1
    },

    events: {
      onReady: function (event) {
        try {
          if (userActivatedSound && soundEnabled) {
            event.target.unMute();
            event.target.setVolume(100);
          } else {
            event.target.mute();
            event.target.setVolume(0);
          }

          if (
            videoId === activeVideoId &&
            !manuallyPaused.has(videoId)
          ) {
            event.target.playVideo();
          } else {
            event.target.pauseVideo();
          }

        } catch (error) {
          console.log("Player aguardando reprodução.");
        }
      },

      onStateChange: function (event) {
        updatePlaybackIndicator(videoId);

        if (event.data === YT.PlayerState.ENDED) {
          playNextVideo(videoId);
        }
      },

      onError: function (event) {
        console.log("Erro no vídeo do YouTube:", event.data);
      }
    }
  });

  players.set(videoId, player);
}

// =====================================================
// DETECTAR VÍDEO VISÍVEL
// =====================================================

function setupObserver() {
  if (!playerReady) return;

  if (window.videoObserver) {
    window.videoObserver.disconnect();
  }

  window.videoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const videoId = entry.target.dataset.videoId;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
        activateVideo(videoId);
      } else {
        pauseVideo(videoId);
      }
    });
  }, {
    threshold: [0, 0.65, 1]
  });

  document.querySelectorAll(".video-card").forEach(card => {
    window.videoObserver.observe(card);
  });
}

// =====================================================
// ATIVAR VÍDEO
// =====================================================

function activateVideo(videoId) {
  activeVideoId = videoId;

  players.forEach((player, id) => {
    if (id !== videoId) {
      try {
        player.pauseVideo();
        player.mute();
      } catch (error) {}
    }
  });

  createPlayer(videoId);

  const player = players.get(videoId);

  if (player && !manuallyPaused.has(videoId)) {
    try {
      if (userActivatedSound && soundEnabled) {
        player.unMute();
        player.setVolume(100);
      } else {
        player.mute();
      }

      player.playVideo();

    } catch (error) {}
  }

  updatePlaybackIndicator(videoId);
  updateSoundIndicators();
}

// =====================================================
// PAUSAR E CONTINUAR
// =====================================================

function togglePlayback(videoId) {
  const player = players.get(videoId);

  if (!player) {
    createPlayer(videoId);
    showToast("Preparando vídeo...");
    return;
  }

  if (videoId !== activeVideoId) {
    activateVideo(videoId);
    return;
  }

  try {
    const state = player.getPlayerState();

    if (
      state === YT.PlayerState.PLAYING ||
      state === YT.PlayerState.BUFFERING
    ) {
      manuallyPaused.add(videoId);
      player.pauseVideo();
      showToast("Vídeo pausado");

    } else {
      manuallyPaused.delete(videoId);

      if (userActivatedSound && soundEnabled) {
        player.unMute();
        player.setVolume(100);
      }

      player.playVideo();
      showToast("Reproduzindo");
    }

  } catch (error) {
    console.log("Não foi possível alterar a reprodução.");
  }

  updatePlaybackIndicator(videoId);
}

function updatePlaybackIndicator(videoId) {
  const card = document.getElementById("card-" + videoId);
  if (!card) return;

  const indicator = card.querySelector(".play-state");
  const player = players.get(videoId);

  if (!indicator) return;

  let paused = true;

  if (player && window.YT) {
    try {
      const state = player.getPlayerState();

      paused =
        state !== YT.PlayerState.PLAYING &&
        state !== YT.PlayerState.BUFFERING;

    } catch (error) {}
  }

  indicator.textContent = paused ? "▶" : "Ⅱ";
  indicator.classList.toggle("visible", paused);
}

function pauseVideo(videoId) {
  const player = players.get(videoId);

  if (player) {
    try {
      player.pauseVideo();
    } catch (error) {}
  }

  updatePlaybackIndicator(videoId);
}

function playNextVideo(videoId) {
  const card = document.getElementById("card-" + videoId);
  if (!card) return;

  const next = card.nextElementSibling;

  if (next && next.classList.contains("video-card")) {
    next.scrollIntoView({ behavior: "smooth" });
  }
}

// =====================================================
// CONTROLE DE SOM
// =====================================================

function toggleSound(videoId) {
  const player = players.get(videoId);

  if (!player) {
    createPlayer(videoId);
    showToast("Preparando vídeo. Toque novamente para ativar o som.");
    return;
  }

  if (videoId !== activeVideoId) {
    activateVideo(videoId);
  }

  try {
    if (player.isMuted()) {
      player.unMute();
      player.setVolume(100);

      soundEnabled = true;
      userActivatedSound = true;

      showToast("🔊 Som ativado");

    } else {
      player.mute();

      soundEnabled = false;
      userActivatedSound = false;

      showToast("🔇 Som desativado");
    }

  } catch (error) {
    showToast("Não foi possível alterar o som.");
  }

  updateSoundIndicators();
}

function updateSoundIndicators() {
  document.querySelectorAll(".video-card").forEach(card => {
    const id = card.dataset.videoId;
    const button = card.querySelector(".sound-button");

    if (!button) return;

    const icon = button.querySelector(".sound-icon");
    const label = button.querySelector(".action-label");

    const isActive = id === activeVideoId && soundEnabled;

    icon.textContent = isActive ? "🔊" : "🔇";
    label.textContent = isActive ? "Som ligado" : "Som";
  });
}

// =====================================================
// CURTIR
// =====================================================

function toggleLike(videoId, card) {
  if (likedVideos.has(videoId)) {
    likedVideos.delete(videoId);
    showToast("Curtida removida");
  } else {
    likedVideos.add(videoId);
    showToast("Vídeo curtido ❤️");
  }

  localStorage.setItem(
    "conectaFeLiked",
    JSON.stringify([...likedVideos])
  );

  const button = card.querySelector(".like-button");
  const active = likedVideos.has(videoId);

  button.classList.toggle("liked", active);
  button.querySelector(".action-icon").textContent =
    active ? "♥" : "♡";
}

// =====================================================
// SALVAR
// =====================================================

function toggleSave(videoId, card) {
  if (savedVideos.has(videoId)) {
    savedVideos.delete(videoId);
    showToast("Vídeo removido dos salvos");
  } else {
    savedVideos.add(videoId);
    showToast("Vídeo salvo ⭐");
  }

  localStorage.setItem(
    "conectaFeSaved",
    JSON.stringify([...savedVideos])
  );

  const button = card.querySelector(".save-button");
  const active = savedVideos.has(videoId);

  button.classList.toggle("saved", active);
  button.querySelector(".action-icon").textContent =
    active ? "★" : "☆";
}

// =====================================================
// COMPARTILHAR
// =====================================================

async function shareVideo(video) {
  const url = "https://www.youtube.com/watch?v=" + video.id;

  if (navigator.share) {
    try {
      await navigator.share({
        title: video.title,
        text: "Assista a este vídeo no Conecta Fé!",
        url
      });
    } catch (error) {}

  } else {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiado!");
    } catch (error) {
      showToast("Não foi possível copiar o link.");
    }
  }
}

// =====================================================
// PESQUISA
// =====================================================

function openSearch() {
  searchPanel.classList.add("show");
  searchInput.focus();
}

function closeSearch() {
  searchPanel.classList.remove("show");
  searchInput.value = "";
}

function performSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    showToast("Digite o que deseja pesquisar.");
    return;
  }

  currentQuery = query;
  currentCategory = "Todos";
  currentPage = "home";

  updateCategoryButtons();
  closeSearch();

  if (welcome) welcome.classList.remove("show");

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === "home");
  });

  loadVideos(true);
}

document.getElementById("searchButton")
  .addEventListener("click", openSearch);

document.getElementById("closeSearch")
  .addEventListener("click", closeSearch);

document.getElementById("doSearch")
  .addEventListener("click", performSearch);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    performSearch();
  }
});

// =====================================================
// CATEGORIAS
// =====================================================

function updateCategoryButtons() {
  document.querySelectorAll(".category").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.category === currentCategory
    );
  });
}

document.querySelectorAll(".category").forEach(button => {
  button.addEventListener("click", () => {
    currentCategory = button.dataset.category;
    currentQuery = "";
    currentPage = "home";

    updateCategoryButtons();
    loadVideos(true);
  });
});

// =====================================================
// NAVEGAÇÃO
// =====================================================

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    currentPage = page;

    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    if (welcome) welcome.classList.remove("show");

    if (page === "home") {
      currentQuery = "";
      currentCategory = "Todos";

      updateCategoryButtons();
      loadVideos(true);
    }

    if (page === "explore") {
      currentQuery = "";
      currentCategory = "Jesus";

      updateCategoryButtons();
      loadVideos(true);
    }

    if (page === "saved") {
      showSavedVideos();
    }
  });
});

// =====================================================
// VÍDEOS SALVOS
// =====================================================

function showSavedVideos() {
  const saved = videos.filter(video =>
    savedVideos.has(video.id)
  );

  if (saved.length > 0) {
    feed.innerHTML = "";
    renderVideos(saved);
    setupObserver();
    return;
  }

  showEmpty(
    "Seus vídeos salvos aparecerão aqui. Toque na estrela de um vídeo para guardá-lo."
  );
}

// =====================================================
// CARREGAR MAIS VÍDEOS
// =====================================================

feed.addEventListener("scroll", () => {
  if (loading || currentPage === "saved") return;

  const hasMore = Object.values(channelPageTokens)
    .some(token => Boolean(token));

  if (!hasMore) return;

  const remaining =
    feed.scrollHeight -
    feed.scrollTop -
    feed.clientHeight;

  if (remaining < feed.clientHeight * 1.5) {
    loadVideos(false);
  }
});

// =====================================================
// BOTÃO COMEÇAR
// =====================================================

document.getElementById("startButton")
  .addEventListener("click", () => {
    if (welcome) welcome.classList.remove("show");

    currentPage = "home";
    loadVideos(true);
  });

// =====================================================
// INICIALIZAÇÃO
// =====================================================

window.addEventListener("load", () => {
  if (!apiKeyIsValid()) {
    showEmpty(
      "Adicione sua chave da API do YouTube no arquivo app.js."
    );
    return;
  }

  loadVideos(true);
});
