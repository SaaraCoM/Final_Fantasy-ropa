(function () {
  "use strict";

  const state = {
    outfits: [],
    reservations: new Map(),
    gender: "todos",
    search: "",
    game: "todos",
    availability: "todos",
    selectedId: null,
    adapter: null,
    metadata: {}
  };

  const $ = selector => document.querySelector(selector);
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    Object.assign(els, {
      grid: $("#grid"),
      emptyState: $("#emptyState"),
      emptyMessage: $("#emptyMessage"),
      resultCount: $("#resultCount"),
      searchInput: $("#searchInput"),
      gameFilter: $("#gameFilter"),
      availabilityFilter: $("#availabilityFilter"),
      refreshButton: $("#refreshButton"),
      storageBadge: $("#storageBadge"),
      modeNotice: $("#modeNotice"),
      reserveDialog: $("#reserveDialog"),
      reserveForm: $("#reserveForm"),
      reserveSummary: $("#reserveSummary"),
      aliasInput: $("#aliasInput"),
      reserveError: $("#reserveError"),
      releaseDialog: $("#releaseDialog"),
      releaseForm: $("#releaseForm"),
      releaseCodeInput: $("#releaseCodeInput"),
      releaseError: $("#releaseError"),
      successDialog: $("#successDialog"),
      releaseCodeOutput: $("#releaseCodeOutput"),
      copyCodeButton: $("#copyCodeButton"),
      toast: $("#toast")
    });

    bindEvents();

    try {
      const payload = await fetch("data/atuendos.json", { cache: "no-store" }).then(response => {
        if (!response.ok) throw new Error(`No se pudo cargar el catálogo (${response.status}).`);
        return response.json();
      });
      state.outfits = Array.isArray(payload) ? payload : (payload.atuendos || []);
      state.metadata = Array.isArray(payload) ? {} : (payload.metadata || {});
      validateOutfits(state.outfits);
      populateGames();

      state.adapter = window.OutfitStorage.createAdapter(window.APP_CONFIG || { mode: "local" });
      configureModeLabel();
      await refreshReservations();
      state.adapter.subscribe(rows => {
        state.reservations = new Map(rows.map(row => [row.outfit_id, row]));
        render();
      });
      render();
    } catch (error) {
      console.error(error);
      els.resultCount.textContent = "No se pudo iniciar la aplicación.";
      els.emptyState.hidden = false;
      els.emptyMessage.textContent = error.message;
    }
  }

  function validateOutfits(outfits) {
    const ids = new Set();
    for (const item of outfits) {
      const required = ["id", "personaje", "genero", "origen", "atuendo", "archivo"];
      for (const key of required) {
        if (!item[key]) throw new Error(`Registro inválido: falta ${key}.`);
      }
      if (ids.has(item.id)) throw new Error(`ID duplicado: ${item.id}`);
      ids.add(item.id);
      if (!["hombre", "mujer", "otro"].includes(item.genero)) throw new Error(`Género no permitido en ${item.id}.`);
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-gender]").forEach(button => {
      button.addEventListener("click", () => {
        state.gender = button.dataset.gender;
        document.querySelectorAll("[data-gender]").forEach(candidate => {
          const active = candidate === button;
          candidate.classList.toggle("is-active", active);
          candidate.setAttribute("aria-pressed", String(active));
        });
        render();
      });
    });
    els.searchInput.addEventListener("input", event => { state.search = event.target.value.trim().toLocaleLowerCase("es"); render(); });
    els.gameFilter.addEventListener("change", event => { state.game = event.target.value; render(); });
    els.availabilityFilter.addEventListener("change", event => { state.availability = event.target.value; render(); });
    els.refreshButton.addEventListener("click", refreshReservations);
    els.reserveForm.addEventListener("submit", submitReservation);
    els.releaseForm.addEventListener("submit", submitRelease);
    els.copyCodeButton.addEventListener("click", copyReleaseCode);
    document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
  }

  function configureModeLabel() {
    const shared = window.APP_CONFIG?.mode === "supabase";
    els.storageBadge.textContent = shared ? "Modo compartido · Supabase" : "Modo local";
    els.modeNotice.textContent = shared
      ? "Las reservas se sincronizan mediante Supabase. La actualización automática usa sondeo periódico."
      : "Las reservas se guardan solo en este navegador. Para compartir estados entre varias personas, activa Supabase siguiendo el README.";
  }

  function populateGames() {
    const games = [...new Set(state.outfits.map(item => item.origen))].sort((a, b) => a.localeCompare(b, "es"));
    for (const game of games) {
      const option = document.createElement("option");
      option.value = game;
      option.textContent = game;
      els.gameFilter.append(option);
    }
  }

  async function refreshReservations() {
    if (!state.adapter) return;
    els.refreshButton.disabled = true;
    try {
      const rows = await state.adapter.list();
      state.reservations = new Map(rows.map(row => [row.outfit_id, row]));
      render();
      showToast("Estados actualizados.");
    } catch (error) {
      showToast(error.message);
    } finally {
      els.refreshButton.disabled = false;
    }
  }

  function filteredOutfits() {
    return state.outfits.filter(item => {
      const occupied = state.reservations.has(item.id);
      return (state.gender === "todos" || item.genero === state.gender)
        && (!state.search || item.personaje.toLocaleLowerCase("es").includes(state.search))
        && (state.game === "todos" || item.origen === state.game)
        && (state.availability === "todos" || (state.availability === "ocupado") === occupied);
    });
  }

  function render() {
    const items = filteredOutfits();
    els.grid.replaceChildren();
    for (const item of items) els.grid.append(createCard(item));
    els.resultCount.textContent = `${items.length} atuendo${items.length === 1 ? "" : "s"} mostrado${items.length === 1 ? "" : "s"}`;
    const empty = items.length === 0;
    els.emptyState.hidden = !empty;
    if (empty) {
      els.emptyMessage.textContent = state.outfits.length
        ? "No existen registros que coincidan con los filtros actuales."
        : (state.metadata.empty_reason || "El catálogo todavía no contiene imágenes autorizadas.");
    }
  }

  function createCard(item) {
    const occupied = state.reservations.has(item.id);
    const card = document.createElement("article");
    card.className = `card${occupied ? " is-occupied" : ""}`;
    card.dataset.outfitId = item.id;

    const media = document.createElement("div");
    media.className = "card__media";
    const image = document.createElement("img");
    image.src = `images/${item.archivo}`;
    image.alt = `${item.personaje}, ${item.atuendo}`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", function () {
      if (image.src.endsWith("images/placeholder.svg")) {
        return;
      }
      image.src = "images/placeholder.svg";
      image.alt = `Imagen pendiente: ${item.personaje}, ${item.atuendo}`;
    });
    media.append(image);
    if (occupied) {
      const overlay = document.createElement("div");
      overlay.className = "card__occupied";
      overlay.textContent = "OCUPADO";
      overlay.setAttribute("aria-hidden", "true");
      media.append(overlay);
    }

    const body = document.createElement("div");
    body.className = "card__body";
    const title = document.createElement("h3"); title.textContent = item.personaje;
    const outfit = document.createElement("p"); outfit.className = "card__outfit"; outfit.textContent = item.atuendo;
    const origin = document.createElement("p"); origin.className = "card__origin"; origin.textContent = item.origen;
    const footer = document.createElement("div"); footer.className = "card__footer";
    const status = document.createElement("span"); status.className = "status"; status.textContent = occupied ? "Ocupado" : "Disponible";
    footer.append(status);
    body.append(title, outfit, origin, footer);

    const button = document.createElement("button");
    button.type = "button";
    button.className = occupied ? "button button--ghost" : "button";
    button.textContent = occupied ? "Liberar con código" : "Seleccionar";
    button.addEventListener("click", () => occupied ? openRelease(item.id) : openReserve(item.id));
    body.append(button);
    card.append(media, body);
    return card;
  }

  function openReserve(id) {
    const item = state.outfits.find(candidate => candidate.id === id);
    if (!item || state.reservations.has(id)) return;
    state.selectedId = id;
    els.reserveSummary.textContent = `${item.personaje} — ${item.atuendo} (${item.origen})`;
    els.aliasInput.value = "";
    els.reserveError.textContent = "";
    els.reserveDialog.showModal();
    requestAnimationFrame(() => els.aliasInput.focus());
  }

  async function submitReservation(event) {
    event.preventDefault();
    const alias = els.aliasInput.value.trim();
    if (!alias) { els.reserveError.textContent = "Indica un nombre o alias."; return; }
    els.reserveError.textContent = "";
    const button = els.reserveForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const reservation = await state.adapter.reserve(state.selectedId, alias);
      state.reservations.set(reservation.outfit_id, reservation);
      els.reserveDialog.close();
      els.releaseCodeOutput.textContent = reservation.release_code;
      els.successDialog.showModal();
      render();
    } catch (error) {
      els.reserveError.textContent = error.message;
      await refreshReservations();
    } finally {
      button.disabled = false;
    }
  }

  function openRelease(id) {
    state.selectedId = id;
    els.releaseCodeInput.value = "";
    els.releaseError.textContent = "";
    els.releaseDialog.showModal();
    requestAnimationFrame(() => els.releaseCodeInput.focus());
  }

  async function submitRelease(event) {
    event.preventDefault();
    const code = els.releaseCodeInput.value.trim();
    if (!code) { els.releaseError.textContent = "Introduce el código."; return; }
    const button = els.releaseForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await state.adapter.release(state.selectedId, code);
      state.reservations.delete(state.selectedId);
      els.releaseDialog.close();
      render();
      showToast("Atuendo liberado correctamente.");
    } catch (error) {
      els.releaseError.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function copyReleaseCode() {
    try {
      await navigator.clipboard.writeText(els.releaseCodeOutput.textContent);
      showToast("Código copiado.");
    } catch (_) {
      showToast("Selecciona y copia el código manualmente.");
    }
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2600);
  }
})();
