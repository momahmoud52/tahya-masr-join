/* بروفايل المتقدم وتقييم HR والقرار */
let openProfile = null;

/* تحويل المتقدم إلى لجنة أو محافظة أخرى */
const TRANSFER_TYPES = {
  committee: {
    label: "اللجنة",
    noun: "لجنة",
    list: () => Object.keys(COMM),
    lock: (o, r) => FEMALE_ONLY.includes(o) && r.gender !== "أنثى",
  },
  target_gov: { label: "المحافظة", noun: "محافظة", list: () => GOVS, lock: () => false },
};
const transferRow = (r, field, title, placeholder) => {
  const T = TRANSFER_TYPES[field],
    options = T.list()
      .filter((o) => o !== r[field])
      .map((o) => {
        const locked = T.lock(o, r);
        return `<option value="${esc(o)}" ${locked ? "disabled" : ""}>${esc(o)}${locked ? " (للإناث فقط)" : ""}</option>`;
      })
      .join("");
  return `<div class="trow"><label>${title}</label>
<div class="bar"><select data-tf="${field}"><option value="">${placeholder}</option>${options}</select>
<select data-ta="${field}" title="المسؤول عن المقابلة بعد التحويل"><option value="">المسؤول: كما هو</option>${staff
    .map((x) => `<option value="${x.id}">${esc(x.name)}${x.role === "admin" ? " (أدمن)" : ""}</option>`)
    .join("")}</select>
<button class="btn sm gld" data-tbtn="${field}" type="button"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h13l-4-4"/><path d="M17 17H4l4 4"/></svg>تحويل</button></div></div>`;
};
const transferBox = (r) => {
  const last = (r.transfer_log || []).slice(-1)[0],
    note = last
      ? `<p class="muted tnote">آخر تحويل (${last.type === "gov" ? "المحافظة" : "اللجنة"}): من «${esc(last.from)}» إلى «${esc(last.to)}» بواسطة ${esc(last.by)}${last.hr ? ` — المسؤول: ${esc(last.hr)}` : ""} (${new Date(last.at).toLocaleDateString("ar-EG")})</p>`
      : "";
  return `<div class="transfer">${transferRow(r, "committee", "تحويل إلى لجنة أخرى", "اختر اللجنة الجديدة")}${transferRow(r, "target_gov", "تحويل إلى محافظة أخرى", "اختر المحافظة الجديدة")}${note}</div>`;
};

function profile(id) {
  openProfile = id;
  const r = rows.find((x) => x.id === id),
    sc = r.scores || {};
  const kv = [
    ["الرقم القومي", r.national_id],
    ["الجنس", r.gender],
    ["السن", r.age],
    ["تاريخ الميلاد", r.birth_date],
    ["الهاتف", r.phone],
    ["واتساب", r.whatsapp],
    ["البريد", r.email],
    ["العنوان", r.address],
    ["محافظة السكن", r.residence_gov],
    ["المستوى", r.education],
    ["الجامعة", r.university],
    ["الكلية", r.faculty],
    ["المدرسة", r.school],
    ["محافظة الانضمام", r.target_gov],
    ["اللجنة", r.committee],
  ]
    .filter((x) => x[1])
    .map((x) => `<span>${x[0]}</span><b>${esc(x[1])}</b>`)
    .join("");
  $("#mbox").innerHTML =
    `<div class="bar"><h2 style="margin:0;flex:1">${esc(r.name_ar)}</h2><button class="btn sm alt" id="mx">إغلاق</button></div>
<div class="pf"><img src="${esc(r.photo_url)}" alt="الصورة الشخصية"><div class="kv">${kv}</div></div>
${transferBox(r)}
<h3 style="border-inline-start:5px solid var(--gold);padding-inline-start:10px">تقييم المقابلة الشخصية (HR)</h3>
${CRIT.map(
  (c, i) =>
    `<div class="crit"><span>${c}</span><select class="sc" data-k="${c}">${[""]
      .concat([1, 2, 3, 4, 5])
      .map((n) => `<option value="${n}" ${sc[c] == n ? "selected" : ""}>${n || "—"}</option>`)
      .join("")}</select></div>`,
).join("")}
<p>الدرجة الكلية: <b id="tot">0</b> / ${CRIT.length * 5}</p>
<label>ملاحظات المقابِل</label><textarea id="notes" rows="3">${esc(r.hr_notes)}</textarea>
<label style="margin-top:10px">القرار النهائي</label>
<div class="dec"><label class="a"><input type="radio" name="dc" value="accepted" ${r.decision === "accepted" ? "checked" : ""}>✔ قبول</label><label class="r"><input type="radio" name="dc" value="rejected" ${r.decision === "rejected" ? "checked" : ""}>✖ رفض</label></div>
<label>سبب القرار (إجباري)</label><textarea id="reason" rows="2">${esc(r.decision_reason)}</textarea>
<div class="err" id="merr"></div><button class="btn full" id="msave">حفظ التقييم والقرار</button>${me.role === "admin" ? '<button class="btn-ghost btn-danger full" id="mdel" type="button">حذف الطلب نهائياً</button>' : ""}`;
  $("#modal").style.display = "flex";
  const tot = () =>
    ($("#tot").textContent = [...document.querySelectorAll(".sc")].reduce((a, s) => a + +s.value, 0));
  tot();
  document.querySelectorAll(".sc").forEach((s) => (s.onchange = tot));
  $("#mx").onclick = () => {
    $("#modal").style.display = "none";
    openProfile = null;
  };
  const bindTransfer = () => {
    document.querySelectorAll("#mbox [data-tbtn]").forEach((btn) => {
      btn.onclick = async () => {
        const field = btn.dataset.tbtn,
          T = TRANSFER_TYPES[field],
          to = $(`#mbox [data-tf="${field}"]`).value,
          assignee = $(`#mbox [data-ta="${field}"]`).value || null,
          hrName = staff.find((x) => x.id === assignee)?.name;
        if (!to) return alert(`اختر ${T.label} الجديدة أولاً`);
        if (
          !confirm(
            `تحويل «${r.name_ar}» من ${T.noun} «${r[field]}» إلى «${to}»${hrName ? ` وتعيين ${hrName} مسؤولاً` : ""}؟`,
          )
        )
          return;
        const log = [
          ...(r.transfer_log || []),
          {
            type: field === "committee" ? "committee" : "gov",
            from: r[field],
            to,
            by: me.name,
            at: new Date().toISOString(),
            ...(hrName ? { hr: hrName } : {}),
          },
        ];
        const { data, error } = await sb.rpc("transfer_application", {
          p_id: id,
          p_committee: field === "committee" ? to : null,
          p_gov: field === "target_gov" ? to : null,
          p_assignee: assignee,
          p_log: log,
        });
        if (error)
          return alert(error.code === "23514" ? "هذه اللجنة للإناث فقط" : "تعذر التحويل: " + error.message);
        if (!data) return alert("لا تملك صلاحية تحويل هذا الطلب");
        Object.assign(r, { [field]: to, transfer_log: log, ...(assignee ? { assigned_to: assignee } : {}) });
        if (me.role !== "admin" && assignee && assignee !== me.id) {
          // انتقل الطلب لمسؤول آخر ولم يعد ضمن قائمة هذا الحساب
          rows = rows.filter((x) => x.id !== id);
          sel.delete(id);
          $("#modal").style.display = "none";
          openProfile = null;
          draw();
          return toast(`تم تحويل «${r.name_ar}» وانتقل إلى قائمة ${hrName}`);
        }
        const lbl = field === "committee" ? "اللجنة" : "محافظة الانضمام";
        [...document.querySelectorAll("#mbox .kv span")]
          .find((x) => x.textContent === lbl)
          ?.nextElementSibling.replaceChildren(to);
        $("#mbox .transfer").outerHTML = transferBox(r);
        bindTransfer();
        draw();
      };
    });
  };
  bindTransfer();
  $("#mdel")?.addEventListener("click", async () => {
    if (await deleteApplications([id])) $("#modal").style.display = "none";
  });
  $("#msave").onclick = async () => {
    const scores = {};
    let miss = false;
    document.querySelectorAll(".sc").forEach((s) => {
      if (!s.value) miss = true;
      scores[s.dataset.k] = +s.value;
    });
    const dc = document.querySelector("input[name=dc]:checked")?.value,
      rs = $("#reason").value.trim();
    if (miss) return ($("#merr").textContent = "أكمل جميع معايير التقييم");
    if (!dc) return ($("#merr").textContent = "اختر قبول أو رفض");
    if (rs.length < 3) return ($("#merr").textContent = "اكتب سبب القرار");
    const u = {
      scores,
      hr_notes: $("#notes").value.trim() || null,
      decision: dc,
      decision_reason: rs,
      evaluated_by: me.id,
      evaluated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("applications").update(u).eq("id", id);
    if (error) return ($("#merr").textContent = error.message);
    Object.assign(r, u);
    $("#modal").style.display = "none";
    draw();
  };
}
