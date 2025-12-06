/* script.js - corrected for lookup + reload flow */

const RSVP = (function () {

  function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  async function fetchGuestList(path = 'guestlist.json.b64') {
    const resp = await fetch(path, { cache: "no-store" });
    if (!resp.ok) throw new Error('Failed to fetch guest list');

    const b64 = (await resp.text()).trim();
    const jsonStr = atob(b64);
    return JSON.parse(jsonStr);
  }

  function show(el) {
    if (el) el.classList.remove('hidden');
  }

  function hide(el) {
    if (el) el.classList.add('hidden');
  }

  async function init(cfg = {}) {

    const form = document.querySelector(cfg.formSelector);
    const loading = document.querySelector(cfg.loadingSelector);
    const notFound = document.querySelector(cfg.notFoundSelector);
    const lookup = document.querySelector('#lookup');

    const codeHidden = document.querySelector(cfg.codeFieldSelector);
    const groupHidden = document.querySelector(cfg.groupFieldSelector);
    const welcome = document.querySelector(cfg.welcomeSelector);
    const guestCountInput = document.querySelector(cfg.guestCountSelector);
    const formMsg = document.querySelector('#form-msg');
    const cancelBtn = document.querySelector('#cancelBtn');

    const code = getQueryParam('code');

    // Default state
    show(lookup);
    hide(form);
    hide(notFound);

    if (!code) {
      hide(loading);
      return;
    }

    try {
      const guestList = await fetchGuestList();
      const entry = guestList.find(g => g.UniqueCode === code);

      hide(loading);

      if (!entry) {
        hide(lookup);
        show(notFound);
        return;
      }

      // Valid code
      hide(lookup);
      show(form);

      codeHidden.value = entry.UniqueCode;
      groupHidden.value = entry.GuestGroupName;

      welcome.textContent = `Welcome, ${entry.GuestGroupName}!`;

      const max = parseInt(entry.MaxAllowedGuests || 1, 10);
      guestCountInput.min = 0;
      guestCountInput.max = max;
      guestCountInput.value = 1;
      guestCountInput.dataset.maxGuests = max;

      guestCountInput.addEventListener('input', () => {
        const val = parseInt(guestCountInput.value || 0, 10);
        if (val > max) {
          formMsg.textContent = `Maximum allowed is ${max} guests.`;
        } else {
          formMsg.textContent = '';
        }
      });

      form.addEventListener('submit', (ev) => {
        const guestCount = parseInt(guestCountInput.value || 0, 10);
        const attendCeremony = document.getElementById('attendCeremony').checked;
        const attendReception = document.getElementById('attendReception').checked;

        if (guestCount > max) {
          ev.preventDefault();
          formMsg.textContent = `You can only RSVP up to ${max} guests.`;
          return;
        }

        if (guestCount > 0 && !(attendCeremony || attendReception)) {
          ev.preventDefault();
          formMsg.textContent = 'Please select at least one event.';
          return;
        }
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          window.location.href = 'index.html';
        });
      }

    } catch (err) {
      console.error(err);
      hide(loading);
      show(notFound);
    }
  }

  return { init };
})();
