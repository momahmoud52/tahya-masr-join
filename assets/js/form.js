/* استمارة الانضمام: التحقق والرفع والإرسال */
$("#residence_gov").innerHTML = opts(GOVS, "اختر المحافظة");
$("#target_gov").innerHTML = opts(GOVS, "اختر المحافظة");
$("#committee").onchange = (e) => {
  const c = COMM[e.target.value];
  $("#cinfo").innerHTML = c
    ? `<div class="cinfo"><b>تعريف اللجنة:</b> ${c[0]}<br><b>المطلوب منك:</b> ${c[1]}</div>`
    : "";
};
const renderCommittees = () => {
  const sel = $("#committee"),
    cur = sel.value,
    female = document.querySelector("input[name=gender]:checked")?.value === "أنثى";
  sel.innerHTML =
    `<option value="">اختر اللجنة</option>` +
    Object.keys(COMM)
      .map((c) => {
        const fo = FEMALE_ONLY.includes(c);
        return `<option value="${c}" ${fo && !female ? "disabled" : ""}>${c}${fo ? " (للإناث فقط)" : ""}</option>`;
      })
      .join("");
  sel.value = cur && !(FEMALE_ONLY.includes(cur) && !female) ? cur : "";
  sel.dispatchEvent(new Event("change"));
};
renderCommittees();
document
  .querySelectorAll("input[name=gender]")
  .forEach((r) => r.addEventListener("change", renderCommittees));
digits($("#national_id"), 14);
digits($("#phone"), 11);
digits($("#whatsapp"), 11);
$("#name_ar").oninput = (e) =>
  (e.target.value = e.target.value.replace(/[^\u0600-\u06FF\s]/g, "").replace(/\s{2,}/g, " "));
const calcAge = (d) => {
  const b = new Date(d),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
};
$("#birth_date").onchange = (e) => ($("#age").value = e.target.value ? calcAge(e.target.value) : "");
$("#national_id").addEventListener("input", (e) => {
  const v = e.target.value;
  if (v.length === 14) {
    const c = { 2: 1900, 3: 2000 }[v[0]];
    if (c) {
      const d = `${c + +v.slice(1, 3)}-${v.slice(3, 5)}-${v.slice(5, 7)}`;
      if (!isNaN(new Date(d))) {
        $("#birth_date").value = d;
        $("#age").value = calcAge(d);
      }
      document.querySelector(`input[name=gender][value="${+v[12] % 2 ? "ذكر" : "أنثى"}"]`).checked = true;
      renderCommittees();
    }
  }
});
$("#education").onchange = (e) => {
  const v = e.target.value;
  $("#schoolBox").hidden = v !== "ثانوي";
  $("#uniBox").hidden = $("#facBox").hidden = v === "ثانوي" || !v;
};
$("#education").onchange({ target: $("#education") });
function bad(el, msg) {
  el.classList.add("bad");
  const e = el.closest("div").querySelector(".err");
  if (e) e.textContent = msg;
  return false;
}
$("#f").onsubmit = async (ev) => {
  ev.preventDefault();
  document.querySelectorAll(".bad").forEach((x) => x.classList.remove("bad"));
  document.querySelectorAll(".err").forEach((x) => (x.textContent = ""));
  let ok = true;
  const V = (id) => $("#" + id).value.trim();
  if (!/^[\u0600-\u06FF]+(\s[\u0600-\u06FF]+){2,}$/.test(V("name_ar")))
    ok = bad($("#name_ar"), "اكتب الاسم ثلاثياً على الأقل بالعربية");
  if (!/^[23]\d{13}$/.test(V("national_id"))) ok = bad($("#national_id"), "الرقم القومي 14 رقماً إنجليزياً");
  if (!document.querySelector("input[name=gender]:checked")) {
    ok = false;
    document.querySelector(".seg").nextElementSibling.textContent = "اختر الجنس";
  }
  for (const id of ["address", "birth_date", "residence_gov", "education", "target_gov", "committee"])
    if (!V(id)) ok = bad($("#" + id), "مطلوب");
  if (
    FEMALE_ONLY.includes(V("committee")) &&
    document.querySelector("input[name=gender]:checked")?.value !== "أنثى"
  )
    ok = bad($("#committee"), "هذه المبادرة مخصصة للإناث فقط");
  if (!/^\S+@\S+\.\S+$/.test(V("email"))) ok = bad($("#email"), "بريد غير صحيح");
  for (const id of ["phone", "whatsapp"])
    if (!/^01[0125]\d{8}$/.test(V(id))) ok = bad($("#" + id), "رقم مصري من 11 رقماً يبدأ بـ 01");
  const ed = V("education");
  if (ed === "ثانوي" && !V("school")) ok = bad($("#school"), "مطلوب");
  if (ed !== "ثانوي" && ed) {
    for (const id of ["university", "faculty"]) if (!V(id)) ok = bad($("#" + id), "مطلوب");
  }
  const file = $("#photo").files[0];
  if (!file || !file.type.startsWith("image/") || file.size > 25e6)
    ok = bad($("#photo"), "ارفع صورة بصيغة JPG أو PNG");
  if (!ok) {
    document.querySelector(".bad")?.scrollIntoView({ block: "center" });
    return;
  }
  loader(true, "جاري إرسال طلبك...");
  $("#sub").disabled = true;
  try {
    const blob = await compressImage(file),
      path = crypto.randomUUID() + ".jpg";
    const up = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const row = {
      photo_url: sb.storage.from("photos").getPublicUrl(path).data.publicUrl,
      gender: document.querySelector("input[name=gender]:checked").value,
    };
    for (const id of Object.keys(COLS))
      if (!(id in row) && id !== "photo_url" && $("#" + id)) row[id] = V(id) || null;
    row.age = +row.age || null;
    const r = await sb.from("applications").insert(row);
    if (r.error) throw r.error;
    $("#formView").hidden = true;
    $("#thName").textContent = "شكراً " + V("name_ar").split(" ")[0] + "، تم استلام طلبك";
    $("#thanks").hidden = false;
    scrollTo(0, 0);
  } catch (e) {
    alert(
      e.code === "23505"
        ? "هذا الرقم القومي مسجل بالفعل. يمكنك الاستعلام عن نتيجتك أسفل الاستمارة."
        : "تعذر الإرسال: " + (e.message || "حاول مرة أخرى"),
    );
  } finally {
    loader(false);
    $("#sub").disabled = false;
  }
};
