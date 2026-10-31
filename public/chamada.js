const callContent = document.getElementById("call-content");
function safe(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
async function findCall() {
  const params = new URLSearchParams(location.search);
  const id = params.get("atendimento");
  let item = null;
  if (id) {
    const response = await fetch("/api/atendimentos");
    if (response.ok) {
      const data = await response.json();
      const list = Array.isArray(data)
        ? data
        : data.dados || data.atendimentos || [];
      item = list.find((x) => String(x.id) === String(id));
    }
  }
  if (!item) {
    try {
      item = JSON.parse(
        localStorage.getItem("triagem_ultimo_chamado") || "null",
      );
    } catch {}
  }
  if (!item) {
    callContent.innerHTML =
      '<h1>PACIENTE CHAMADO</h1><p class="call-empty">Nenhum paciente foi chamado neste momento.</p>';
    return;
  }
  const p = item.paciente || {};
  const name =
    item.paciente_nome ||
    item.nome_paciente ||
    p.nome ||
    item.nome ||
    "Paciente";
  const code =
    item.codigo ||
    `P-${String(item.paciente_id || item.id || "001").padStart(3, "0")}`;
  const priority =
    item.prioridade_confirmada ||
    item.prioridade ||
    item.prioridade_sugerida ||
    "Pendente";
  callContent.innerHTML = `<h1>PACIENTE CHAMADO</h1><p class="called-name">${safe(name)}</p><p class="called-code">${safe(code)}</p><p class="direction">DIRIJA-SE À SALA DE ATENDIMENTO</p><p class="call-priority">Prioridade: ${safe(priority)}</p>`;
}
findCall();
window.addEventListener("storage", (event) => {
  if (event.key === "triagem_ultimo_chamado") findCall();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") location.href = "/painel.html";
});
setInterval(findCall, 5000);
