// ==========================================
// CONECTA FÉ
// ==========================================

// Coloque aqui sua chave nova do YouTube Data API
const API_KEY = "AIzaSyAS3BhR0B7d2ElA86jMirUB7hoMM_zWBc8";

const feed = document.getElementById("feed");
const toast = document.getElementById("toast");
const welcome = document.getElementById("welcome");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");

let videos = [];
let nextPageToken = "";
let currentCategory = "Todos";
let currentQuery = "";
let currentPage = "home";
let loading = false;
let playerReady = false;
let activeVideoId = null;
let soundEnabled = false;

const players = new Map();
const savedVideos = new Set(
  JSON.parse(localStorage.getItem("conectaFeSaved") || "[]")
);
const likedVideos = new Set(
  JSON.parse(localStorage.getItem("conectaFeLiked") || "[]")
);

const categorySearch = {
  "Todos": "Jesus evangelho pregação cristã louvor",
  "Jesus": "Jesus Cristo vida e ensinamentos",
  "Pregação": "pregação evangélica mensagem bíblica",
  "Louvor": "louvor cristão música gospel adoração",
  "Bíblia": "estudo bíblico palavra de Deus",
  "Oração": "oração cristã mensagem oração",
  "Testemunho": "testemunho cristão transformação de vida"
};

function showToast(message) {
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

async function loadVideos(reset = true) {
  if (loading) return;

  if (!apiKeyIsValid()) {
    showEmpty("Configure sua chave da API do YouTube no arquivo app.js.");
    return;
  }

  if (reset) {
    videos = [];
    nextPageToken = "";
    feed.innerHTML = "";
    showLoading();
  }

  loading = true;

  try {
    let query = currentQuery;

    if (!query) {
      query = categorySearch[currentCategory] || categorySearch["Todos"];
    }

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: "12",
      order: "relevance",
      safeSearch: "strict",
      videoEmbeddable: "true",
      videoSyndicated: "true",
      key: API_KEY
    });

    if (nextPageToken) {
      params.set("pageToken", nextPageToken);
    }

    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/search?" + params.toString()
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Erro ao buscar vídeos.");
    }

    nextPageToken = data.nextPageToken || "";

    const newVideos = (data.items || [])
      .filter(item => item.id && item.id.videoId)
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        description: item.snippet.description || ""
      }));

    if (reset) {
      videos = newVideos;
    } else {
      const existing = new Set(videos.map(video => video.id));
      videos.push(...newVideos.filter(video => !existing.has(video.id)));
    }

    if (reset) {
      feed.innerHTML = "";
    }

    if (videos.length === 0) {
      showEmpty("Não encontramos vídeos para esta pesquisa.");
      return;
    }

    renderVideos(reset ? newVideos : newVideos);
    setupObserver();

  } catch (error) {
    console.error(error);
    showEmpty("Não foi possível carregar os vídeos. Verifique sua conexão e a chave da API.");
  } finally {
    loading = false;
  }
}

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
        aria-label="Ativar ou desativar o som"></button>

      <div class="video-shade"></div>

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

    card.querySelector(".video-tap-layer").addEventListener("click", () => {
      toggleSound(video.id);
    });

    card.querySelector(".like-button").addEventListener("click", () => {
      toggleLike(video.id, card);
    });

    card.querySelector(".save-button").addEventListener("click", () => {
      toggleSave(video.id, card);
    });

    card.querySelector(".share-button").addEventListener("click", () => {
      shareVideo(video);
    });
  });
}

// ==========================================
// YOUTUBE PLAYER
// ==========================================

window.onYouTubeIframeAPIReady = function () {
  playerReady = true;
  setupObserver();
};

function createPlayer(videoId) {
  if (!playerReady || !window.YT || !YT.Player) return;

  if (players.has(videoId)) {
    const existing = players.get(videoId);

    try {
      if (videoId === activeVideoId) {
        existing.playVideo();
      }
    } catch (error) {}

    return;
  }

  const element = document.getElementById("player-" + videoId);
  if (!element) return;

  const player = new YT.Player(element, {
    videoId: videoId,

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
          event.target.mute();
          event.target.setVolume(0);

          if (videoId === activeVideoId) {
            event.target.playVideo();
          }
        } catch (error) {
          console.log("Player aguardando reprodução.");
        }
      },

      onStateChange: function (event) {
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

function setupObserver() {
  if (!playerReady) return;

  if (window.videoObserver) {
    window.videoObserver.disconnect();
  }

  window.videoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const card = entry.target;
      const videoId = card.dataset.videoId;

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

function activateVideo(videoId) {
  activeVideoId = videoId;

  // Pausa todos os outros vídeos.
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

  if (player) {
    try {
      player.mute();
      player.playVideo();
    } catch (error) {}
  }

  updateSoundIndicators();
}

function pauseVideo(videoId) {
  const player = players.get(videoId);

  if (player) {
    try {
      player.pauseVideo();
    } catch (error) {}
  }
}

function playNextVideo(videoId) {
  const card = document.getElementById("card-" + videoId);
  if (!card) return;

  const next = card.nextElementSibling;

  if (next && next.classList.contains("video-card")) {
    next.scrollIntoView({ behavior: "smooth" });
  }
}

// ==========================================
// CONTROLE DE SOM
// ==========================================

function toggleSound(videoId) {
  const player = players.get(videoId);

  if (!player) {
    showToast("Preparando vídeo. Toque novamente para ativar o som.");
    createPlayer(videoId);
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
      showToast("🔊 Som ativado");
    } else {
      player.mute();
      soundEnabled = false;
      showToast("🔇 Som desativado");
    }
  } catch (error) {
    showToast("Toque novamente para controlar o som.");
  }

  updateSoundIndicators();
}

function updateSoundIndicators() {
  document.querySelectorAll(".video-card").forEach(card => {
    const id = card.dataset.videoId;
    const indicator = card.querySelector(".sound-indicator");

    if (!indicator) return;

    if (id === activeVideoId) {
      indicator.textContent = soundEnabled
        ? "🔊 Som ativado"
        : "🔇 Toque para ativar o som";
    } else {
      indicator.textContent = "🔇";
    }
  });
}

// ==========================================
// CURTIR E SALVAR
// ==========================================

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
  button.querySelector(".action-icon").textContent = active ? "♥" : "♡";
}

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
  button.querySelector(".action-icon").textContent = active ? "★" : "☆";
}

// ==========================================
// COMPARTILHAR
// ==========================================

async function shareVideo(video) {
  const url = "https://www.youtube.com/watch?v=" + video.id;

  if (navigator.share) {
    try {
      await navigator.share({
        title: video.title,
        text: "Assista a este vídeo no Conecta Fé!",
        url: url
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

// ==========================================
// PESQUISA
// ==========================================

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
  welcome.classList.remove("show");

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

// ==========================================
// CATEGORIAS
// ==========================================

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

// ==========================================
// NAVEGAÇÃO
// ==========================================

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    currentPage = page;

    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    welcome.classList.remove("show");

    if (page === "home") {
      currentQuery = "";
      currentCategory = "Todos";
      updateCategoryButtons();
      loadVideos(true);
    }

    if (page === "explore") {
      currentQuery = "";
      currentCategory = "Pregação";
      updateCategoryButtons();
      loadVideos(true);
    }

    if (page === "saved") {
      showSavedVideos();
    }
  });
});

function showSavedVideos() {
  const saved = videos.filter(video => savedVideos.has(video.id));

  if (saved.length > 0) {
    feed.innerHTML = "";
    renderVideos(saved);
    setupObserver();
    return;
  }

  showEmpty("Seus vídeos salvos aparecerão aqui. Toque na estrela de um vídeo para guardá-lo.");
}

// ==========================================
// CARREGAR MAIS VÍDEOS
// ==========================================

feed.addEventListener("scroll", () => {
  if (loading || currentPage === "saved" || !nextPageToken) return;

  const remaining =
    feed.scrollHeight - feed.scrollTop - feed.clientHeight;

  if (remaining < feed.clientHeight * 1.5) {
    loadVideos(false);
  }
});

// ==========================================
// INÍCIO
// ==========================================

document.getElementById("startButton").addEventListener("click", () => {
  welcome.classList.remove("show");
  currentPage = "home";
  loadVideos(true);
});

window.addEventListener("load", () => {
  if (!apiKeyIsValid()) {
    showEmpty("Adicione sua chave da API do YouTube no arquivo app.js.");
    return;
  }

  loadVideos(true);
});
