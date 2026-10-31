/* تصدير لوحة الإحصائيات إلى PDF بنفس الرسومات (html2canvas + jsPDF) */
async function exportStatsPdf() {
  const src = $("#statsView"),
    btn = $("#stPdf");
  if (!window.html2canvas || !window.jspdf) return alert("مكتبة PDF لم تُحمَّل، تحقق من الاتصال بالإنترنت");
  btn.disabled = true;
  loader(true, "جاري إنشاء ملف PDF...");
  const root = document.createElement("div");
  root.className = "pdf-root";
  root.innerHTML = `<div class="pdf-head"><h1>تقرير لوحة الإحصائيات</h1><p>اتحاد طلاب تحيا مصر${
    stC ? " | " + esc(stC) : ""
  } | ${new Date().toLocaleDateString("ar-EG")}</p></div>`;
  [...src.children]
    .filter((el) => !el.classList.contains("bar"))
    .forEach((el) => root.append(el.cloneNode(true)));
  document.body.append(root);
  try {
    await document.fonts?.ready;
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }),
      M = 10,
      W = 210 - M * 2,
      PAGE_H = 297 - M;
    let y = M;
    for (const el of root.children) {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", windowWidth: 1100 });
      const h = (canvas.height * W) / canvas.width;
      if (y + h > PAGE_H && y > M) {
        pdf.addPage();
        y = M;
      }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M, y, W, h);
      y += h + 4;
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
