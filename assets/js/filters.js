/* الفلاتر المتقدمة: اختيار متعدد، بحث نصي، نطاق أرقام وتواريخ، مع شرائح للفلاتر النشطة */
const STATUS_LABEL = { p: "قيد المراجعة", a: "مقبول", r: "مرفوض" };
const scoreOf = (r) => (r.scores ? Object.values(r.scores).reduce((a, b) => a + +b, 0) : null);
const assignedName = (r) => staff.find((x) => x.id === r.assigned_to)?.name || "غير موزع";

const FILTER_FIELDS = [
  { k: "target_gov", l: "محافظة الانضمام", t: "multi", opts: () => GOVS },
  { k: "committee", l: "اللجنة", t: "multi", opts: () => Object.keys(COMM) },
  {
    k: "status",
    l: "الحالة",
    t: "multi",
    opts: () => Object.values(STATUS_LABEL),
    get: (r) => STATUS_LABEL[stOf(r)],
  },
  { k: "gender", l: "الجنس", t: "multi", opts: () => ["ذكر", "أنثى"] },
  { k: "education", l: "المستوى التعليمي", t: "multi", opts: () => ["ثانوي", "جامعي", "فوق جامعي"] },
  { k: "residence_gov", l: "محافظة السكن", t: "multi", opts: () => GOVS },
  {
    k: "assigned",
    l: "HR المسؤول",
    t: "multi",
    opts: () => ["غير موزع", ...staff.map((s) => s.name)],
    get: assignedName,
  },
  {
    k: "evaluated",
    l: "التقييم",
    t: "multi",
    opts: () => ["تم تقييمه", "لم يُقيَّم"],
    get: (r) => (r.scores ? "تم تقييمه" : "لم يُقيَّم"),
  },
  {
    k: "transferred",
    l: "تحويل بين اللجان",
    t: "multi",
    opts: () => ["محوَّل", "غير محوَّل"],
    get: (r) => (r.transfer_log?.length ? "محوَّل" : "غير محوَّل"),
  },
  { k: "university", l: "الجامعة", t: "text" },
  { k: "faculty", l: "الكلية", t: "text" },
  { k: "school", l: "المدرسة", t: "text" },
  { k: "age", l: "السن", t: "range" },
  { k: "score", l: "درجة التقييم", t: "range", get: scoreOf },
  { k: "created_at", l: "تاريخ التسجيل", t: "range", date: true },
];

const F = { q: "", multi: {}, text: {}, range: {} };
const valueOf = (f, r) => (f.get ? f.get(r) : r[f.k]);
const rangeOf = (f) => {
  const { from = "", to = "" } = F.range[f.k] || {};
  return { from, to, on: from !== "" || to !== "" };
};
const isActive = (f) =>
  f.t === "multi" ? !!F.multi[f.k]?.size : f.t === "text" ? !!(F.text[f.k] || "").trim() : rangeOf(f).on;

function applyFilters(list) {
  const q = F.q.trim(),
    active = FILTER_FIELDS.filter(isActive);
  return list.filter((r) => {
    if (q && !(r.name_ar.includes(q) || r.national_id.includes(q) || (r.phone || "").includes(q)))
      return false;
    for (const f of active) {
      const v = valueOf(f, r);
      if (f.t === "multi") {
        if (!F.multi[f.k].has(v)) return false;
      } else if (f.t === "text") {
        if (!String(v || "").includes(F.text[f.k].trim())) return false;
      } else {
        const { from, to } = rangeOf(f);
        const x = f.date ? (v || "").slice(0, 10) : v == null || v === "" ? null : +v;
        if (x == null || x === "") return false;
        if (from !== "" && x < (f.date ? from : +from)) return false;
        if (to !== "" && x > (f.date ? to : +to)) return false;
      }
    }
    return true;
  });
}

/* ---------- بناء اللوحة ---------- */
const sumText = (f) => {
  const s = F.multi[f.k];
  return s?.size ? (s.size === 1 ? [...s][0] : `${s.size} محددة`) : "الكل";
};
const fieldHtml = (f) => {
  if (f.t === "multi") {
    const set = F.multi[f.k] || new Set(),
      o = f.opts();
    return `<div class="ff"><label>${f.l}</label><details class="msel" data-k="${f.k}"><summary>${sumText(f)}</summary>
<div class="mlist">${o.length > 8 ? '<input class="msearch" placeholder="ابحث..." />' : ""}
<div class="mitems">${o.map((x) => `<label class="mi"><input type="checkbox" value="${esc(x)}" ${set.has(x) ? "checked" : ""} /><span>${esc(x)}</span></label>`).join("")}</div>
<div class="mfoot"><button type="button" class="link mclear">مسح الاختيار</button></div></div></details></div>`;
  }
  if (f.t === "text")
    return `<div class="ff"><label>${f.l}</label><input data-text="${f.k}" value="${esc(F.text[f.k] || "")}" placeholder="يحتوي على..." /></div>`;
  const { from, to } = rangeOf(f),
    ty = f.date ? "date" : "number";
  return `<div class="ff${f.date ? " wide" : ""}"><label>${f.l}</label><div class="rng"><input type="${ty}" data-r="${f.k}" data-b="from" value="${from}" placeholder="من" aria-label="${f.l} من" /><span>إلى</span><input type="${ty}" data-r="${f.k}" data-b="to" value="${to}" placeholder="إلى" aria-label="${f.l} إلى" /></div></div>`;
};
function buildFilterPanel() {
  $("#fFields").innerHTML = FILTER_FIELDS.map(fieldHtml).join("");
}

/* ---------- الشرائح والعدّاد ---------- */
function activeChips() {
  const c = [];
  if (F.q.trim()) c.push({ id: "q", text: `بحث: ${F.q.trim()}` });
  for (const f of FILTER_FIELDS.filter(isActive)) {
    let v;
    if (f.t === "multi") v = [...F.multi[f.k]].join("، ");
    else if (f.t === "text") v = F.text[f.k].trim();
    else {
      const { from, to } = rangeOf(f);
      v = from && to ? `${from} ← ${to}` : from ? `من ${from}` : `حتى ${to}`;
    }
    c.push({ id: f.k, text: `${f.l}: ${v}` });
  }
  return c;
}
function renderChips() {
  const c = activeChips();
  $("#fChips").innerHTML = c
    .map(
      (x) =>
        `<span class="chip">${esc(x.text)}<button type="button" data-chip="${x.id}" aria-label="إزالة الفلتر">✕</button></span>`,
    )
    .join("");
  $("#fBadge").textContent = c.length;
  $("#fBadge").hidden = !c.length;
  $("#fClear").hidden = !c.length;
}
function clearFilter(id) {
  if (id === "q") {
    F.q = "";
    $("#fq").value = "";
  }
  delete F.multi[id];
  delete F.text[id];
  delete F.range[id];
  buildFilterPanel();
  draw();
}

/* ---------- الأحداث ---------- */
const debounce = (fn, ms = 200) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
const redraw = debounce(() => draw());

$("#fq").addEventListener("input", (e) => {
  F.q = e.target.value;
  redraw();
});
$("#fFields").addEventListener("change", (e) => {
  const d = e.target.closest(".msel");
  if (!d) return;
  const k = d.dataset.k,
    set = (F.multi[k] ||= new Set());
  e.target.checked ? set.add(e.target.value) : set.delete(e.target.value);
  if (!set.size) delete F.multi[k];
  d.querySelector("summary").textContent = sumText(FILTER_FIELDS.find((f) => f.k === k));
  draw();
});
$("#fFields").addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.text) {
    F.text[t.dataset.text] = t.value;
    redraw();
  } else if (t.dataset.r) {
    (F.range[t.dataset.r] ||= {})[t.dataset.b] = t.value;
    redraw();
  } else if (t.classList.contains("msearch")) {
    const q = t.value.trim();
    t.closest(".mlist")
      .querySelectorAll(".mi")
      .forEach((l) => (l.hidden = !!q && !l.textContent.includes(q)));
  }
});
$("#fFields").addEventListener("click", (e) => {
  if (!e.target.classList.contains("mclear")) return;
  const d = e.target.closest(".msel"),
    k = d.dataset.k;
  delete F.multi[k];
  d.querySelectorAll("input[type=checkbox]").forEach((i) => (i.checked = false));
  d.querySelector("summary").textContent = "الكل";
  draw();
});
$("#fChips").addEventListener("click", (e) => e.target.dataset.chip && clearFilter(e.target.dataset.chip));
$("#fClear").addEventListener("click", () => {
  F.q = "";
  F.multi = {};
  F.text = {};
  F.range = {};
  $("#fq").value = "";
  buildFilterPanel();
  draw();
});
document.addEventListener("click", (e) =>
  document.querySelectorAll(".msel[open]").forEach((d) => !d.contains(e.target) && d.removeAttribute("open")),
);
document.addEventListener(
  "keydown",
  (e) =>
    e.key === "Escape" && document.querySelectorAll(".msel[open]").forEach((d) => d.removeAttribute("open")),
);
const togglePanel = (btn, panel, other, otherBtn) => {
  const open = panel.hidden;
  panel.hidden = !open;
  btn.setAttribute("aria-expanded", open);
  if (open) {
    other.hidden = true;
    otherBtn.setAttribute("aria-expanded", false);
  }
};
$("#fToggle").onclick = () => togglePanel($("#fToggle"), $("#fPanel"), $("#colPanel"), $("#colToggle"));
$("#colToggle").onclick = () => togglePanel($("#colToggle"), $("#colPanel"), $("#fPanel"), $("#fToggle"));
