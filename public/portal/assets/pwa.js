/* TendCo Hub — Add to Home Screen. User gesture only; no auto prompt. */
(function () {
  var deferred = null;
  var installed = false;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  function iosSteps() {
    return '<ol class="pwa-steps">'
      + '<li>Tap the <b>Share</b> button in Safari (the square with an arrow).</li>'
      + '<li>Scroll the sheet and tap <b>Add to Home Screen</b>.</li>'
      + '<li>Tap <b>Add</b>. The icon is labeled TendCo Hub.</li>'
      + '</ol>';
  }

  function menuSteps() {
    return '<ol class="pwa-steps">'
      + '<li>Open the browser menu in Chrome or Edge.</li>'
      + '<li>Choose <b>Install TendCo Hub</b> or <b>Install app</b>.</li>'
      + '<li>Confirm. The home-screen icon opens the portal.</li>'
      + '</ol>'
      + '<p class="pwa-note">On iPhone or iPad, Safari does not show that menu. Use Share, then Add to Home Screen, then Add.</p>';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function paint() {
    var standalone = installed || isStandalone();
    var installBtn = document.getElementById('pwa-install');
    var body = document.getElementById('pwa-body');
    if (standalone) {
      setText('pwa-nav-label', 'Hub is on this device');
      setText('pwa-team-copy', 'TendCo Hub is already installed on this device.');
      setText('btn-get-hub-team', 'Open install notes');
      setText('pwa-lede', 'You are using the installed app.');
      if (body) body.innerHTML = '<p class="pwa-note">TendCo Hub is already on this home screen. Open it from the icon next time.</p>';
      if (installBtn) installBtn.classList.add('hidden');
      return;
    }
    if (deferred) {
      setText('pwa-nav-label', 'Get Hub on your phone');
      setText('pwa-team-copy', 'Install TendCo Hub on this phone. It opens the portal like an app.');
      setText('btn-get-hub-team', 'Install Hub');
      setText('pwa-lede', 'This browser can add TendCo Hub to your home screen.');
      if (body) body.innerHTML = '<p class="pwa-note">Tap Install. Chrome asks once, then the Hub icon opens the portal.</p>';
      if (installBtn) installBtn.classList.remove('hidden');
      return;
    }
    if (isIos()) {
      setText('pwa-nav-label', 'Add to Home Screen');
      setText('pwa-team-copy', 'On iPhone or iPad, Safari adds TendCo Hub from the Share menu.');
      setText('btn-get-hub-team', 'Add to Home Screen');
      setText('pwa-lede', 'Safari on this iPhone or iPad does not offer a one-tap install.');
      if (body) body.innerHTML = iosSteps();
      if (installBtn) installBtn.classList.add('hidden');
      return;
    }
    setText('pwa-nav-label', 'Get Hub on your phone');
    setText('pwa-team-copy', 'Add TendCo Hub to a phone home screen so the portal opens like an app.');
    setText('btn-get-hub-team', 'Add to Home Screen');
    setText('pwa-lede', 'Use the browser install menu, or these steps on an iPhone.');
    if (body) body.innerHTML = menuSteps();
    if (installBtn) installBtn.classList.add('hidden');
  }

  function openSheet(ev) {
    if (ev) ev.preventDefault();
    var bg = document.getElementById('pwa-sheet-bg');
    var sheet = document.getElementById('pwa-sheet');
    if (!sheet) return;
    if (bg) bg.hidden = false;
    sheet.hidden = false;
    paint();
  }

  function closeSheet() {
    var bg = document.getElementById('pwa-sheet-bg');
    var sheet = document.getElementById('pwa-sheet');
    if (bg) bg.hidden = true;
    if (sheet) sheet.hidden = true;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    paint();
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    installed = true;
    closeSheet();
    if (typeof toast === 'function') toast('TendCo Hub is on your home screen');
    paint();
  });

  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.getElementById('btn-get-hub');
    var team = document.getElementById('btn-get-hub-team');
    var dismiss = document.getElementById('pwa-dismiss');
    var bg = document.getElementById('pwa-sheet-bg');
    var install = document.getElementById('pwa-install');
    if (nav) nav.addEventListener('click', openSheet);
    if (team) team.addEventListener('click', openSheet);
    if (dismiss) dismiss.addEventListener('click', closeSheet);
    if (bg) bg.addEventListener('click', closeSheet);
    if (install) {
      install.addEventListener('click', function () {
        if (!deferred) return;
        var promptEvent = deferred;
        deferred = null;
        promptEvent.prompt();
        Promise.resolve(promptEvent.userChoice).then(function (choice) {
          if (choice && choice.outcome === 'accepted') installed = true;
          paint();
        }).catch(function () { paint(); });
      });
    }
    paint();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var sheet = document.getElementById('pwa-sheet');
    if (sheet && !sheet.hidden) closeSheet();
  });
})();
