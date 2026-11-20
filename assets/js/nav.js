/* التنقل: زر الرجوع (في المتصفح أو الهاتف) يغلق آخر نافذة أو لوحة مفتوحة بدل الخروج من الموقع.
   كل نافذة تُفتح بـ openLayer وتُغلق بـ closeLayer، ويُسجَّل لها مدخل في سجل المتصفح. */
const LAYERS = {
  admin: ["#admin", "block"],
  profile: ["#modal", "flex"],
  invite: ["#inviteModal", "flex"],
  assign: ["#assignModal", "flex"],
};
const layerStack = [];
let navSuppress = 0;

const hideLayerDom = (name) => {
  $(LAYERS[name][0]).style.display = "none";
  if (name === "admin") {
    document.body.style.overflow = "";
    if (location.hash === "#staff")
      history.replaceState(history.state, "", location.pathname + location.search);
  }
};
function openLayer(name) {
  const [selector, display] = LAYERS[name];
  $(selector).style.display = display;
  if (name === "admin") document.body.style.overflow = "hidden";
  if (layerStack[layerStack.length - 1] !== name) {
    layerStack.push(name);
    history.pushState({ layer: name }, "");
  }
}
function closeLayer(name) {
  const i = layerStack.lastIndexOf(name);
  hideLayerDom(name);
  if (i < 0) return;
  layerStack.splice(i, 1);
  if (i === layerStack.length) {
    navSuppress++; // نغلق مدخل السجل الذي أضفناه دون أن نعيد إغلاق النافذة
    history.back();
  }
}
addEventListener("popstate", () => {
  if (navSuppress > 0) {
    navSuppress--;
    return;
  }
  const name = layerStack.pop();
  if (name) hideLayerDom(name);
});
