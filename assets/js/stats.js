/* لوحة الإحصائيات */
let stC = "";
const pc = (a, b) => (b ? ((a / b) * 100).toFixed(1).replace(/\.0$/, "") : "0");
const avgOf = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "—");
const statRows = (R) =>
  GOVS.map((g) => {
    const x = R.filter((r) => r.target_gov === g);
    return {
      g,
      n: x.length,
      m: x.filter((r) => r.gender === "ذكر").length,
      f: x.filter((r) => r.gender === "أنثى").length,
      avg: avgOf(x.map((r) => +r.age).filter(Boolean)),
    };
  }).sort((a, b) => b.n - a.n);
document.querySelector(".tabs").onclick = (e) => {
  const t = e.target.dataset.t;
  if (!t) return;
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b === e.target));
  $("#listView").hidden = t !== "listView";
  $("#statsView").hidden = t !== "statsView";
  if (t === "statsView") stats();
};
function stats() {
  const R = rows.filter((r) => !stC || r.committee === stC),
    n = R.length,
    G = statRows(R);
  const m = R.filter((r) => r.gender === "ذكر").length,
    f = R.filter((r) => r.gender === "أنثى").length;
  const ages = R.map((r) => +r.age)
    .filter((a) => a > 0)
    .sort((a, b) => a - b);
  const cnt = (k) => R.filter((r) => r.decision === k).length,
    acc = cnt("accepted"),
    rej = cnt("rejected");
  const grp = [
    ["أقل من 18", 0, 17],
    ["18 – 20", 18, 20],
    ["21 – 23", 21, 23],
    ["24 – 26", 24, 26],
    ["27 فأكثر", 27, 200],
  ].map(([l, lo, hi]) => [l, ages.filter((a) => a >= lo && a <= hi).length]);
  const C = Object.keys(COMM)
    .map((c) => [c, R.filter((r) => r.committee === c).length])
    .sort((a, b) => b[1] - a[1]);
  const bars = (arr) => {
    const mx = Math.max(1, ...arr.map((x) => x[1]));
    return arr
      .map(
        ([l, v]) =>
          `<div class="br"><span>${l}</span><div class="bt"><div class="fl" style="width:${(v / mx) * 100}%"></div></div><b>${v}</b></div>`,
      )
      .join("");
  };
  const act = G.filter((x) => x.n),
    top = act[0],
    low = act[act.length - 1],
    zero = G.filter((x) => !x.n).map((x) => x.g),
    mxg = Math.max(1, G[0].n);
  const K = [
    [n, "إجمالي الطلبات"],
    [avgOf(ages), "متوسط السن"],
    [pc(m, n) + "%", "ذكور (" + m + ")"],
    [pc(f, n) + "%", "إناث (" + f + ")"],
    [acc, "مقبول"],
    [rej, "مرفوض"],
    [n - acc - rej, "قيد المراجعة"],
  ];
  $("#statsView").innerHTML =
    `<div class="bar"><select id="stCom">${opts(Object.keys(COMM), "كل اللجان").replace(`<option>${stC}</option>`, `<option selected>${stC}</option>`)}</select><button class="btn sm alt" id="stExp">تصدير الإحصائيات Excel</button></div>
<div class="kpis">${K.map((k) => `<div class="kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join("")}</div>
<div class="hl"><div><span>أعلى محافظة انضماماً</span><br><b>${top ? top.g : "—"}</b> ${top ? `— ${top.n} متقدم (${pc(top.n, n)}%)` : ""}</div>
<div class="lo"><span>أقل محافظة انضماماً (من لديها متقدمون)</span><br><b>${low ? low.g : "—"}</b> ${low ? `— ${low.n} متقدم (${pc(low.n, n)}%)` : ""}</div>
<div class="lo"><span>محافظات بلا متقدمين (${zero.length})</span><br>${zero.length ? zero.join("، ") : "كل المحافظات بها متقدمون"}</div></div>
<div class="two"><div class="card"><h2>نسبة وتناسب الجنس</h2>
<div class="donut" style="background:${n ? `conic-gradient(var(--gold) 0 ${pc(m, n)}%,var(--red) 0)` : "#f7f0df"}"><div>${n}<br>متقدم</div></div>
<div class="lg"><span><i style="background:var(--gold)"></i>ذكور ${pc(m, n)}%</span><span><i style="background:var(--red)"></i>إناث ${pc(f, n)}%</span></div>
<p style="text-align:center;color:var(--mut);margin:8px 0 0">التناسب ذكور : إناث = ${m} : ${f}</p></div>
<div class="card"><h2>الأعمار</h2>${bars(grp)}
<p style="color:var(--mut);font-size:13px;margin:10px 0 0">المتوسط ${avgOf(ages)} سنة، الوسيط ${ages.length ? ages[Math.floor(ages.length / 2)] : "—"}، أصغر سن ${ages[0] ?? "—"}، أكبر سن ${ages[ages.length - 1] ?? "—"}</p></div></div>
<div class="card"><h2>ترتيب المحافظات من الأعلى إلى الأقل</h2>
<div class="rk h"><span>#</span><span>المحافظة</span><span>التوزيع (<i style="color:var(--gold-d)">ذكور</i> / <i style="color:var(--red)">إناث</i>)</span><span>العدد</span><span>النسبة</span><span>متوسط السن</span></div>
${G.map((x, i) => `<div class="rk"><span>${i + 1}</span><b>${x.g}</b><div class="bt"><div class="sg" style="width:${(x.n / mxg) * 100}%"><i class="m" style="flex:${x.m}"></i><i class="f" style="flex:${x.f}"></i></div></div><b>${x.n}</b><span>${pc(x.n, n)}%</span><span>${x.avg}</span></div>`).join("")}</div>
<div class="card"><h2>الإقبال على اللجان</h2>${bars(C)}</div>`;
  $("#stCom").onchange = (e) => {
    stC = e.target.value;
    stats();
  };
  $("#stExp").onclick = exportStats;
}
function exportStats() {
  const R = rows.filter((r) => !stC || r.committee === stC),
    t = R.length;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      statRows(R).map((x, i) => ({
        الترتيب: i + 1,
        المحافظة: x.g,
        العدد: x.n,
        "النسبة %": +pc(x.n, t),
        ذكور: x.m,
        إناث: x.f,
        "متوسط السن": x.avg,
      })),
    ),
    "المحافظات",
  );
  XLSX.writeFile(wb, "tahya-masr-stats.xlsx");
}
