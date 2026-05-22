let modalEl = null;

function ensureModal() {
  if (modalEl) return modalEl;
  const wrap = document.createElement("div");
  wrap.className = "modal";
  wrap.setAttribute("hidden", "true");
  wrap.innerHTML = `
    <div class="modal__backdrop" data-modal-close="1"></div>
    <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal__head">
        <div class="modal__title" id="modalTitle"></div>
        <button class="modal__x" type="button" aria-label="Schließen" data-modal-close="1">×</button>
      </div>
      <div class="modal__body" id="modalBody"></div>
      <div class="modal__actions" id="modalActions"></div>
    </div>
  `;
  document.body.appendChild(wrap);
  modalEl = wrap;
  return wrap;
}

function openModal() {
  const el = ensureModal();
  el.hidden = false;
  document.documentElement.classList.add("modal-open");
}

function closeModal() {
  const el = ensureModal();
  el.hidden = true;
  document.documentElement.classList.remove("modal-open");
}

function setModal(title, body, actions) {
  const el = ensureModal();
  el.querySelector("#modalTitle").textContent = title || "";
  const bodyEl = el.querySelector("#modalBody");
  bodyEl.textContent = "";
  bodyEl.append(body);
  const actionsEl = el.querySelector("#modalActions");
  actionsEl.textContent = "";
  actionsEl.append(...actions);
}

function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function escapeHtml(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

export function wireModalDismiss() {
  const el = ensureModal();
  el.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.getAttribute("data-modal-close") === "1") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !ensureModal().hidden) closeModal();
  });
}

export function showAlert(message, opts = {}) {
  return new Promise((resolve) => {
    const title = opts.title || "Hinweis";
    const body = document.createElement("div");
    body.append(escapeHtml(message));
    const ok = button(opts.okText || "OK", "btn", () => {
      closeModal();
      resolve();
    });
    setModal(title, body, [ok]);
    openModal();
    ok.focus();
  });
}

export function showConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const title = opts.title || "Bestätigen";
    const body = document.createElement("div");
    body.append(escapeHtml(message));
    const cancel = button(opts.cancelText || "Abbrechen", "btn btn--ghost", () => {
      closeModal();
      resolve(false);
    });
    const okClass = opts.danger ? "btn btn--danger" : "btn";
    const ok = button(opts.okText || "OK", okClass, () => {
      closeModal();
      resolve(true);
    });
    setModal(title, body, [cancel, ok]);
    openModal();
    ok.focus();
  });
}

export function showDialog(opts) {
  return new Promise((resolve) => {
    const title = opts?.title || "";
    const body = opts?.body instanceof Node ? opts.body : document.createElement("div");
    const buttons = Array.isArray(opts?.buttons) ? opts.buttons : [{ id: "ok", label: "OK" }];

    const actionButtons = buttons.map((btn) =>
      button(btn.label || "OK", btn.danger ? "btn btn--danger" : (btn.className || "btn"), () => {
        closeModal();
        resolve(btn.id);
      })
    );

    setModal(title, body, actionButtons);
    openModal();

    const focus = opts?.focusSelector ? ensureModal().querySelector(opts.focusSelector) : null;
    if (focus instanceof HTMLElement) focus.focus();
    else actionButtons[actionButtons.length - 1]?.focus?.();
  });
}
