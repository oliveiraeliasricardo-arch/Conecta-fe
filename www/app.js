
/* =====================================
   CONECTA FÉ
   Sistema de vídeos do YouTube
===================================== */

const API_KEY = "AIzaSyCVKPD1cjw6_ltk2vf7EcQrJXDva4UXjUg";

const API_URL = "https://www.googleapis.com/youtube/v3/search";

const feed = document.getElementById("feed");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");

let activeCategory = "Jesus Cristo evangelho mensagem bíblica";

let nextPageToken = "";
let loading = false;
let observer = null;

let soundEnabled = false;

let players = new Map();
let currentVideos = [];
let videoData = new Map();
let savedVideos = new Set();


/* =====================================
   MENSAGENS
===================================== */

function toast(message) {

    const el = document.getElementById("toast");

    el.textContent = message;

    el.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
        el.classList.remove("show");
    }, 2200);

}


/* =====================================
   TELA INICIAL
===================================== */

function showWelcome() {

    feed.innerHTML = `
        <div class="welcome">

            <div class="cross">✝</div>

            <h1>Alimente sua fé.</h1>

            <p>
                Vídeos sobre Jesus, Palavra,
                louvor e vida cristã.
            </p>

            <button id="startButton"
                class="primary-button">
                Começar a assistir
            </button>

        </div>
    `;

    document.getElementById("startButton")
        .addEventListener("click", () => {
            loadVideos(activeCategory, true);
        });

}


/* =====================================
   ENCERRAR PLAYERS ANTERIORES
===================================== */

function destroyPlayers() {

    players.forEach(player => {

        try {
            player.destroy();
        } catch (error) {}

    });

    players.clear();

}


/* =====================================
   BUSCAR VÍDEOS NO YOUTUBE
===================================== */

async function loadVideos(query, reset = false) {

    if (loading) return;

    if (API_KEY === "COLOQUE_SUA_CHAVE_API_AQUI") {

        toast("Configure sua chave da API do YouTube.");

        return;

    }

    loading = true;

    if (reset) {

        destroyPlayers();

        nextPageToken = "";

        currentVideos = [];

        videoData.clear();

        feed.innerHTML = "";

    }

    const loader = document.createElement("div");

    loader.className = "loading-card";

    loader.innerHTML = `
        <div>
            <div class="spinner"></div>
            Carregando vídeos...
        </div>
    `;

    feed.appendChild(loader);

    try {

        const params = new URLSearchParams({

            part: "snippet",

            q: query + " cristão",

            type: "video",

            videoEmbeddable: "true",

            videoSyndicated: "true",

            safeSearch: "strict",

            maxResults: "12",

            order: "relevance",

            key: API_KEY

        });

        if (nextPageToken) {

            params.set("pageToken", nextPageToken);

        }

        const response = await fetch(
            `${API_URL}?${params.toString()}`
        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error?.message ||
                "Não foi possível carregar os vídeos."
            );

        }

        nextPageToken = data.nextPageToken || "";

        const items = (data.items || []).filter(item => {

            return item.id?.videoId && item.snippet;

        });

        loader.remove();

        if (reset && items.length === 0) {

            feed.innerHTML = `
                <div class="error">
                    Nenhum vídeo encontrado.
                    Tente outra pesquisa.
                </div>
            `;

            return;

        }

        items.forEach(addVideoCard);

        if (!items.length && !currentVideos.length) {

            feed.innerHTML = `
                <div class="error">
                    Não encontramos vídeos nesta busca.
                </div>
            `;

        }

        observeCards();

    } catch (error) {

        loader.remove();

        const card = document.createElement("div");

        card.className = "error";

        card.textContent =
            "Erro ao carregar vídeos: " + error.message;

        feed.appendChild(card);

    } finally {

        loading = false;

    }

}


/* =====================================
   CRIAR CARTÃO DO VÍDEO
===================================== */

function addVideoCard(item) {

    const id = item.id.videoId;

    const s = item.snippet;

    if (currentVideos.includes(id)) return;

    currentVideos.push(id);

    videoData.set(id, item);

    const card = document.createElement("article");

    card.className = "video-card";

    card.dataset.videoId = id;

    card.innerHTML = `

        <div class="player-shell">

            <div id="player-${id}"></div>

        </div>

        <div class="video-shade"></div>

        <button class="sound-toggle" data-sound>
            ♫ Ativar som
        </button>

        <div class="video-info">

            <div class="video-channel">
                ▶ ${escapeHTML(s.channelTitle)}
            </div>

            <h2 class="video-title">
                ${escapeHTML(s.title)}
            </h2>

            <div class="video-description">
                ${escapeHTML(s.description || "Conteúdo do YouTube.")}
            </div>

        </div>

        <div class="video-actions">

            <button class="action-button" data-like>
                ♡
            </button>

            <span class="action-label">Curtir</span>

            <button class="action-button" data-share>
                ↗
            </button>

            <span class="action-label">Enviar</span>

            <button class="action-button" data-save>
                ${savedVideos.has(id) ? "✓" : "＋"}
            </button>

            <span class="action-label">Salvar</span>

        </div>

    `;


    /* CURTIR */

    card.querySelector("[data-like]")
        .addEventListener("click", event => {

            const button = event.currentTarget;

            button.textContent =
                button.textContent === "♡" ? "♥" : "♡";

        });


    /* COMPARTILHAR */

    card.querySelector("[data-share]")
        .addEventListener("click", () => {

            shareVideo(id, s.title);

        });


    /* SALVAR */

    card.querySelector("[data-save]")
        .addEventListener("click", event => {

            const button = event.currentTarget;

            if (savedVideos.has(id)) {

                savedVideos.delete(id);

                button.textContent = "＋";

                toast("Vídeo removido dos salvos.");

            } else {

                savedVideos.add(id);

                button.textContent = "✓";

                toast("Vídeo salvo nesta sessão.");

            }

        });


    /* SOM */

    card.querySelector("[data-sound]")
        .addEventListener("click", () => {

            soundEnabled = !soundEnabled;

            players.forEach(player => {

                if (soundEnabled) {
                    player.unMute();
                } else {
                    player.mute();
                }

            });

            card.querySelector("[data-sound]").textContent =
                soundEnabled
                ? "♫ Som ativado"
                : "♫ Ativar som";

        });


    feed.appendChild(card);

}


/* =====================================
   PROTEÇÃO DE TEXTO HTML
===================================== */

function escapeHTML(value) {

    return String(value || "").replace(
        /[&<>"']/g,
        character => ({

            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"

        })[character]
    );

}


/* =====================================
   COMPARTILHAR VÍDEO
===================================== */

async function shareVideo(id, title) {

    const url =
        `https://www.youtube.com/watch?v=${id}`;

    try {

        if (navigator.share) {

            await navigator.share({
                title: title,
                url: url
            });

        } else {

            await navigator.clipboard.writeText(url);

            toast("Link copiado!");

        }

    } catch (error) {

        if (error.name !== "AbortError") {

            toast("Não foi possível compartilhar.");

        }

    }

}


/* =====================================
   OBSERVAR VÍDEOS NA TELA
===================================== */

function observeCards() {

    if (observer) {

        observer.disconnect();

    }

    observer = new IntersectionObserver(entries => {

        entries.forEach(entry => {

            const id = entry.target.dataset.videoId;

            if (
                entry.isIntersecting &&
                entry.intersectionRatio >= 0.65
            ) {

                createPlayer(id);

            } else {

                const player = players.get(id);

                if (player && player.pauseVideo) {

                    player.pauseVideo();

                }

            }

        });

    }, {

        root: feed,

        threshold: [0, 0.65, 1]

    });


    feed.querySelectorAll(".video-card")
        .forEach(card => observer.observe(card));


    /* CARREGAR MAIS VÍDEOS */

    feed.onscroll = () => {

        if (
            feed.scrollTop + feed.clientHeight >=
            feed.scrollHeight - 500 &&
            nextPageToken
        ) {

            loadVideos(activeCategory, false);

        }

    };

}


/* =====================================
   PLAYER AUTOMÁTICO DO YOUTUBE
===================================== */

function createPlayer(id) {

    if (!window.YT || !YT.Player) return;

    if (players.has(id)) {

        const player = players.get(id);

        if (player.playVideo) {

            player.playVideo();

        }

        return;

    }

    const host = document.getElementById(
        `player-${id}`
    );

    if (!host) return;

    const player = new YT.Player(host, {

        videoId: id,

        playerVars: {

            autoplay: 1,

            controls: 1,

            playsinline: 1,

            rel: 0,

            modestbranding: 1,

            iv_load_policy: 3,

            fs: 1,

            enablejsapi: 1

        },

        events: {

            onReady: event => {

                if (soundEnabled) {

                    event.target.unMute();

                } else {

                    event.target.mute();

                }

                event.target.playVideo();

            },

            onStateChange: event => {

                if (
                    event.data === YT.PlayerState.ENDED
                ) {

                    event.target.seekTo(0);

                    event.target.playVideo();

                }

            }

        }

    });

    players.set(id, player);

}


/* =====================================
   API DO PLAYER
===================================== */

window.onYouTubeIframeAPIReady = function() {

    observeCards();

};


/* =====================================
   CATEGORIAS
===================================== */

document.querySelectorAll(".category")
    .forEach(button => {

        button.addEventListener("click", () => {

            document.querySelectorAll(".category")
                .forEach(b => b.classList.remove("active"));

            button.classList.add("active");

            activeCategory = button.dataset.query;

            loadVideos(activeCategory, true);

        });

    });


/* =====================================
   BOTÃO INICIAR
===================================== */

document.getElementById("startButton")
    .addEventListener("click", () => {

        loadVideos(activeCategory, true);

    });


/* =====================================
   PESQUISA
===================================== */

document.getElementById("searchOpen")
    .addEventListener("click", () => {

        searchPanel.classList.remove("hidden");

        searchInput.focus();

    });


document.getElementById("searchBack")
    .addEventListener("click", () => {

        searchPanel.classList.add("hidden");

    });


document.getElementById("searchButton")
    .addEventListener("click", () => {

        const query = searchInput.value.trim();

        if (!query) {

            toast("Digite o que deseja pesquisar.");

            return;

        }

        activeCategory = query;

        searchPanel.classList.add("hidden");

        document.querySelectorAll(".category")
            .forEach(b => b.classList.remove("active"));

        loadVideos(query, true);

    });


searchInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {

        document.getElementById("searchButton").click();

    }

});


/* =====================================
   MENU INFERIOR
===================================== */

document.getElementById("homeButton")
    .addEventListener("click", () => {

        searchPanel.classList.add("hidden");

        feed.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });


document.getElementById("exploreButton")
    .addEventListener("click", () => {

        searchPanel.classList.remove("hidden");

        searchInput.focus();

    });


document.getElementById("savedButton")
    .addEventListener("click", () => {

        toast(
            "Vídeos salvos: " + savedVideos.size
        );

    });

          
