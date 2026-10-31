const API = "";
const root = document.getElementById("screen-root");
const toastElement = document.getElementById("toast");
const state = {
  screen: "cadastro",
  patients: [],
  attendances: [],
  queue: [],
  selectedSymptoms: new Set(),
  filters: {},
};

const symptomsCatalog = [
  { name: "Dor no peito", level: "red" },
  { name: "Falta de ar", level: "red" },
  { name: "Falta de ar intensa", level: "red" },
  { name: "Desmaio", level: "red" },
  { name: "Sangramento", level: "yellow" },
  { name: "Sangramento intenso", level: "red" },
  { name: "Dor forte", level: "yellow" },
  { name: "Dor de cabeça forte", level: "yellow" },
  { name: "Dor de cabeça", level: "green" },
  { name: "Dor de garganta", level: "green" },
  { name: "Dor abdominal", level: "yellow" },
  { name: "Dor abdominal intensa", level: "yellow" },
  { name: "Tosse", level: "green" },
  { name: "Vômito", level: "yellow" },
  { name: "Vômitos persistentes", level: "yellow" },
  { name: "Tontura", level: "green" },
  { name: "Coriza", level: "green" },
  { name: "Tontura forte", level: "yellow" },
  { name: "Náusea", level: "yellow" },
  { name: "Febre", level: "yellow" },
  { name: "Convulsão", level: "red" },
  { name: "Confusão mental", level: "red" },
  { name: "Fraqueza", level: "green" },
  { name: "Alergia", level: "yellow" },
];

function notify(message, type = "success") {
  toastElement.textContent = message;
  toastElement.className = `toast show ${type === "error" ? "error" : ""}`;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => (toastElement.className = "toast"), 3600);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object"
        ? data.erro || data.error || data.mensagem
        : data;
    throw new Error(message || `Erro HTTP ${response.status}`);
  }
  return data;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.dados)) return value.dados;
  if (Array.isArray(value?.atendimentos)) return value.atendimentos;
  if (Array.isArray(value?.pacientes)) return value.pacientes;
  return [];
}

function normalizeAttendance(item) {
  const patient = item.paciente || {};
  return {
    ...item,
    id: item.id ?? item.atendimento_id,
    atendimento_id: item.atendimento_id ?? item.id,
    paciente_id: item.paciente_id ?? patient.id,
    paciente_nome:
      item.paciente_nome ??
      item.nome_paciente ??
      patient.nome ??
      item.nome ??
      "Paciente sem nome",
    idade: item.idade ?? item.paciente_idade ?? patient.idade ?? "—",
    genero: item.genero ?? patient.genero ?? "",
    documento: item.documento ?? patient.documento ?? "",
    telefone: item.telefone ?? patient.telefone ?? "",
    profissional: item.profissional ?? "",
    sintomas: item.sintomas ?? item.descricao ?? "",
    prioridade: item.prioridade_confirmada ?? item.prioridade ?? "Pendente",
    prioridade_sugerida: item.prioridade_sugerida ?? "",
    status: item.status ?? "Aguardando",
    data_registro:
      item.data_registro ??
      item.criado_em ??
      item.created_at ??
      item.data ??
      "",
    finalizado_em: item.finalizado_em ?? "",
  };
}

function priorityClass(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
  if (normalized.includes("emerg")) return "emergencia";
  if (normalized.includes("urgent") && !normalized.includes("pouco"))
    return "urgente";
  if (normalized.includes("pouco")) return "pouco-urgente";
  return "pendente";
}
function statusClass(value) {
  return String(value || "")
    .toLowerCase()
    .includes("final")
    ? "finalizado"
    : "";
}
function priorityWeight(value) {
  const cls = priorityClass(value);
  return cls === "emergencia"
    ? 0
    : cls === "urgente"
      ? 1
      : cls === "pouco-urgente"
        ? 2
        : 3;
}
function dateValue(value) {
  if (!value) return null;
  let normalized = value;
  if (
    typeof normalized === "string" &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)
  ) {
    normalized = `${normalized.replace(" ", "T")}Z`;
  }
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
function localDateKey(value) {
  const date = dateValue(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function isToday(value) {
  return localDateKey(value) === localDateKey(new Date());
}
function formatTime(value) {
  const date = dateValue(value);
  return date
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";
}
function formatDateTime(value) {
  const date = dateValue(value);
  return date ? `${date.toLocaleDateString("pt-BR")} ${formatTime(date)}` : "—";
}
function elapsed(value) {
  const date = dateValue(value);
  if (!date) return "—";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}min` : `${minutes} min`;
}
function shortSymptoms(text) {
  const clean = String(text || "")
    .split(/\n|Relato:|Sinais físicos:|Observações:/i)[0]
    .trim();
  return clean.length > 105
    ? `${clean.slice(0, 102)}...`
    : clean || "Sem descrição informada";
}
function codeFor(item, index) {
  return (
    item.codigo ||
    item.codigo_paciente ||
    `P-${String(item.paciente_id || item.id || index + 1).padStart(3, "0")}`
  );
}

async function loadData() {
  const [patientsResult, attendanceResult] = await Promise.allSettled([
    api("/api/pacientes"),
    api("/api/atendimentos"),
  ]);
  state.patients =
    patientsResult.status === "fulfilled" ? asArray(patientsResult.value) : [];
  state.attendances =
    attendanceResult.status === "fulfilled"
      ? asArray(attendanceResult.value).map(normalizeAttendance)
      : [];
  try {
    const queueResult = await api("/api/fila");
    state.queue = asArray(queueResult).map(normalizeAttendance);
  } catch {
    state.queue = state.attendances.filter(
      (item) => !String(item.status).toLowerCase().includes("final"),
    );
  }
  if (state.queue.length === 0 && state.attendances.length) {
    state.queue = state.attendances.filter(
      (item) => !String(item.status).toLowerCase().includes("final"),
    );
  }
  state.queue.sort(
    (a, b) =>
      priorityWeight(a.prioridade) - priorityWeight(b.prioridade) ||
      (dateValue(a.data_registro)?.getTime() || 0) -
        (dateValue(b.data_registro)?.getTime() || 0),
  );
}

function setScreen(screen) {
  state.screen = screen;
  document
    .querySelectorAll(".nav-button")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.screen === screen),
    );
  renderScreen();
}

async function refreshAndRender() {
  try {
    await loadData();
  } catch (error) {
    notify(error.message, "error");
  }
  renderScreen();
}

function renderScreen() {
  if (state.screen === "cadastro") renderRegistration();
  if (state.screen === "fila") renderQueue();
  if (state.screen === "historico") renderHistory();
  if (state.screen === "relatorios") renderReports();
}

function renderRegistration() {
  root.innerHTML = `
    <section class="registration-page">
      <form id="registration-form">
        <div class="form-section">
          <h2><span class="section-icon">♟</span> Dados de Admissão Básica</h2>
          <div class="form-grid">
            <div class="field"><label for="nome">Nome completo do paciente</label><input id="nome" name="nome" placeholder="Ex: João da Silva Santos" minlength="3" required></div>
            <div class="field"><label for="idade">Idade</label><input id="idade" name="idade" type="number" min="1" max="120" placeholder="Ex: 34" required></div>
            <div class="field"><label for="genero">Gênero</label><select id="genero" name="genero"><option>Masculino</option><option>Feminino</option><option>Outro</option><option>Prefere não informar</option></select></div>
          </div>
          <div class="form-grid two form-grid-spaced">
            <div class="field"><label for="documento">Documento / Identificação (CPF/RG)</label><input id="documento" name="documento" placeholder="000.000.000-00"></div>
            <div class="field"><label for="telefone">Telefone de contato</label><input id="telefone" name="telefone" placeholder="(83) 98888-7777"></div>
          </div>
        </div>

        <div class="form-section">
          <h2><span class="section-icon">♧</span> Sintomas e Quadro de Sintomas</h2>
          <div class="symptom-toolbar">
            <strong>Selecione os sintomas informados (<span id="symptom-count">0</span> ativos)</strong>
            <input class="field symptom-search" id="symptom-search" placeholder="Buscar sintoma..." aria-label="Buscar sintoma">
          </div>
          <div class="symptom-list" id="symptom-list">${symptomsCatalog
            .map(
              (symptom) => `
            <label class="symptom-option" data-symptom="${symptom.name.toLowerCase()}">
              <input type="checkbox" value="${symptom.name}">
              <span>${symptom.name}</span><span class="symptom-dot ${symptom.level}"></span>
            </label>`,
            )
            .join("")}
          </div>
        </div>

        <div class="form-section">
          <div class="field"><label for="relato">Descrição livre do caso (relato e queixa)</label><textarea id="relato" placeholder="Relate em detalhes a queixa do paciente. Ex: Paciente alega forte dor de cabeça com queimação nas costas iniciada há duas horas acompanhada de náusea."></textarea></div>
          <div class="form-grid two form-grid-tight">
            <div class="field"><label for="sinais">Sinais físicos observados</label><textarea id="sinais" placeholder="Ex: Palidez conjuntival, febre ao toque, tremores nas extremidades."></textarea></div>
            <div class="field"><label for="observacoes">Observações adicionais</label><textarea id="observacoes" placeholder="Ex: Histórico familiar, toma medicação para pressão regularmente."></textarea></div>
          </div>
        </div>
        <div class="form-actions"><button class="btn btn-primary" id="save-patient" type="submit">Salvar Informações</button></div>
      </form>
    </section>`;

  const list = document.getElementById("symptom-list");
  list.addEventListener("change", (event) => {
    if (event.target.matches('input[type="checkbox"]')) {
      const label = event.target.closest(".symptom-option");
      if (event.target.checked) state.selectedSymptoms.add(event.target.value);
      else state.selectedSymptoms.delete(event.target.value);
      label.classList.toggle("selected", event.target.checked);
      document.getElementById("symptom-count").textContent =
        state.selectedSymptoms.size;
    }
  });
  document
    .getElementById("symptom-search")
    .addEventListener("input", (event) => {
      const term = event.target.value.toLowerCase().trim();
      list
        .querySelectorAll(".symptom-option")
        .forEach(
          (item) => (item.hidden = !item.dataset.symptom.includes(term)),
        );
    });
  document
    .getElementById("registration-form")
    .addEventListener("submit", submitRegistration);
}

async function submitRegistration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("save-patient");
  const formData = new FormData(form);
  const nome = String(formData.get("nome") || "").trim();
  const idade = Number(formData.get("idade"));
  const genero = String(formData.get("genero") || "");
  const documento = String(formData.get("documento") || "").trim();
  const telefone = String(formData.get("telefone") || "").trim();
  const sintomas = [...state.selectedSymptoms];
  const relato = document.getElementById("relato").value.trim();
  const sinais = document.getElementById("sinais").value.trim();
  const observacoes = document.getElementById("observacoes").value.trim();

  if (nome.length < 3 || !Number.isInteger(idade) || idade <= 0 || idade > 120) {
    return notify("Confira o nome e a idade do paciente.", "error");
  }
  if (!sintomas.length && relato.length < 3) {
    return notify("Selecione ao menos um sintoma ou descreva a queixa.", "error");
  }

  button.disabled = true;
  button.textContent = "Salvando informações...";

  try {
    const patient = await api("/api/pacientes", {
      method: "POST",
      body: JSON.stringify({ nome, idade, genero, documento, telefone }),
    });

    const patientId = patient?.id ?? patient?.paciente?.id;
    if (!patientId) {
      throw new Error("A API não retornou o ID do paciente cadastrado.");
    }

    const details = [
      sintomas.length ? `Sintomas: ${sintomas.join(", ")}` : "",
      relato ? `Relato: ${relato}` : "",
      sinais ? `Sinais físicos: ${sinais}` : "",
      observacoes ? `Observações: ${observacoes}` : "",
    ].filter(Boolean).join("\n");

    const attendance = await api("/api/atendimentos", {
      method: "POST",
      body: JSON.stringify({
        paciente_id: Number(patientId),
        sintomas: details,
      }),
    });

    const attendanceId = attendance?.id ?? attendance?.atendimento?.id;
    if (!attendanceId) {
      throw new Error("O paciente foi cadastrado, mas a API não retornou o ID do atendimento.");
    }

    const patientSummary = {
      id: patientId,
      nome,
      idade,
      genero,
      documento,
      telefone,
    };
    const caseSummary = {
      sintomas,
      relato,
      sinais,
      observacoes,
      detalhes: details,
    };

    state.selectedSymptoms.clear();
    form.reset();
    document.getElementById("symptom-count").textContent = "0";
    document.querySelectorAll(".symptom-option").forEach((item) => item.classList.remove("selected"));

    // O modal aparece imediatamente; a análise da IA é carregada dentro dele.
    openAssessmentModal({
      attendanceId,
      patient: patientSummary,
      caseSummary,
      aiStatus: "loading",
    });

    try {
      const ai = await api(`/api/atendimentos/${attendanceId}/sugerir-prioridade`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setAssessmentAIResult(ai);
    } catch (error) {
      setAssessmentAIError(error.message || "Não foi possível consultar a IA.");
    }
  } catch (error) {
    notify(error.message || "Não foi possível salvar o cadastro.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Salvar Informações";
  }
}

function openAssessmentModal(data) {
  state.pendingAssessment = data;
  document.getElementById("assessment-modal")?.remove();

  const patient = data.patient;
  const symptoms = data.caseSummary.sintomas.length
    ? data.caseSummary.sintomas.join(", ")
    : "Não selecionados; consulte o relato livre.";

  document.body.insertAdjacentHTML("beforeend", `
    <div class="assessment-overlay" id="assessment-modal" role="presentation">
      <section class="assessment-modal" role="dialog" aria-modal="true" aria-labelledby="assessment-title">
        <header class="assessment-header">
          <div>
            <span class="assessment-kicker">SISTEMA DE TRIAGEM INTELIGENTE</span>
            <h2 id="assessment-title">Análise preliminar da IA</h2>
            <p>Resumo do atendimento e sugestão automatizada para revisão profissional.</p>
          </div>
          <button class="assessment-close" id="close-assessment" type="button" aria-label="Fechar janela">×</button>
        </header>

        <div class="assessment-body">
          <div class="assessment-patient-card">
            <div class="assessment-patient-main">
              <span class="assessment-label">PACIENTE CADASTRADO</span>
              <strong>${escapeHtml(patient.nome)}</strong>
              <span>${escapeHtml(String(patient.idade))} anos · ${escapeHtml(patient.genero || "Gênero não informado")}</span>
            </div>
            <div class="assessment-patient-meta">
              <span><small>DOCUMENTO</small>${escapeHtml(patient.documento || "Não informado")}</span>
              <span><small>CONTATO</small>${escapeHtml(patient.telefone || "Não informado")}</span>
              <span><small>ATENDIMENTO</small>#${escapeHtml(String(data.attendanceId))}</span>
            </div>
          </div>

          <div class="assessment-priority-card" id="assessment-priority-card">
            <div class="assessment-priority-copy">
              <span class="assessment-label">PRIORIDADE SUGERIDA PELA IA</span>
              <strong id="assessment-priority-value">Analisando informações...</strong>
              <span id="assessment-priority-note">Aguarde enquanto a IA avalia os dados informados.</span>
            </div>
            <div class="assessment-ai-indicator" id="assessment-ai-indicator"><span class="assessment-spinner"></span> PROCESSANDO</div>
          </div>

          <div class="assessment-content-grid">
            <article class="assessment-info-card assessment-wide">
              <h3><span>✦</span> Resumo da análise</h3>
              <p id="assessment-summary" class="assessment-loading-copy">A IA está analisando o relato e os sintomas informados...</p>
              <div class="assessment-reason" id="assessment-justification"></div>
            </article>
            <article class="assessment-info-card">
              <h3><span>!</span> Pontos de atenção relatados</h3>
              <ul id="assessment-attention-list"><li>Aguardando análise...</li></ul>
            </article>
            <article class="assessment-info-card">
              <h3><span>⌕</span> Informações que podem complementar</h3>
              <ul id="assessment-missing-list"><li>Aguardando análise...</li></ul>
            </article>
            <article class="assessment-info-card assessment-wide">
              <h3><span>➜</span> Orientação operacional</h3>
              <p id="assessment-guidance">Aguardar o resultado da análise preliminar.</p>
            </article>
          </div>

          <div class="assessment-case-details">
            <h3>Dados informados no cadastro</h3>
            <div><strong>Sintomas selecionados:</strong> ${escapeHtml(symptoms)}</div>
            ${data.caseSummary.relato ? `<div><strong>Relato:</strong> ${escapeHtml(data.caseSummary.relato)}</div>` : ""}
            ${data.caseSummary.sinais ? `<div><strong>Sinais físicos observados:</strong> ${escapeHtml(data.caseSummary.sinais)}</div>` : ""}
            ${data.caseSummary.observacoes ? `<div><strong>Observações adicionais:</strong> ${escapeHtml(data.caseSummary.observacoes)}</div>` : ""}
          </div>

          <div class="assessment-confirm-area">
            <div class="assessment-confirm-heading">
              <div><span class="assessment-label">VALIDAÇÃO PROFISSIONAL</span><h3>Confirme a prioridade do atendimento</h3></div>
              <span class="assessment-human-tag">Decisão humana obrigatória</span>
            </div>
            <div class="assessment-confirm-controls">
              <label for="assessment-priority-select">Prioridade final</label>
              <select id="assessment-priority-select">
                <option value="">Selecione a prioridade</option>
                <option value="Emergência">Emergência</option>
                <option value="Urgente">Urgente</option>
                <option value="Pouco Urgente">Pouco Urgente</option>
              </select>
              <button class="btn btn-primary" id="confirm-assessment" type="button">Confirmar prioridade e enviar à fila</button>
            </div>
            <div class="assessment-disclaimer">Esta é uma sugestão automatizada para fins acadêmicos. Não constitui diagnóstico médico, não substitui protocolos oficiais nem avaliação de profissional habilitado. Em situações reais, siga o protocolo da unidade e priorize a avaliação humana.</div>
          </div>
        </div>

        <footer class="assessment-footer">
          <button class="btn btn-outline" id="leave-pending-assessment" type="button">Deixar como pendente</button>
          <span>O registro já foi salvo no banco de dados.</span>
        </footer>
      </section>
    </div>
  `);

  document.getElementById("close-assessment").addEventListener("click", leaveAssessmentPending);
  document.getElementById("leave-pending-assessment").addEventListener("click", leaveAssessmentPending);
  document.getElementById("confirm-assessment").addEventListener("click", confirmAssessmentPriority);
  document.getElementById("assessment-modal").addEventListener("click", (event) => {
    if (event.target.id === "assessment-modal") leaveAssessmentPending();
  });
  document.addEventListener("keydown", handleAssessmentEscape);
}

function handleAssessmentEscape(event) {
  if (event.key === "Escape" && document.getElementById("assessment-modal")) {
    leaveAssessmentPending();
  }
}

function setAssessmentAIResult(ai) {
  const modal = document.getElementById("assessment-modal");
  if (!modal) return;

  state.pendingAssessment.ai = ai;
  const suggested = ["Emergência", "Urgente", "Pouco Urgente"].includes(ai.prioridade_sugerida)
    ? ai.prioridade_sugerida
    : "Indefinida";
  const priorityCard = document.getElementById("assessment-priority-card");
  priorityCard.classList.remove("emergencia", "urgente", "pouco-urgente", "indefinida");
  priorityCard.classList.add(suggested === "Indefinida" ? "indefinida" : priorityClass(suggested));

  document.getElementById("assessment-priority-value").textContent = suggested;
  document.getElementById("assessment-priority-note").textContent =
    suggested === "Indefinida"
      ? "Os dados não foram suficientes para uma sugestão. Defina manualmente após avaliação."
      : "Sugestão preliminar gerada com base somente nas informações registradas.";
  document.getElementById("assessment-ai-indicator").innerHTML = '<span class="assessment-status-dot"></span> ANÁLISE RECEBIDA';
  document.getElementById("assessment-summary").textContent = ai.resumo || "Análise concluída com os dados informados.";
  document.getElementById("assessment-justification").textContent = ai.justificativa || "Não foi fornecida justificativa adicional.";
  document.getElementById("assessment-guidance").textContent = ai.orientacao_operacional || "Encaminhar para avaliação do profissional responsável conforme protocolo institucional.";
  document.getElementById("assessment-attention-list").innerHTML = assessmentList(ai.pontos_atencao, "Nenhum ponto de atenção específico foi destacado pela IA.");
  document.getElementById("assessment-missing-list").innerHTML = assessmentList(ai.informacoes_ausentes, "Nenhuma informação adicional foi indicada.");

  const select = document.getElementById("assessment-priority-select");
  if (suggested !== "Indefinida") select.value = suggested;
}

function setAssessmentAIError(message) {
  const modal = document.getElementById("assessment-modal");
  if (!modal) return;
  document.getElementById("assessment-priority-card").classList.add("indefinida");
  document.getElementById("assessment-priority-value").textContent = "Análise indisponível";
  document.getElementById("assessment-priority-note").textContent = "O cadastro foi salvo. É possível definir a prioridade manualmente.";
  document.getElementById("assessment-ai-indicator").innerHTML = '<span class="assessment-status-dot error"></span> SEM RESPOSTA';
  document.getElementById("assessment-summary").textContent = "Não foi possível obter a análise da IA neste momento.";
  document.getElementById("assessment-justification").textContent = message;
  document.getElementById("assessment-guidance").textContent = "Solicite avaliação do profissional responsável e defina a prioridade conforme o protocolo institucional.";
  document.getElementById("assessment-attention-list").innerHTML = "<li>A análise automatizada não está disponível.</li>";
  document.getElementById("assessment-missing-list").innerHTML = "<li>Revise os dados e complete as informações clínicas conforme necessário.</li>";
}

function assessmentList(items, emptyMessage) {
  const validItems = Array.isArray(items) ? items.filter((item) => typeof item === "string" && item.trim()) : [];
  return validItems.length
    ? validItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : `<li>${escapeHtml(emptyMessage)}</li>`;
}

async function confirmAssessmentPriority() {
  const pending = state.pendingAssessment;
  const priority = document.getElementById("assessment-priority-select")?.value;
  const button = document.getElementById("confirm-assessment");
  if (!pending) return;
  if (!priority) return notify("Selecione a prioridade final após revisar a sugestão.", "error");

  button.disabled = true;
  button.textContent = "Confirmando...";
  try {
    await api(`/api/atendimentos/${pending.attendanceId}/prioridade`, {
      method: "PATCH",
      body: JSON.stringify({ prioridade: priority }),
    });
    closeAssessmentModal();
    await loadData();
    setScreen("fila");
    notify(`Prioridade ${priority} confirmada. Paciente incluído na fila.`);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Confirmar prioridade e enviar à fila";
    notify(error.message || "Não foi possível confirmar a prioridade.", "error");
  }
}

async function leaveAssessmentPending() {
  if (!state.pendingAssessment) return closeAssessmentModal();
  closeAssessmentModal();
  await loadData().catch(() => {});
  setScreen("fila");
  notify("Atendimento salvo como pendente. A prioridade poderá ser definida na fila.");
}

function closeAssessmentModal() {
  document.getElementById("assessment-modal")?.remove();
  document.removeEventListener("keydown", handleAssessmentEscape);
  state.pendingAssessment = null;
}

function renderQueue() {
  const active = state.queue.filter(
    (item) => !String(item.status).toLowerCase().includes("final"),
  );
  const completedToday = state.attendances.filter(
    (item) =>
      isToday(item.data_registro) &&
      String(item.status).toLowerCase().includes("final"),
  ).length;
  root.innerHTML = `
    <section class="page">
      <div class="page-title-card queue-title">
        <div><h1>Fila Eletrônica de Prioridades</h1><p>Gerencie e chame pacientes organizados rigorosamente pela severidade clínica das queixas.</p></div>
        <button class="btn btn-pink" id="call-next">♧ &nbsp;Chamar Próximo Paciente</button>
      </div>
      <div class="metrics-row">
        <div class="metric-card"><span class="eyebrow">Ocupação da fila</span><div class="metric-value">${active.length} ativos</div><div class="metric-sub">Aguardando atendimento médico.</div></div>
        <div class="metric-card"><span class="eyebrow">Atendidos hoje</span><div class="metric-value green">${completedToday} pacientes</div><div class="metric-sub">Sessões concluídas com sucesso.</div></div>
        <div class="metric-card metric-alert"><span class="eyebrow">Painel dinâmico de alertas clínicos</span><div class="alert-copy">✓ Fila operando sob limites seguros.<br>Nenhum alerta crítico ativo.</div></div>
      </div>
      <div class="panel-card">
        <div class="section-heading"><h2>ORDEM DE FILA UNIFICADA (${active.length} AGUARDANDO/ATENDIMENTO)</h2><span class="eyebrow">Gerado em tempo real</span></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Posição</th><th>Cód.</th><th>Paciente / Idade</th><th>Prioridade</th><th>Sintomas / Informação</th><th>Chegada</th><th>Espera</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>${active.length ? active.map((item, index) => queueRow(item, index)).join("") : '<tr><td colspan="9" class="empty-row">Nenhum paciente aguardando atendimento.</td></tr>'}</tbody></table></div>
      </div>
    </section>`;
  document
    .getElementById("call-next")
    .addEventListener("click", callNextPatient);
  root
    .querySelectorAll("[data-finish]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        changeStatus(button.dataset.finish, "Finalizado"),
      ),
    );
  root
    .querySelectorAll("[data-start]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        changeStatus(button.dataset.start, "Em atendimento"),
      ),
    );
  root
    .querySelectorAll("[data-confirm-priority]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        changePriority(
          button.dataset.confirmPriority,
          root.querySelector(`[data-priority-select="${button.dataset.confirmPriority}"]`)?.value,
        ),
      ),
    );
}

function queueRow(item, index) {
  const priority = item.prioridade || "Pendente";
  const suggestion = item.prioridade_sugerida || "";
  const status = item.status || "Aguardando";
  const isWaiting = String(status).toLowerCase().includes("aguard");
  const action = isWaiting
    ? `<button class="btn btn-small btn-dark" data-start="${item.id}">Iniciar</button>`
    : `<button class="btn btn-small btn-green" data-finish="${item.id}">Finalizar</button>`;
  const priorityOptions = ["Emergência", "Urgente", "Pouco Urgente", "Pendente"];
  return `<tr>
    <td>${index + 1}</td>
    <td class="code-text">${escapeHtml(codeFor(item, index))}</td>
    <td><div class="patient-name">${escapeHtml(item.paciente_nome)}</div><div class="patient-meta">${escapeHtml(String(item.idade))} anos</div></td>
    <td>
      <span class="priority ${priorityClass(priority)}">${escapeHtml(priority)}</span>
      ${suggestion ? `<div class="ai-suggestion">IA sugeriu: ${escapeHtml(suggestion)}</div>` : ""}
      <details class="priority-editor">
        <summary>Confirmar / alterar</summary>
        <select data-priority-select="${item.id}" aria-label="Prioridade confirmada">
          ${priorityOptions.map((option) => `<option value="${option}" ${option === priority ? "selected" : ""}>${option}</option>`).join("")}
        </select>
        <button class="btn btn-small btn-outline" data-confirm-priority="${item.id}">Salvar</button>
      </details>
    </td>
    <td><div class="symptom-title">${escapeHtml(shortSymptoms(item.sintomas))}</div><div class="symptom-description">${escapeHtml(String(item.sintomas || "").slice(0, 180))}</div></td>
    <td>${formatTime(item.data_registro)}</td>
    <td>${elapsed(item.data_registro)}</td>
    <td><span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span></td>
    <td class="action-cell">${action}</td>
  </tr>`;
}

async function changeStatus(id, status) {
  try {
    await api(`/api/atendimentos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    notify(`Status atualizado para: ${status}.`);
    await loadData();
    renderQueue();
  } catch (error) {
    notify(error.message, "error");
  }
}

async function changePriority(id, prioridade) {
  if (!prioridade) return notify("Selecione uma prioridade.", "error");
  try {
    await api(`/api/atendimentos/${id}/prioridade`, {
      method: "PATCH",
      body: JSON.stringify({ prioridade }),
    });
    notify(`Prioridade confirmada: ${prioridade}.`);
    await loadData();
    renderQueue();
  } catch (error) {
    notify(error.message, "error");
  }
}

async function callNextPatient() {
  const next = state.queue.find((item) =>
    String(item.status).toLowerCase().includes("aguard"),
  );
  if (!next) return notify("Não há pacientes aguardando.", "error");

  const callWindow = window.open("about:blank", "painelChamada", "width=1200,height=800");
  try {
    await api(`/api/atendimentos/${next.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Em atendimento" }),
    });
    const called = {
      ...next,
      status: "Em atendimento",
      chamado_em: new Date().toISOString(),
    };
    localStorage.setItem("triagem_ultimo_chamado", JSON.stringify(called));
    notify(`Paciente chamado: ${next.paciente_nome}.`);
    await loadData();
    renderQueue();

    const url = `/chamada.html?atendimento=${encodeURIComponent(next.id)}`;
    if (callWindow) callWindow.location.href = url;
    else window.location.href = url;
  } catch (error) {
    if (callWindow) callWindow.close();
    notify(error.message, "error");
  }
}

function renderHistory() {
  const filtered = filterAttendances(state.attendances);
  root.innerHTML = `
    <section class="page narrow">
      <div class="page-title-card"><div><h1>▱ &nbsp;Prontuário e Histórico de Atendimentos</h1><p>Filtre, pesquise e audite todos os prontuários registrados no sistema, com cópias de auditoria integradas.</p></div></div>
      <div class="panel-card filters-card">
        <h2 class="filters-title">☷ &nbsp;FILTROS AVANÇADOS DE PRONTUÁRIOS</h2>
        <div class="filters-grid">
          <div class="filter-field"><label>Busca por nome / documento</label><input id="filter-name" placeholder="Nome ou documento..."></div>
          <div class="filter-field"><label>Grau de prioridade</label><select id="filter-priority"><option value="">Todas no sistema</option><option>Emergência</option><option>Urgente</option><option>Pouco Urgente</option><option>Pendente</option></select></div>
          <div class="filter-field"><label>Status do paciente</label><select id="filter-status"><option value="">Todos os status</option><option>Aguardando</option><option>Em atendimento</option><option>Finalizado</option></select></div>
          <div class="filter-field"><label>Data de chegada</label><input id="filter-date" type="date"></div>
          <div class="filter-field"><label>Profissional / responsável</label><input id="filter-professional" placeholder="Nome do enfermeiro/recep."></div>
          <div class="filter-field"><label>Filtrar por sintoma</label><input id="filter-symptom" placeholder="Ex: febre, dor no peito..."></div>
        </div>
        <div class="filter-footer"><strong id="history-count">Encontrados: ${filtered.length} prontuários (Total: ${state.attendances.length})</strong><button class="btn btn-small btn-outline" id="clear-filters">♧ Limpar Filtros</button></div>
      </div>
      <div class="panel-card history-table-card"><div class="table-wrap"><table class="data-table history-table"><thead><tr><th>Código</th><th>Paciente</th><th>Idade</th><th>Sintomas / Descrição</th><th>Chegada<br>(Data/Hora)</th><th>Prioridade</th><th>Tempo de espera</th><th>Status final</th></tr></thead><tbody id="history-body">${historyRows(filtered)}</tbody></table></div></div>
    </section>`;
  [
    "filter-name",
    "filter-priority",
    "filter-status",
    "filter-date",
    "filter-professional",
    "filter-symptom",
  ].forEach((id) =>
    document.getElementById(id).addEventListener("input", updateHistoryTable),
  );
  document.getElementById("clear-filters").addEventListener("click", () => {
    [
      "filter-name",
      "filter-priority",
      "filter-status",
      "filter-date",
      "filter-professional",
      "filter-symptom",
    ].forEach((id) => (document.getElementById(id).value = ""));
    updateHistoryTable();
  });
}

function filterAttendances(items) {
  const value = (id) =>
    document.getElementById(id)?.value?.toLowerCase().trim() || "";
  const name = value("filter-name"),
    priority = value("filter-priority"),
    status = value("filter-status"),
    date = value("filter-date"),
    professional = value("filter-professional"),
    symptom = value("filter-symptom");
  return items.filter((item) => {
    const haystack =
      `${item.paciente_nome} ${item.documento || ""} ${item.sintomas}`.toLowerCase();
    const dateText =
      localDateKey(item.data_registro);
    return (
      (!name || haystack.includes(name)) &&
      (!priority || String(item.prioridade || "").toLowerCase() === priority) &&
      (!status || String(item.status || "").toLowerCase() === status.toLowerCase()) &&
      (!date || dateText === date) &&
      (!professional ||
        String(item.profissional || "")
          .toLowerCase()
          .includes(professional)) &&
      (!symptom || String(item.sintomas || "").toLowerCase().includes(symptom))
    );
  });
}
function updateHistoryTable() {
  const filtered = filterAttendances(state.attendances);
  document.getElementById("history-body").innerHTML = historyRows(filtered);
  document.getElementById("history-count").textContent =
    `Encontrados: ${filtered.length} prontuários (Total: ${state.attendances.length})`;
}
function historyRows(items) {
  if (!items.length)
    return '<tr><td colspan="8" class="empty-row">Nenhum prontuário encontrado.</td></tr>';
  return items
    .map(
      (item, index) => `<tr>
    <td class="code-text">${escapeHtml(codeFor(item, index))}</td>
    <td><div class="patient-name">${escapeHtml(item.paciente_nome)}</div><div class="patient-meta">${item.documento ? `DOC: ${escapeHtml(item.documento)}` : `ID: ${escapeHtml(String(item.paciente_id ?? "—"))}`}</div></td>
    <td><strong>${escapeHtml(String(item.idade))}</strong></td>
    <td><div class="history-symptoms">${escapeHtml(String(item.sintomas).slice(0, 150))}</div></td>
    <td>${formatDateTime(item.data_registro)}</td>
    <td><span class="priority ${priorityClass(item.prioridade)}">${escapeHtml(item.prioridade)}</span></td>
    <td><strong>${elapsed(item.data_registro)}</strong></td>
    <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
  </tr>`,
    )
    .join("");
}

function renderReports() {
  const todayAttendances = state.attendances.filter((item) => isToday(item.data_registro));
  const total = todayAttendances.length;
  const finished = todayAttendances.filter((item) =>
    String(item.status).toLowerCase().includes("final"),
  ).length;
  const active = todayAttendances.filter(
    (item) => !String(item.status).toLowerCase().includes("final"),
  );
  const emergencies = todayAttendances.filter(
    (item) => priorityClass(item.prioridade) === "emergencia",
  ).length;
  const urgents = todayAttendances.filter(
    (item) => priorityClass(item.prioridade) === "urgente",
  ).length;
  const avg = averageWait(todayAttendances);
  const symptomCounts = countSymptoms(todayAttendances);
  const maxSymptom = Math.max(1, ...Object.values(symptomCounts));
  const hours = Array.from({ length: 6 }, (_, i) => ({
    label: `${i * 4}h`,
    count: todayAttendances.filter((item) => {
      const d = dateValue(item.data_registro);
      return d && d.getHours() >= i * 4 && d.getHours() < (i + 1) * 4;
    }).length,
  }));
  const maxHour = Math.max(1, ...hours.map((x) => x.count));
  root.innerHTML = `
    <section class="page">
      <div class="page-title-card report-heading"><div><h1>▥ &nbsp;Consolidação de Relatórios e Métricas</h1><p>Dados calculados automaticamente com base nos pacientes cadastrados no sistema.</p></div><div class="heading-actions"><button class="btn btn-small btn-dark" id="refresh-reports">↻ Atualizar</button><button class="btn btn-small btn-export" id="export-csv">⇩ Exportar atendimentos (.CSV)</button></div></div>
      <div class="report-metrics">
        ${reportMetric("Registros hoje", total, `${total} no total`)}
        ${reportMetric("Atendidos hoje", finished, "Sessões finalizadas", "green")}
        ${reportMetric("Emergências", emergencies, "Classificadas", "pink")}
        ${reportMetric("Urgentes", urgents, "Classificadas", "yellow")}
        ${reportMetric("Méd. espera geral", avg, "Registros disponíveis")}
        ${reportMetric("Em aberto", active.length, "Aguardando/atendimento", "purple")}
      </div>
      <div class="report-grid">
        <div class="panel-card report-card"><h3>↗ DISTRIBUIÇÃO DE HORÁRIO DE MAIOR FLUXO</h3><p>Quantidade de admissões registradas em cada hora do dia.</p><div class="bar-chart">${hours.map((hour) => `<div class="bar-column"><span class="bar-number">${hour.count || ""}</span><div class="bar" data-height="${Math.max(3, (hour.count / maxHour) * 100)}"></div><span class="bar-label">${hour.label}</span></div>`).join("")}</div></div>
        <div class="panel-card report-card"><h3>SINTOMAS MAIS FREQUENTES</h3><p>Contagem dos sintomas informados nos registros.</p>${
          Object.entries(symptomCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(
              ([name, count]) =>
                `<div class="symptom-stat"><div class="symptom-stat-head"><span>${escapeHtml(name)}</span><span>${count}</span></div><div class="progress"><span class="progress-fill" data-width="${(count / maxSymptom) * 100}"></span></div></div>`,
            )
            .join("") || '<span class="muted">Sem dados de sintomas.</span>'
        }</div>
        <div class="panel-card report-card"><h3>MÉDIA DE ESPERA POR CATEGORIA</h3><p>Tempo médio entre a chegada e a finalização ou o momento atual.</p>${["Emergência", "Urgente", "Pouco Urgente"].map((name, i) => `<div class="wait-category"><div class="wait-head"><span><i class="wait-dot ${priorityClass(name)}"></i>${name}</span><span>${averageWait(todayAttendances.filter((item) => priorityClass(item.prioridade) === priorityClass(name)))}</span></div><div class="wait-note">Meta: ${["atendimento imediato", "máximo 10 minutos", "até 60 minutos"][i]}</div></div>`).join("")}</div>
      </div>
      <div class="report-grid bottom">
        <div class="panel-card report-card"><h3>STATUS DOS ATENDIMENTOS</h3><p>Distribuição dos pacientes conforme o andamento na fila.</p>${["Aguardando", "Em atendimento", "Finalizado"].map((name) => `<div class="status-stat"><span>${name.toUpperCase()}</span><span class="count-chip">${todayAttendances.filter((item) => String(item.status).toLowerCase() === name.toLowerCase()).length} pacientes</span></div>`).join("")}</div>
        <div class="panel-card report-card"><h3>DISTRIBUIÇÃO DAS CLASSIFICAÇÕES</h3><p>Quantidade de pacientes em cada prioridade sugerida ou confirmada.</p>${["Emergência", "Urgente", "Pouco Urgente"].map((name) => `<div class="priority-stat"><span>${name.toUpperCase()}</span><span class="count-chip">${todayAttendances.filter((item) => priorityClass(item.prioridade) === priorityClass(name)).length} pacientes</span></div>`).join("")}</div>
      </div>
    </section>`;
  root.querySelectorAll(".bar[data-height]").forEach((bar) => {
    bar.style.height = `${Number(bar.dataset.height) || 3}%`;
  });
  root.querySelectorAll(".progress-fill[data-width]").forEach((fill) => {
    fill.style.width = `${Number(fill.dataset.width) || 0}%`;
  });
  document
    .getElementById("refresh-reports")
    .addEventListener("click", refreshAndRender);
  document.getElementById("export-csv").addEventListener("click", exportCSV);
}
function reportMetric(label, value, sub, color = "") {
  return `<div class="metric-card"><span class="eyebrow">${label}</span><div class="metric-value ${color}">${value}</div><div class="metric-sub">${sub}</div></div>`;
}
function averageWait(items) {
  if (!items.length) return "—";
  const values = items
    .map((item) => {
      const start = dateValue(item.data_registro);
      const end = String(item.status).toLowerCase().includes("final")
        ? dateValue(item.finalizado_em || item.updated_at)
        : new Date();
      return start && end ? Math.max(0, (end - start) / 60000) : null;
    })
    .filter((value) => value !== null);
  if (!values.length) return "—";
  const minutes = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}min`
    : `${minutes} min`;
}
function countSymptoms(items) {
  const counts = {};
  items.forEach((item) =>
    symptomsCatalog.forEach((symptom) => {
      if (
        String(item.sintomas).toLowerCase().includes(symptom.name.toLowerCase())
      )
        counts[symptom.name] = (counts[symptom.name] || 0) + 1;
    }),
  );
  return counts;
}
function exportCSV() {
  const headers = [
    "ID",
    "Paciente",
    "Idade",
    "Gênero",
    "Documento",
    "Telefone",
    "Sintomas",
    "Prioridade confirmada",
    "Prioridade sugerida pela IA",
    "Status",
    "Data de registro",
  ];
  const rows = state.attendances.map((item) => [
    item.id,
    item.paciente_nome,
    item.idade,
    item.genero,
    item.documento,
    item.telefone,
    item.sintomas,
    item.prioridade,
    item.prioridade_sugerida,
    item.status,
    item.data_registro,
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(";"),
    )
    .join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "relatorio-triagem.csv";
  link.click();
  URL.revokeObjectURL(url);
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

document
  .querySelectorAll(".nav-button")
  .forEach((button) =>
    button.addEventListener("click", () => setScreen(button.dataset.screen)),
  );
loadData()
  .then(renderScreen)
  .catch((error) => {
    renderScreen();
    notify(
      `Não foi possível carregar os dados da API: ${error.message}`,
      "error",
    );
  });
setInterval(async () => {
  if (document.visibilityState === "visible") {
    await loadData().catch(() => {});
    if (state.screen === "fila") renderQueue();
  }
}, 15000);
