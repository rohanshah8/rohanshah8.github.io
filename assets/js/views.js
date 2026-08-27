(function () {
  var nodes = document.querySelectorAll('[data-views]');
  if (!nodes.length) return;

  function hide(el) {
    el.style.display = 'none';
    var prev = el.previousElementSibling;
    if (prev && prev.classList.contains('meta-dot')) {
      prev.style.display = 'none';
    }
  }

  Array.prototype.forEach.call(nodes, function (el) {
    var endpoint = el.getAttribute('data-views-endpoint');
    var key = el.getAttribute('data-views-key');
    if (!endpoint || !key) { hide(el); return; }

    /* Post pages increment; list items only read. */
    var increment = el.getAttribute('data-views-mode') === 'increment';
    var url = endpoint + '/' + key + (increment ? '/up' : '');

    fetch(url)
      .then(function (res) {
        /* A counter that does not exist yet is zero, not an error. */
        if (res.status === 404) return { count: 0 };
        if (!res.ok) throw new Error('views request failed');
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data.count === 'undefined') {
          throw new Error('no count in response');
        }
        el.textContent = data.count === 1 ? '1 view' : data.count + ' views';
      })
      .catch(function () { hide(el); });
  });
})();
