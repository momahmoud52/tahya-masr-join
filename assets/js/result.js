/* الاستعلام عن نتيجة المقابلة بالرقم القومي */
const ICON_OK =
  '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>';
const ICON_HEART =
  '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
digits($("#qid"), 14);
$("#qid").addEventListener("keydown", (e) => e.key === "Enter" && $("#qbtn").click());
$("#qbtn").onclick = async () => {
  const id = $("#qid").value;
  const o = $("#qres");
  if (id.length !== 14) {
    o.innerHTML = '<p class="err">أدخل 14 رقماً</p>';
    return;
  }
  loader(true, "جاري البحث...");
  const { data, error } = await sb.rpc("check_result", { nid: id });
  loader(false);
  if (error) {
    o.innerHTML = '<p class="err">حدث خطأ، حاول لاحقاً</p>';
    return;
  }
  const r = data?.[0];
  if (!r) {
    o.innerHTML = '<div class="cinfo">لا يوجد طلب بهذا الرقم القومي.</div>';
    return;
  }
  const st =
    r.decision === "accepted"
      ? ["t-a", "مقبول"]
      : r.decision === "rejected"
        ? ["t-r", "غير مقبول"]
        : ["t-p", "قيد المراجعة"];
  const msg = r.decision ? pickMessage(r.decision, r) : "";
  o.innerHTML = `<div class="res res-${st[0]}">
    <span class="tag ${st[0]}">${st[1]}</span>
    <h3>${esc(r.name_ar)}</h3>
    <p class="muted">لجنة ${esc(r.committee)}</p>
    ${msg ? `<div class="res-msg">${r.decision === "accepted" ? ICON_OK : ICON_HEART}<p>${msg}</p></div>` : ""}
    ${r.decision_reason ? `<p class="reason"><b>ملاحظة الإدارة:</b> ${esc(r.decision_reason)}</p>` : ""}
  </div>`;
};
