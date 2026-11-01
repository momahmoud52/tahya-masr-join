/* التحديث اللحظي: أي تحويل أو طلب جديد يصل للمسؤول تلقائياً دون تحديث الصفحة.
   لا يمس الفلاتر ولا التحديد عند أحد: يُحدّث القائمة فقط والفلاتر تُطبَّق عليها كالمعتاد. */
let rtChannel = null,
  rtReady = false,
  rtTimer = null;
const rtPending = new Set();

function startRealtime() {
  if (rtChannel) return;
  rtChannel = sb
    .channel("app-events")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_events" }, (p) => {
      rtPending.add(p.new.application_id);
      clearTimeout(rtTimer);
      rtTimer = setTimeout(flushRealtime, 400);
    })
    .subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (rtReady) load(true); // عاد الاتصال بعد انقطاع: نعيد المزامنة
      rtReady = true;
    });
}
function stopRealtime() {
  if (rtChannel) sb.removeChannel(rtChannel);
  rtChannel = null;
  rtReady = false;
  rtPending.clear();
}
async function flushRealtime() {
  const ids = [...rtPending];
  rtPending.clear();
  if (ids.length > 300) return load(true); // دفعة كبيرة (استيراد/توزيع جماعي): إعادة تحميل أسرع
  await syncIds(ids);
}

/* يجلب الطلبات المتغيّرة فقط: المرئي لهذا الحساب يُضاف/يُحدَّث، وما لم يعد مرئياً (حُوِّل لغيره أو حُذف) يُزال */
async function syncIds(ids) {
  const found = new Map();
  for (const part of chunk(ids, 100)) {
    const { data, error } = await sb.from("applications").select("*").in("id", part);
    if (error) return load(true);
    data.forEach((r) => found.set(r.id, r));
  }
  const pos = new Map(rows.map((r, i) => [r.id, i])),
    fresh = [],
    appeared = [],
    gone = new Set();
  for (const id of ids) {
    const r = found.get(id);
    if (r && pos.has(id)) {
      // طلب موجود تغيّر: هل صار يظهر الآن ضمن فلاتر هذا المستخدم بعد أن كان خارجها؟
      if (!applyFilters([rows[pos.get(id)]]).length && applyFilters([r]).length) appeared.push(r.name_ar);
      rows[pos.get(id)] = r;
    } else if (r) fresh.push(r);
    else if (pos.has(id)) gone.add(id);
  }
  if (gone.size) {
    rows = rows.filter((r) => !gone.has(r.id));
    gone.forEach((id) => sel.delete(id));
  }
  if (fresh.length) rows = [...fresh, ...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (gone.has(openProfile) && $("#modal").style.display === "flex") {
    $("#modal").style.display = "none";
    toast("نُقل الطلب الذي كنت تفتحه إلى مسؤول آخر أو حُذف");
  }
  if (fresh.length)
    toast(fresh.length === 1 ? `وصل إليك طلب: ${fresh[0].name_ar}` : `وصلت إليك ${fresh.length} طلبات جديدة`);
  else if (appeared.length)
    toast(
      appeared.length === 1 ? `ظهر في قائمتك: ${appeared[0]}` : `ظهرت في قائمتك ${appeared.length} طلبات`,
    );
  if (gone.size || fresh.length || found.size) draw();
}

/* عند عودة المستخدم للتبويب (مثلاً بعد قفل الهاتف) نتأكد أن القائمة محدّثة */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && rtChannel) load(true);
});
