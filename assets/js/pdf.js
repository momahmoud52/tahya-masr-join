/* تصدير لوحة الإحصائيات إلى PDF بنفس الرسومات (html2canvas + jsPDF)
   مُحسَّن للهاتف: تحميل المكتبات عند الطلب، نسخ الجزء المطلوب فقط من الصفحة، ودقة أخف على الشاشات الصغيرة */
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

async function exportStatsPdf() {
  const src = $("#statsView"),
    btn = $("#stPdf"),
    mobile = matchMedia("(max-width: 760px)").matches;
  btn.disabled = true;
  loader(true, "جاري تحميل أدوات PDF...");
  const root = document.createElement("div");
  root.className = "pdf-root";
  try {
    await Promise.all([loadLib("html2canvas"), loadLib("jspdf")]);
    root.innerHTML = `<div class="pdf-head"><h1>تقرير لوحة الإحصائيات</h1><p>اتحاد طلاب تحيا مصر${
      stC ? " | " + esc(stC) : ""
    } | ${new Date().toLocaleDateString("ar-EG")}</p></div>`;
    [...src.children]
      .filter((el) => !el.classList.contains("bar"))
      .forEach((el) => root.append(el.cloneNode(true)));
    document.body.append(root);
    await document.fonts?.ready;

    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: true }),
      M = 10,
      W = 210 - M * 2,
      PAGE_H = 297 - M,
      parts = [...root.children],
      scale = mobile ? 1.25 : 2;
    let y = M;
    for (const [i, el] of parts.entries()) {
      loader(true, `جاري إنشاء PDF (${i + 1}/${parts.length})`);
      await nextFrame();
      const canvas = await html2canvas(el, {
        scale,
        backgroundColor: "#ffffff",
        windowWidth: 1100,
        logging: false,
        // لا ننسخ إلا الجزء المطلوب (وأسلافه والأنماط) بدل نسخ الصفحة كلها في كل مرة
        ignoreElements: (n) => !(el.contains(n) || n.contains(el) || n.closest?.("head")),
      });
      const h = (canvas.height * W) / canvas.width;
      if (y + h > PAGE_H && y > M) {
        pdf.addPage();
        y = M;
      }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.82), "JPEG", M, y, W, h, undefined, "FAST");
      y += h + 4;
      canvas.width = canvas.height = 0; // تحرير الذاكرة
    }
    pdf.save(`tahya-masr-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    alert("تعذر إنشاء PDF: " + e.message);
  } finally {
    root.remove();
    btn.disabled = false;
    loader(false);
  }
}
