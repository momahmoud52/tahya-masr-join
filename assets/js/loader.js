/* اللودر واللوجو وأيقونة التبويب */
const loader = (on, t) => {
  const l = document.querySelector("#loader");
  l.classList.toggle("off", !on);
  if (t) l.querySelector("p").textContent = t;
};
(function () {
  const fb =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#b3202a" stroke="#c9962e" stroke-width="6"/><text x="50" y="63" font-size="36" font-weight="700" text-anchor="middle" fill="#fff" font-family="Arial">TM</text></svg>',
    );
  const src = (typeof LOGO === "string" && LOGO) || "logo.png";
  document.querySelectorAll(".logo,#lg0").forEach((i) => {
    i.onerror = () => {
      i.onerror = null;
      i.src = fb;
    };
    i.src = src;
  });
  const fav = document.createElement("link");
  fav.rel = "icon";
  fav.href = fb;
  document.head.appendChild(fav);
  const t = new Image();
  t.onload = () => {
    fav.href = src;
  };
  t.src = src;
  setTimeout(() => loader(false), 1200);
})();
