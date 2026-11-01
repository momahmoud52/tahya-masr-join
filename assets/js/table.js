/* جدول الطلبات: أعمدة قابلة للاختيار (تُحفظ في المتصفح) */
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("ar-EG") : "");
const COLUMNS = [
  {
    k: "name_ar",
    l: "الاسم",
    fixed: true,
    cell: (r) => `<button class="nm" data-id="${r.id}">${esc(r.name_ar)}</button>`,
  },
  { k: "national_id", l: "الرقم القومي", def: true },
  { k: "target_gov", l: "المحافظة", def: true },
  { k: "committee", l: "اللجنة", def: true },
  { k: "phone", l: "الهاتف", def: true },
  { k: "assigned", l: "HR المسؤول", def: true, get: (r) => (r.assigned_to ? assignedName(r) : "—") },
  {
    k: "status",
    l: "الحالة",
    def: true,
    cell: (r) => `<span class="tag t-${stOf(r)}">${STATUS_LABEL[stOf(r)]}</span>`,
  },
  { k: "gender", l: "الجنس" },
  { k: "age", l: "السن" },
  { k: "education", l: "المستوى التعليمي" },
  { k: "residence_gov", l: "محافظة السكن" },
  { k: "university", l: "الجامعة" },
  { k: "faculty", l: "الكلية" },
  { k: "school", l: "المدرسة" },
  { k: "email", l: "البريد" },
  { k: "whatsapp", l: "واتساب" },
  { k: "score", l: "درجة التقييم", get: (r) => scoreOf(r) ?? "—" },
  { k: "created_at", l: "تاريخ التسجيل", get: (r) => fmtDate(r.created_at) },
];
const defaultCols = () => new Set(COLUMNS.filter((c) => c.def || c.fixed).map((c) => c.k));
const loadCols = () => {
  try {
    const s = JSON.parse(localStorage.getItem("tm_cols"));
    if (Array.isArray(s)) return new Set(s);
  } catch {}
  return defaultCols();
};
const saveCols = () => {
  try {
    localStorage.setItem("tm_cols", JSON.stringify([...visibleKeys]));
  } catch {}
};
let visibleKeys = loadCols();
const activeCols = () => COLUMNS.filter((c) => c.fixed || visibleKeys.has(c.k));

function renderTable(v) {
  const cs = activeCols(),
    allSel = v.length > 0 && v.every((r) => sel.has(r.id));
  $("#thead").innerHTML =
    `<tr><th><input type="checkbox" id="all" aria-label="تحديد الكل" ${allSel ? "checked" : ""} /></th>${cs.map((c) => `<th>${c.l}</th>`).join("")}</tr>`;
  $("#tb").innerHTML =
    v
      .map(
        (r) =>
          `<tr><td><input type="checkbox" class="ck" data-id="${r.id}" ${sel.has(r.id) ? "checked" : ""} /></td>${cs
            .map(
              (c) =>
                `<td data-l="${c.l}">${c.cell ? c.cell(r) : esc(c.get ? c.get(r) : (r[c.k] ?? ""))}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("") || `<tr><td colspan="${cs.length + 1}">لا توجد نتائج مطابقة</td></tr>`;
}

function buildColPanel() {
  $("#colList").innerHTML = COLUMNS.filter((c) => !c.fixed)
    .map(
      (c) =>
        `<label class="mi"><input type="checkbox" value="${c.k}" ${visibleKeys.has(c.k) ? "checked" : ""} /><span>${c.l}</span></label>`,
    )
    .join("");
}
buildColPanel();
$("#colList").addEventListener("change", (e) => {
  e.target.checked ? visibleKeys.add(e.target.value) : visibleKeys.delete(e.target.value);
  saveCols();
  draw();
});
$("#colReset").onclick = () => {
  visibleKeys = defaultCols();
  saveCols();
  buildColPanel();
  draw();
};
$("#thead").addEventListener("change", (e) => {
  if (e.target.id !== "all") return;
  view().forEach((r) => (e.target.checked ? sel.add(r.id) : sel.delete(r.id)));
  draw();
});
