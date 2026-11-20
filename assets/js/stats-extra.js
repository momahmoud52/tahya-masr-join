/* بطاقات إضافية في داشبورد الإحصائيات: التسجيل اليومي، التعليم، الجامعات، تقدم المقابلات،
   حمل عمل الأعضاء، وقرارات كل لجنة */
const pctInt = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const miniBars = (arr) => {
  const mx = Math.max(1, ...arr.map((x) => x[1]));
  return (
    arr
      .map(
        ([l, v]) =>
          `<div class="br"><span>${esc(l)}</span><div class="bt"><div class="fl" style="width:${(v / mx) * 100}%"></div></div><b>${v}</b></div>`,
      )
      .join("") || '<p class="muted">لا توجد بيانات</p>'
  );
};
const stackBar = (acc, rej, pen, scale) =>
  `<div class="bt"><div class="sg" style="width:${scale}%"><i class="m" style="flex:${acc}"></i><i class="f" style="flex:${rej}"></i><i class="p" style="flex:${pen}"></i></div></div>`;

function extraCards(R) {
  const n = R.length;

  /* 1) التسجيل اليومي: آخر 30 يوماً */
  const dayKey = (d) => d.toLocaleDateString("en-CA"),
    today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29 + i);
    return {
      k: dayKey(d),
      l: d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "numeric" }),
      n: 0,
    };
  });
  const di = new Map(days.map((d, i) => [d.k, i]));
  R.forEach((r) => {
    const i = r.created_at ? di.get(dayKey(new Date(r.created_at))) : null;
    if (i != null) days[i].n++;
  });
  const peak = days.reduce((a, b) => (b.n > a.n ? b : a), days[0]),
    last7 = days.slice(-7).reduce((s, d) => s + d.n, 0),
    total30 = days.reduce((s, d) => s + d.n, 0);

  /* 2) المستوى التعليمي + أعلى الجامعات */
  const eduNames = ["ثانوي", "جامعي", "فوق جامعي"],
    edu = eduNames.map((e) => [e, R.filter((r) => r.education === e).length]),
    unknown = n - edu.reduce((s, x) => s + x[1], 0);
  if (unknown > 0) edu.push(["غير محدد", unknown]);
  const uni = new Map();
  R.forEach((r) => {
    const u = (r.university || "").trim();
    if (u) uni.set(u, (uni.get(u) || 0) + 1);
  });
  const topUni = [...uni].sort((a, b) => b[1] - a[1]).slice(0, 8);

  /* 3) تقدم المقابلات */
  const invited = R.filter((r) => r.invited_at).length,
    evaluated = R.filter((r) => r.scores).length,
    decided = R.filter((r) => r.decision).length,
    scores = R.map(scoreOf).filter((x) => x != null),
    prog = (l, v) =>
      `<div class="br wide"><span>${l} (${v}/${n})</span><div class="bt"><div class="fl" style="width:${pctInt(v, n)}%"></div></div><b>${pctInt(v, n)}%</b></div>`;

  /* 4) حمل عمل الأعضاء */
  const load = staff
    .map((s) => {
      const mine = R.filter((r) => (r.assignees || []).includes(s.id));
      return {
        name: s.name,
        n: mine.length,
        ev: mine.filter((r) => r.scores).length,
        dec: mine.filter((r) => r.decision).length,
      };
    })
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);
  const undist = R.filter((r) => !(r.assignees || []).length).length,
    mxl = Math.max(1, ...load.map((x) => x.n));

  /* 5) قرارات كل لجنة */
  const perC = Object.keys(COMM)
    .map((c) => {
      const x = R.filter((r) => r.committee === c),
        a = x.filter((r) => r.decision === "accepted").length,
        j = x.filter((r) => r.decision === "rejected").length;
      return { c, n: x.length, a, j, p: x.length - a - j };
    })
    .sort((a, b) => b.n - a.n);
  const mxc = Math.max(1, ...perC.map((x) => x.n));

  return `<div class="card"><h2>التسجيل اليومي (آخر 30 يوماً)</h2>
<div class="vbars">${days
    .map(
      (d) =>
        `<div class="vb${d === peak && d.n ? " hi" : ""}" style="height:${d.n ? Math.max((d.n / Math.max(1, peak.n)) * 100, 4) : 1}%" title="${d.l}: ${d.n}"></div>`,
    )
    .join("")}</div>
<div class="vlabels"><span>${days[0].l}</span><span>${days[29].l}</span></div>
<p class="note">آخر 7 أيام: <b>${last7}</b> | آخر 30 يوماً: <b>${total30}</b> | أعلى يوم: <b>${peak.n ? `${peak.l} (${peak.n})` : "—"}</b></p></div>
<div class="two"><div class="card"><h2>المستوى التعليمي</h2>${miniBars(edu)}</div>
<div class="card"><h2>أعلى الجامعات</h2>${miniBars(topUni)}</div></div>
<div class="two"><div class="card"><h2>تقدم المقابلات</h2>${prog("تمت دعوتهم", invited)}${prog("تم تقييمهم", evaluated)}${prog("حُسم قرارهم", decided)}
<p class="note">متوسط الدرجة الكلية: <b>${avgOf(scores)}</b>${scores.length ? ` من ${CRIT.length * 5}` : ""}</p></div>
<div class="card"><h2>حمل عمل الأعضاء</h2>
<div class="hw h"><span>العضو</span><span>نسبة الحسم</span><span>معيّنون</span><span>قيّموا</span><span>حسموا</span></div>
${
  load
    .map(
      (x) =>
        `<div class="hw"><b>${esc(x.name)}</b><div class="bt"><div class="fl" style="width:${pctInt(x.dec, x.n)}%"></div></div><span>${x.n}</span><span>${x.ev}</span><span>${x.dec}</span></div>`,
    )
    .join("") || '<p class="muted">لا يوجد توزيع بعد</p>'
}
<p class="note">بلا مسؤول: <b>${undist}</b> متقدم</p></div></div>
<div class="card"><h2>قرارات كل لجنة</h2>
<div class="lg"><span><i style="background:var(--gold)"></i>مقبول</span><span><i style="background:var(--red)"></i>مرفوض</span><span><i style="background:#d9d2c3"></i>قيد المراجعة</span></div>
<div class="cm h"><span>اللجنة</span><span>التوزيع</span><span>العدد</span><span>نسبة القبول</span></div>
${perC
  .map(
    (x) =>
      `<div class="cm"><b>${esc(x.c)}</b>${stackBar(x.a, x.j, x.p, (x.n / mxc) * 100)}<span>${x.n}</span><span>${x.a + x.j ? pctInt(x.a, x.a + x.j) + "%" : "—"}</span></div>`,
  )
  .join("")}</div>`;
}
