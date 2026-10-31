/* دوال مساعدة عامة */
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
const opts = (a, ph) => `<option value="">${ph}</option>` + a.map((x) => `<option>${x}</option>`).join("");
const en = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

const digits = (el, max) =>
  (el.oninput = () => {
    el.value = en(el.value).replace(/\D/g, "").slice(0, max);
  });

/* ضغط الصورة تلقائياً إلى JPEG بحجم أقصى 150 كيلوبايت */
const MAX_PHOTO = 150 * 1024;
const compressImage = async (file, maxBytes = MAX_PHOTO) => {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("صيغة الصورة غير مدعومة، استخدم JPG أو PNG");
  }
  let scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  for (let i = 0; i < 8; i++) {
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    for (let q = 0.85; q >= 0.4; q -= 0.1) {
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= maxBytes) return blob;
    }
    scale *= 0.8;
  }
  throw new Error("تعذر ضغط الصورة إلى 150 كيلوبايت، جرّب صورة أخرى");
};

/* تحميل المكتبات الثقيلة عند الحاجة فقط (Excel وPDF) بدل تحميلها مع كل صفحة */
const LIBS = {
  xlsx: ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", () => window.XLSX],
  html2canvas: [
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    () => window.html2canvas,
  ],
  jspdf: ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => window.jspdf],
};
const libPromises = {};
const loadLib = (name) => {
  const [src, ready] = LIBS[name];
  if (ready()) return Promise.resolve();
  if (!libPromises[name]) {
    libPromises[name] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => {
        delete libPromises[name];
        reject(new Error("تعذر تحميل المكتبة، تحقق من الاتصال بالإنترنت"));
      };
      document.head.append(s);
    });
  }
  return libPromises[name];
};

/* تقسيم قائمة إلى دفعات (حدود Supabase: 1000 صف لكل طلب، وطول الرابط) */
const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
