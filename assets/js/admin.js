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
  $("#adminBar").hidden = $("#formBar").hidden = me.role !== "admin";
  buildFilterPanel();
  $("#asg").innerHTML = opts(
    staff.map((x) => x.name),
    "اختر عضو HR",
  ).replace(
    /<option>(.*?)<\/option>/g,
    (m, n) => `<option value="${staff.find((x) => x.name === n)?.id}">${n}</option>`,
  );
  await load();
  await loadFormStatus();
}
async function load() {
  loader(true, "جاري تحميل البيانات...");
  const PAGE = 1000; // الحد الأقصى الذي يرجعه Supabase في الطلب الواحد
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const r = await sb
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    if (r.error) {
      loader(false);
      alert(r.error.message);
      return;
    }
    all.push(...r.data);
    loader(true, `جاري تحميل البيانات... (${all.length})`);
    if (r.data.length < PAGE) break;
  }
  loader(false);
  rows = all;
  draw();
}
const stOf = (r) => (r.decision === "accepted" ? "a" : r.decision === "rejected" ? "r" : "p");
const view = () => applyFilters(rows);
let lastN = 0;
const setCount = () => ($("#cnt").textContent = `${lastN} طلب` + (sel.size ? ` | محدد ${sel.size}` : ""));
function draw() {
  if (!$("#statsView").hidden) stats();
  const v = view();
  lastN = v.length;
  renderTable(v);
  setCount();
  renderChips();
}
$("#tb").onclick = (e) => {
  const t = e.target;
  if (t.classList.contains("ck")) {
    t.checked ? sel.add(t.dataset.id) : sel.delete(t.dataset.id);
    setCount();
  }
  if (t.classList.contains("nm")) profile(t.dataset.id);
};
$("#asgBtn").onclick = async () => {
  const to = $("#asg").value;
  if (!to || !sel.size) return alert("اختر عضو HR وحدد المتقدمين أولاً");
  for (const part of chunk([...sel], 100)) {
    const { error } = await sb.from("applications").update({ assigned_to: to }).in("id", part);
    if (error) return alert(error.message);
  }
  sel.clear();
  await load();
  alert("تم التوزيع");
};
$("#exp").onclick = async () => {
  try {
    await loadLib("xlsx");
  } catch (e) {
    return alert(e.message);
  }
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
  try {
    await loadLib("xlsx");
  } catch (err) {
    return alert(err.message);
  }
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

/* فتح وغلق الاستمارة */
let formOpen = true;
const renderFormToggle = () => {
  const t = $("#formToggle");
  t.classList.toggle("on", formOpen);
  t.setAttribute("aria-checked", formOpen);
  $("#formLbl").textContent = formOpen ? "الاستمارة مفتوحة للتسجيل" : "الاستمارة مغلقة";
};
async function loadFormStatus() {
  if (me?.role !== "admin") return;
  const { data } = await sb.rpc("form_is_open");
  formOpen = data !== false;
  renderFormToggle();
}
$("#formToggle").onclick = async () => {
  const next = !formOpen;
  if (!next && !confirm("هل تريد إغلاق الاستمارة؟ لن يتمكن أي شخص من التسجيل حتى تعيد فتحها.")) return;
  const { error } = await sb.from("settings").upsert({ key: "form_open", value: next });
  if (error) return alert("تعذر تغيير الحالة: " + error.message);
  formOpen = next;
  renderFormToggle();
};

/* حذف الطلبات مع صورها */
async function deleteApplications(ids) {
  if (!ids.length) return alert("حدد الطلبات التي تريد حذفها أولاً");
  if (!confirm(`سيتم حذف ${ids.length} طلب نهائياً مع صورهم، ولا يمكن التراجع. هل أنت متأكد؟`)) return false;
  loader(true, "جاري الحذف...");
  const photos = rows
    .filter((r) => ids.includes(r.id))
    .map((r) => (r.photo_url || "").split("/photos/")[1])
    .filter(Boolean);
  let data = [],
    error = null;
  for (const part of chunk(ids, 100)) {
    const res = await sb.from("applications").delete().in("id", part).select("id");
    if (res.error) {
      error = res.error;
      break;
    }
    data = data.concat(res.data);
  }
  loader(false);
  if (error) {
    alert(error.message);
    if (data.length) await load();
    return false;
  }
  if (!data.length) {
    alert("لم يُحذف شيء، تأكد أن حسابك أدمن");
    return false;
  }
  if (photos.length) await sb.storage.from("photos").remove(photos);
  const gone = new Set(data.map((x) => x.id));
  rows = rows.filter((r) => !gone.has(r.id));
  gone.forEach((id) => sel.delete(id));
  draw();
  return true;
}
$("#delBtn").onclick = () => deleteApplications([...sel]);

/* تحديث البيانات مع الإبقاء على الفلاتر */
$("#refreshBtn").onclick = async () => {
  const b = $("#refreshBtn");
  b.classList.add("spin");
  b.disabled = true;
  await init();
  draw();
  b.classList.remove("spin");
  b.disabled = false;
};
