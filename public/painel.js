async function getAttendances() {
  const response = await fetch("/api/fila").catch(() => null);
  if (response && response.ok) {
    const data = await response.json();
    return Array.isArray(data) ? data : data.dados || data.atendimentos || [];
  }

  const fallback = await fetch("/api/atendimentos");

  if (!fallback.ok) throw new Error("Não foi possível consultar a fila.");
  const data = await fallback.json();
  return Array.isArray(data) ? data : data.dados || data.atendimentos || [];
}

function normalize(item) {
  const p = item.paciente || {};
  return {
    ...item,
    paciente_nome:
      item.paciente_nome ||
      item.nome_paciente ||
      p.nome ||
      item.nome ||
      "Paciente",
    idade: item.idade || p.idade || "—",
    prioridade:
      item.prioridade_confirmada ||
      item.prioridade ||
      item.prioridade_sugerida ||
      "Pendente",
    status: item.status || "Aguardando",
  };
}
async function update() {
  try {
    const items = (await getAttendances())
      .map(normalize)
      .filter((x) => !String(x.status).toLowerCase().includes("final"));
    items.sort((a, b) => rank(a.prioridade) - rank(b.prioridade));
    const list = document.getElementById("waiting-list");
    list.innerHTML = items.length
      ? items
          .map(
            (item, i) =>
              `<article class="waiting-item"><div class="waiting-position">${i + 1}</div><div class="waiting-code">${item.codigo || `P-${String(item.paciente_id || item.id || i + 1).padStart(3, "0")}`}</div><div><div class="waiting-name">${safe(item.paciente_nome)}</div><div class="waiting-age">${safe(item.idade)} anos</div></div><div class="waiting-state">${String(item.status).toLowerCase().includes("atendimento") ? "EM ATENDIMENTO" : "PRÓXIMO PACIENTE"}</div></article>`,
          )
          .join("")
      : '<div class="waiting-empty">Não há pacientes aguardando atendimento.</div>';
    document.getElementById("waiting-footer").textContent =
      `${items.length} paciente(s) aguardando  •  Atualizado às ${new Date().toLocaleTimeString("pt-BR")}  •  A ordem pode mudar conforme a prioridade clínica`;
  } catch (error) {
    document.getElementById("waiting-list").innerHTML =
      `<div class="waiting-empty">${safe(error.message)}</div>`;
  }
}
function rank(v) {
  v = String(v).toLowerCase();
  return v.includes("emerg")
    ? 0
    : v.includes("urgente") && !v.includes("pouco")
      ? 1
      : v.includes("pouco")
        ? 2
        : 3;
}

function safe(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
update();
setInterval(update, 5000);
