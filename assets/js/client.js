/* إنشاء اتصال Supabase */
let sb;
try {
  sb = supabase.createClient(SUPA_URL, SUPA_KEY);
} catch (e) {
  console.error(e);
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div");
    d.style.cssText = "background:#fbe1e3;color:#b3202a;padding:12px;text-align:center;font-weight:700";
    d.textContent = "لم يتم ضبط الاتصال بـ Supabase: عدّل SUPA_URL و SUPA_KEY داخل index.html";
    document.body.prepend(d);
  });
}
