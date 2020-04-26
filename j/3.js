---
---
(function () {
  {% include dotiw.js %}
  var c = document.getElementById("dotiw"),
      d = new Date(c.nextSibling.nextSibling.dateTime),
      f = function () { c.innerHTML = distanceOfTimeInWords(d, new Date) + " ago" };
  f();
  setInterval(f, 6e4);
}());
