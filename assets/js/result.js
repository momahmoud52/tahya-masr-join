/* الاستعلام عن نتيجة المقابلة بالرقم القومي */
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
  o.innerHTML = `<div class="res res-${st[0]}">
    <span class="tag ${st[0]}">${st[1]}</span>
    <h3>${esc(r.name_ar)}</h3>
    <p class="muted">لجنة ${esc(r.committee)}</p>
    ${r.decision_reason ? `<p><b>السبب:</b> ${esc(r.decision_reason)}</p>` : ""}
  </div>`;
};
