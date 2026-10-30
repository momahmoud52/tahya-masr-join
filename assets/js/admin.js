/* لوحة الأدمن وHR: الدخول والجدول والفلاتر والتوزيع وExcel */
let me = null,
  staff = [],
  rows = [],
  sel = new Set();
const show = (a) => {
  $("#admin").style.display = a ? "block" : "none";
  document.body.style.overflow = a ? "hidden" : "";
};
const openStaff = async () => {
  show(true);
  const { data } = await sb.auth.getSession();
  if (data.session) init();
};
$("#staffLink").onclick = openStaff;
$("#back").onclick = () => show(false);
$("#exitDash").onclick = () => show(false);
if (location.hash === "#staff") openStaff();
$("#lbtn").onclick = async () => {
  const { error } = await sb.auth.signInWithPassword({
    email: $("#lemail").value.trim(),
    password: $("#lpass").value,
  });
  if (error) $("#lerr").textContent = "بيانات الدخول غير صحيحة";
  else init();
};
$("#logout").onclick = async () => {
  await sb.auth.signOut();
  $("#dash").hidden = true;
  $("#login").hidden = false;
};
async function init() {
  const {
    data: { user },
  } = await sb.auth.getUser();
  const s = await sb.from("staff").select("*");
  staff = s.data || [];
  me = staff.find((x) => x.id === user?.id);
  if (!me) {
    $("#lerr").textContent = "هذا الحساب غير مسجل ضمن الفريق";
    await sb.auth.signOut();
    return;
  }
  $("#login").hidden = true;
  $("#dash").hidden = false;
  $("#who").textContent = `${me.name} (${me.role === "admin" ? "أدمن" : "HR"})`;
  $("#adminBar").hidden = me.role !== "admin";
  $("#fg").innerHTML = opts(GOVS, "كل المحافظات");
  $("#fc").innerHTML = opts(Object.keys(COMM), "كل اللجان");
  $("#asg").innerHTML = opts(
    staff.map((x) => x.name),
    "اختر عضو HR",
  ).replace(
    /<option>(.*?)<\/option>/g,
    (m, n) => `<option value="${staff.find((x) => x.name === n)?.id}">${n}</option>`,
  );
  await load();
}
async function load() {
  loader(true, "جاري تحميل البيانات...");
  const r = await sb
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, 4999);
  loader(false);
  if (r.error) {
    alert(r.error.message);
    return;
  }
  rows = r.data;
  draw();
}
const stOf = (r) => (r.decision === "accepted" ? "a" : r.decision === "rejected" ? "r" : "p");
const view = () => {
  const q = $("#fq").value.trim(),
    g = $("#fg").value,
    c = $("#fc").value,
    s = $("#fs").value;
  return rows.filter(
    (r) =>
      (!q || r.name_ar.includes(q) || r.national_id.includes(q)) &&
      (!g || r.target_gov === g) &&
      (!c || r.committee === c) &&
      (!s || stOf(r) === s),
  );
};
function draw() {
  if (!$("#statsView").hidden) stats();
  const v = view();
  $("#cnt").textContent = v.length + " طلب";
  $("#tb").innerHTML =
    v
      .map((r) => {
        const s = stOf(r),
          t = { p: ["t-p", "قيد المراجعة"], a: ["t-a", "مقبول"], r: ["t-r", "مرفوض"] }[s];
        return `<tr><td><input type="checkbox" class="ck" data-id="${r.id}" ${sel.has(r.id) ? "checked" : ""}></td><td data-l="الاسم"><button class="nm" data-id="${r.id}">${esc(r.name_ar)}</button></td><td data-l="الرقم القومي">${r.national_id}</td><td data-l="المحافظة">${esc(r.target_gov)}</td><td data-l="اللجنة">${esc(r.committee)}</td><td data-l="الهاتف">${esc(r.phone)}</td><td data-l="HR المسؤول">${esc(staff.find((x) => x.id === r.assigned_to)?.name || "—")}</td><td data-l="الحالة"><span class="tag ${t[0]}">${t[1]}</span></td></tr>`;
      })
      .join("") || '<tr><td colspan="8">لا توجد نتائج</td></tr>';
}
["fq", "fg", "fc", "fs"].forEach((i) => ($("#" + i).oninput = draw));
$("#all").onchange = (e) => {
  view().forEach((r) => (e.target.checked ? sel.add(r.id) : sel.delete(r.id)));
  draw();
};
$("#tb").onclick = (e) => {
  const t = e.target;
  if (t.classList.contains("ck")) t.checked ? sel.add(t.dataset.id) : sel.delete(t.dataset.id);
  if (t.classList.contains("nm")) profile(t.dataset.id);
};
$("#asgBtn").onclick = async () => {
  const to = $("#asg").value;
  if (!to || !sel.size) return alert("اختر عضو HR وحدد المتقدمين أولاً");
  const { error } = await sb
    .from("applications")
    .update({ assigned_to: to })
    .in("id", [...sel]);
  if (error) return alert(error.message);
  sel.clear();
  await load();
  alert("تم التوزيع");
};
$("#exp").onclick = () => {
  const data = view().map((r) => {
    const o = {};
    for (const k in COLS) o[COLS[k]] = r[k];
    o["الحالة"] = { a: "مقبول", r: "مرفوض", p: "قيد المراجعة" }[stOf(r)];
    o["السبب"] = r.decision_reason;
    o["درجة التقييم"] = r.scores ? Object.values(r.scores).reduce((a, b) => a + +b, 0) : "";
    return o;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "الأعضاء");
  XLSX.writeFile(wb, "tahya-masr-members.xlsx");
};
$("#imp").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const wb = XLSX.read(await f.arrayBuffer());
  const inv = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [v, k]));
  const out = XLSX.utils
    .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false })
    .map((r) => {
      const o = {};
      for (const h in r) {
        const k = inv[h] || (h in COLS ? h : null);
        if (k) o[k] = String(r[h]).trim() || null;
      }
      if (o.age) o.age = +o.age || null;
      return o;
    })
    .filter((o) => /^\d{14}$/.test(o.national_id || "") && o.name_ar);
  if (!out.length) {
    alert("لا توجد صفوف صالحة (تأكد من الاسم والرقم القومي)");
    return;
  }
  loader(true, "جاري الاستيراد...");
  for (let i = 0; i < out.length; i += 200) {
    const { error } = await sb
      .from("applications")
      .upsert(out.slice(i, i + 200), { onConflict: "national_id", ignoreDuplicates: true });
    if (error) {
      loader(false);
      return alert(error.message);
    }
  }
  e.target.value = "";
  await load();
  alert(`تم استيراد ${out.length} صف (المكرر تم تجاهله)`);
};
