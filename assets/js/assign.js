/* توزيع المتقدمين على أكثر من عضو، وإزالة المسؤولين (للأدمن) */
const staffName = (id) => staff.find((s) => s.id === id)?.name || "عضو محذوف";
const mergeAssignees = (cur, mode, ids) =>
  mode === "add"
    ? [...new Set([...cur, ...ids])]
    : mode === "replace"
      ? [...new Set(ids)]
      : mode === "remove"
        ? cur.filter((x) => !ids.includes(x))
        : [];

/* ينفّذ على الخادم ثم يحدّث القائمة المحلية بنفس المنطق */
async function applyAssign(ids, mode, staffIds) {
  let total = 0;
  for (const part of chunk(ids, 500)) {
    const { data, error } = await sb.rpc("assign_applications", {
      p_ids: part,
      p_mode: mode,
      p_staff: staffIds,
    });
    if (error) {
      alert("تعذر التوزيع: " + error.message);
      return false;
    }
    total += data || 0;
  }
  const set = new Set(ids);
  rows.forEach((r) => {
    if (set.has(r.id)) r.assignees = mergeAssignees(r.assignees || [], mode, staffIds);
  });
  draw();
  return total;
}

/* ---------- نافذة التوزيع الجماعي ---------- */
const ASG_HELP = {
  add: "يُضاف الأعضاء المختارون إلى مسؤولي كل متقدم محدد، دون إزالة المسؤولين الحاليين.",
  replace: "يصبح الأعضاء المختارون هم المسؤولين فقط، ويُزال أي مسؤول سابق.",
  remove: "يُزال الأعضاء المختارون من مسؤولية المتقدمين المحددين، ويبقى باقي المسؤولين.",
  clear: "يُزال كل المسؤولين عن المتقدمين المحددين، فيصبحون بلا مسؤول.",
};
const asgMode = () => document.querySelector("input[name=asgMode]:checked").value;
const updateAsgHelp = () => {
  const m = asgMode();
  $("#asgHelp").textContent = ASG_HELP[m];
  $("#asgList").hidden = m === "clear";
  $("#asgListLabel").hidden = m === "clear";
};
function openAssign() {
  if (!sel.size) return alert("حدد المتقدمين من الجدول أولاً");
  $("#asgInfo").textContent = `سيُطبَّق على ${sel.size} متقدم محدد.`;
  $("#asgList").innerHTML = staff
    .map(
      (s) =>
        `<label class="mi"><input type="checkbox" value="${s.id}" /><span>${esc(s.name)}${s.role === "admin" ? " (أدمن)" : ""}</span></label>`,
    )
    .join("");
  document.querySelector("input[name=asgMode][value=add]").checked = true;
  updateAsgHelp();
  openLayer("assign");
}
$("#asgOpen").onclick = openAssign;
$("#asgClose").onclick = () => closeLayer("assign");
document.querySelectorAll("input[name=asgMode]").forEach((r) => r.addEventListener("change", updateAsgHelp));
$("#asgApply").onclick = async () => {
  const mode = asgMode(),
    picked = [...document.querySelectorAll("#asgList input:checked")].map((i) => i.value);
  if (mode !== "clear" && !picked.length) return alert("اختر عضواً واحداً على الأقل");
  if (mode === "clear" && !confirm(`إزالة كل المسؤولين عن ${sel.size} متقدم؟`)) return;
  const btn = $("#asgApply");
  btn.disabled = true;
  const total = await applyAssign([...sel], mode, picked);
  btn.disabled = false;
  if (total === false) return;
  closeLayer("assign");
  toast(`تم تطبيق التوزيع على ${total} متقدم`);
};
document.addEventListener(
  "keydown",
  (e) => e.key === "Escape" && $("#assignModal").style.display === "flex" && closeLayer("assign"),
);

/* ---------- المسؤولون داخل بروفايل المتقدم ---------- */
const assignBox = (r) => {
  const ids = r.assignees || [];
  if (me.role !== "admin")
    return `<div class="assignbox"><label>المسؤولون عن المقابلة</label><p class="muted tnote">${
      ids.length ? ids.map((i) => esc(staffName(i))).join("، ") : "—"
    }</p></div>`;
  const chips =
      ids
        .map(
          (i) =>
            `<span class="chip">${esc(staffName(i))}<button type="button" data-unassign="${i}" aria-label="إزالة المسؤول">✕</button></span>`,
        )
        .join("") || '<span class="muted">لا يوجد مسؤول</span>',
    options = staff
      .filter((s) => !ids.includes(s.id))
      .map((s) => `<option value="${s.id}">${esc(s.name)}${s.role === "admin" ? " (أدمن)" : ""}</option>`)
      .join("");
  return `<div class="assignbox"><label>المسؤولون عن المقابلة</label><div class="chips">${chips}</div>
<div class="bar"><select data-asg-add><option value="">إضافة مسؤول...</option>${options}</select>
<button class="btn sm gld" data-asg-btn type="button">إضافة</button>${
    ids.length
      ? '<button class="btn-ghost btn-danger sm" data-asg-clear type="button">إزالة الكل</button>'
      : ""
  }</div></div>`;
};
function bindAssign(r) {
  const box = $("#mbox .assignbox");
  if (!box || me.role !== "admin") return;
  const run = async (mode, ids) => {
    if ((await applyAssign([r.id], mode, ids)) === false) return;
    $("#mbox .assignbox").outerHTML = assignBox(r);
    bindAssign(r);
  };
  box
    .querySelectorAll("[data-unassign]")
    .forEach((b) => (b.onclick = () => run("remove", [b.dataset.unassign])));
  box.querySelector("[data-asg-btn]").onclick = () => {
    const v = box.querySelector("[data-asg-add]").value;
    if (!v) return alert("اختر العضو أولاً");
    run("add", [v]);
  };
  const clr = box.querySelector("[data-asg-clear]");
  if (clr) clr.onclick = () => confirm("إزالة كل المسؤولين عن هذا المتقدم؟") && run("clear", []);
}
