const menuToggle = document.querySelector(".navbar__toggle");
const menu = document.querySelector(".navbar__menu");

if (menuToggle && menu) {
  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menú");
    menu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Abrir menú" : "Cerrar menú");
    menu.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
  });

  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
}

const fileInput = document.querySelector("#inputArchivo");
const dropZone = document.querySelector("#dropZone");
const selectedFile = document.querySelector("#selectedFile");
const fileName = document.querySelector("#fileName");
const fileSize = document.querySelector("#fileSize");
const removeFile = document.querySelector("#removeFile");
const generateButton = document.querySelector("#btnGenerar");
const formMessage = document.querySelector("#formMessage");
const results = document.querySelector("#resultado");

if (fileInput && dropZone && generateButton) {
  const maxFileSize = 10 * 1024 * 1024;

  const showMessage = (message) => {
    formMessage.textContent = message;
    formMessage.classList.remove("oculto");
  };

  const clearMessage = () => {
    formMessage.textContent = "";
    formMessage.classList.add("oculto");
  };

  const updateFile = (file) => {
    clearMessage();
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      fileInput.value = "";
      showMessage("Selecciona un documento en formato PDF.");
      return;
    }
    if (file.size > maxFileSize) {
      fileInput.value = "";
      showMessage("El documento no puede superar los 10 MB.");
      return;
    }

    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    dropZone.classList.add("oculto");
    selectedFile.classList.remove("oculto");
    generateButton.disabled = false;
  };

  fileInput.addEventListener("change", () => updateFile(fileInput.files[0]));

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    updateFile(file);
  });

  removeFile.addEventListener("click", () => {
    fileInput.value = "";
    selectedFile.classList.add("oculto");
    dropZone.classList.remove("oculto");
    generateButton.disabled = true;
    clearMessage();
  });

  generateButton.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const data = new FormData();
    data.append("archive", file);
    generateButton.disabled = true;
    generateButton.classList.add("is-loading");
    generateButton.querySelector("span").textContent = "Analizando documento";
    clearMessage();

    try {
      const response = await fetch("/api/process", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo procesar el documento.");

      document.querySelector("#textoResumen").textContent = payload.summary;
      const questionsList = document.querySelector("#listaPreguntas");
      questionsList.replaceChildren();

      payload.questions.forEach((item, index) => {
        const card = document.createElement("article");
        card.className = "question-card";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", "false");
        const question = document.createElement("span");
        question.textContent = `${String(index + 1).padStart(2, "0")}. ${item.question}`;
        const plus = document.createElement("span");
        plus.textContent = "+";
        plus.setAttribute("aria-hidden", "true");
        const answer = document.createElement("p");
        answer.className = "question-card__answer";
        answer.textContent = item.answer;
        toggle.append(question, plus);
        card.append(toggle, answer);
        toggle.addEventListener("click", () => {
          const isOpen = card.classList.toggle("is-open");
          toggle.setAttribute("aria-expanded", String(isOpen));
        });
        questionsList.append(card);
      });

      results.classList.remove("oculto");
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showMessage(error.message || "Ha ocurrido un error. Inténtalo de nuevo.");
    } finally {
      generateButton.disabled = false;
      generateButton.classList.remove("is-loading");
      generateButton.querySelector("span").textContent = "Crear mi sesión de estudio";
    }
  });
}

const historyList = document.querySelector("#historyList");

if (historyList) {
  const loading = document.querySelector("#historyLoading");
  const empty = document.querySelector("#historyEmpty");
  const errorState = document.querySelector("#historyError");
  const count = document.querySelector("#historyCount");
  const search = document.querySelector("#historySearch");
  const retry = document.querySelector("#retryHistory");
  const emptyTitle = document.querySelector("#emptyTitle");
  const emptyText = document.querySelector("#emptyText");
  let sessions = [];

  const escapeText = (value) => String(value ?? "");

  const getDateGroup = (date) => {
    const now = new Date();
    const sessionDate = new Date(date);
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startSession = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    const days = Math.round((startToday - startSession) / 86400000);
    if (days === 0) return "Hoy";
    if (days === 1) return "Ayer";
    if (days < 7) return "Esta semana";
    if (sessionDate.getFullYear() === now.getFullYear() && sessionDate.getMonth() === now.getMonth()) return "Este mes";
    return sessionDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  };

  const formatDate = (date) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "Fecha no disponible";
    return parsed.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  };

  const renderHistory = (items, isSearch = false) => {
    historyList.replaceChildren();
    count.textContent = `${items.length} ${items.length === 1 ? "sesión guardada" : "sesiones guardadas"}`;

    if (!items.length) {
      historyList.classList.add("oculto");
      empty.classList.remove("oculto");
      emptyTitle.textContent = isSearch ? "No encontramos ese documento" : "Tu biblioteca está esperando";
      emptyText.textContent = isSearch
        ? "Prueba con otro nombre o limpia la búsqueda para ver todas tus sesiones."
        : "Cuando proceses tu primer documento, aparecerá aquí para que puedas encontrarlo fácilmente.";
      return;
    }

    empty.classList.add("oculto");
    historyList.classList.remove("oculto");
    const groups = new Map();
    items.forEach((session) => {
      const group = getDateGroup(session.created_at);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(session);
    });

    groups.forEach((groupItems, groupName) => {
      const section = document.createElement("section");
      section.className = "history-group";
      const heading = document.createElement("h3");
      heading.className = "history-group__heading";
      heading.textContent = groupName;
      section.append(heading);

      groupItems.forEach((session) => {
        const item = document.createElement("article");
        item.className = "history-item";
        const icon = document.createElement("span");
        icon.className = "history-item__icon";
        icon.textContent = "PDF";
        const body = document.createElement("div");
        body.className = "history-item__body";
        const title = document.createElement("h3");
        title.textContent = escapeText(session.title) || "Documento sin nombre";
        const description = document.createElement("p");
        description.textContent = `Sesión de estudio · #${session.id}`;
        const date = document.createElement("time");
        date.className = "history-item__date";
        date.dateTime = session.created_at;
        date.textContent = formatDate(session.created_at);
        body.append(title, description);
        item.append(icon, body, date);
        section.append(item);
      });
      historyList.append(section);
    });
  };

  const loadHistory = async () => {
    loading.classList.remove("oculto");
    historyList.classList.add("oculto");
    empty.classList.add("oculto");
    errorState.classList.add("oculto");
    search.disabled = true;

    try {
      const response = await fetch("/api/history");
      if (!response.ok) throw new Error("No se pudo cargar el historial");
      sessions = await response.json();
      renderHistory(sessions);
    } catch {
      count.textContent = "Historial no disponible";
      errorState.classList.remove("oculto");
    } finally {
      loading.classList.add("oculto");
      search.disabled = false;
    }
  };

  search.addEventListener("input", () => {
    const term = search.value.trim().toLocaleLowerCase("es");
    const filtered = sessions.filter((session) => escapeText(session.title).toLocaleLowerCase("es").includes(term));
    renderHistory(filtered, Boolean(term));
  });
  retry.addEventListener("click", loadHistory);
  loadHistory();
}
