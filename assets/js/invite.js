/* دعوة المقابلة الشخصية: رسالة جاهزة ومنسّقة تُفتح في Gmail أو تطبيق البريد،
   وكل ما يغيّره المرسل هو التاريخ والوقت والمكان. */
const INVITE_KEY = "tm_invite";
const ico = (d) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const MAIL_SVG = ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>');
const MAIL_DONE_SVG = ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 12 3 3 5-6"/>');

const loadInvite = () => {
  try {
    return JSON.parse(localStorage.getItem(INVITE_KEY)) || {};
  } catch {
    return {};
  }
};
const saveInvite = (v) => {
  try {
    localStorage.setItem(INVITE_KEY, JSON.stringify(v));
  } catch {}
};
const fmtDay = (d) =>
  d
    ? new Date(d + "T00:00").toLocaleDateString("ar-EG-u-nu-latn", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return new Date(2000, 0, 1, +h, +m).toLocaleTimeString("ar-EG-u-nu-latn", {
    hour: "numeric",
    minute: "2-digit",
  });
};

/* نص الرسالة: يراعي جنس المتقدم، والحقول الفارغة تظهر بين [ ] ليكتبها المرسل */
function buildInvite(r, v) {
  const f = r.gender === "أنثى";
  const body = [
    `${f ? "السيدة" : "السيد"} / ${r.name_ar} ${f ? "المحترمة" : "المحترم"}،`,
    "",
    "تحية طيبة وبعد،",
    "",
    `نشكرك على تقديمك للانضمام إلى اتحاد طلاب تحيا مصر (${r.committee} – محافظة ${r.target_gov}).`,
    "يسعدنا دعوتك لحضور المقابلة الشخصية في الموعد التالي:",
    "",
    `التاريخ: ${fmtDay(v.date) || "[التاريخ]"}`,
    `الوقت: ${fmtTime(v.time) || "[الوقت]"}`,
    `المكان: ${(v.place || "").trim() || "[المكان]"}`,
    ...((v.note || "").trim() ? ["", v.note.trim()] : []),
    "",
    `برجاء الحضور قبل الموعد بـ 15 دقيقة ${f ? "مصطحبةً" : "مصطحباً"} بطاقة الرقم القومي، والرد على هذه الرسالة لتأكيد حضورك.`,
    "",
    "مع أطيب التمنيات بالتوفيق،",
    (v.sender || "").trim() || me.name,
    "اتحاد طلاب تحيا مصر",
  ].join("\n");
  return { subject: "دعوة لحضور المقابلة الشخصية | اتحاد طلاب تحيا مصر", body };
}
const gmailUrl = (to, m) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
const mailtoUrl = (to, m) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;

/* زر الظرف داخل الجدول: يتحول إلى علامة صح عند تسجيل أن الدعوة فُتحت */
const mailCell = (r) =>
  `<button class="mailbtn${r.invited_at ? " done" : ""}" data-mail="${r.id}" aria-label="دعوة المقابلة" title="${
    r.invited_at
      ? `فُتحت دعوة ${fmtDate(r.invited_at)} بواسطة ${esc(r.invited_by || "")}`
      : "إعداد رسالة دعوة المقابلة"
  }">${r.invited_at ? MAIL_DONE_SVG : MAIL_SVG}</button>`;

/* ---------- النافذة ---------- */
let inviteId = null;
const inviteValues = () => ({
  date: $("#invDate").value,
  time: $("#invTime").value,
  place: $("#invPlace").value,
  note: $("#invNote").value,
  sender: $("#invSender").value,
});
function renderInvite() {
  const r = rows.find((x) => x.id === inviteId);
  if (!r) return;
  const v = inviteValues(),
    m = buildInvite(r, v);
  saveInvite(v);
  $("#invPreview").textContent = `الموضوع: ${m.subject}\n\n${m.body}`;
}
function openInvite(id) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  if (!r.email) return toast("لا يوجد بريد إلكتروني مسجل لهذا المتقدم");
  inviteId = id;
  const s = loadInvite();
  $("#invDate").value = s.date || "";
  $("#invTime").value = s.time || "";
  $("#invPlace").value = s.place || "";
  $("#invNote").value = s.note || "";
  $("#invSender").value = s.sender || me.name;
  $("#invTo").textContent = `إلى: ${r.name_ar} <${r.email}>`;
  $("#invNotice").hidden = !r.invited_at;
  if (r.invited_at)
    $("#invNotice").textContent =
      `سبق فتح دعوة لهذا المتقدم بتاريخ ${fmtDate(r.invited_at)} بواسطة ${r.invited_by || ""}.`;
  renderInvite();
  openLayer("invite");
}
const closeInvite = () => {
  closeLayer("invite");
  inviteId = null;
};

async function markInvited(r) {
  const u = { invited_at: new Date().toISOString(), invited_by: $("#invSender").value.trim() || me.name };
  const { data, error } = await sb.from("applications").update(u).eq("id", r.id).select("id");
  if (error || !data?.length)
    return toast("فُتحت الرسالة، لكن تعذر تسجيل أنها أُرسلت (شغّل ملف update_invite.sql)");
  Object.assign(r, u);
  draw();
  toast("سُجّل أنه تمت دعوة " + r.name_ar);
}
const currentInvite = () => {
  const r = rows.find((x) => x.id === inviteId);
  return r && { r, m: buildInvite(r, inviteValues()) };
};
$("#invGmail").onclick = () => {
  const c = currentInvite();
  if (!c) return;
  window.open(gmailUrl(c.r.email, c.m), "_blank", "noopener"); // يجب أن يكون مباشرة داخل الضغطة حتى لا يُحجب
  markInvited(c.r);
};
$("#invMailto").onclick = () => {
  const c = currentInvite();
  if (!c) return;
  location.href = mailtoUrl(c.r.email, c.m);
  markInvited(c.r);
};
$("#invCopy").onclick = async () => {
  const c = currentInvite();
  if (!c) return;
  try {
    await navigator.clipboard.writeText(`${c.m.subject}\n\n${c.m.body}`);
    toast("تم نسخ الرسالة");
  } catch {
    toast("تعذر النسخ، حدّد النص من المعاينة وانسخه يدوياً");
  }
};
["invDate", "invTime", "invPlace", "invNote", "invSender"].forEach((id) =>
  $("#" + id).addEventListener("input", renderInvite),
);
$("#invClose").onclick = closeInvite;
document.addEventListener(
  "keydown",
  (e) => e.key === "Escape" && $("#inviteModal").style.display === "flex" && closeInvite(),
);
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-mail]");
  if (b) openInvite(b.dataset.mail);
});
