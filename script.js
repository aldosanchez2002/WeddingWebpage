/* script.js
   Handles:
   - decoding guestlist.json.b64 (Base64)
   - looking up unique code from URL (?code=XYZ)
   - pre-loading and enforcing RSVP constraints
   - sending RSVP data to Google Sheets (Apps Script)
*/

const RSVP = (function () {

  // ===== CONFIG =====
  const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwCmS-12Ba1242022ahM5Rl9hUgVSKXlpdLPUqead2E0BmOm02EMKYb1HikZrsEH1RA/exec";

  // Helper: get query param
  function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Helper: fetch base64 file and decode into JSON
  async function fetchGuestList(path = 'guestlist.json.b64') {
    const resp = await fetch(path, { cache: "no-store" });
    if (!resp.ok) throw new Error('Failed to fetch guest list');
    const b64 = (await resp.text()).trim();

    try {
      const jsonStr = atob(b64);
      return JSON.parse(jsonStr);
    } catch (err) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let byteIndex = 0; byteIndex < bin.length; byteIndex++) bytes[byteIndex] = bin.charCodeAt(byteIndex);
      const decoded = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(decoded);
    }
  }

  // UI helpers
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  // Main init
  async function init(cfg = {}) {

    const cfgDefaults = {
      formSelector: '#rsvp-form',
      loadingSelector: '#loading',
      notFoundSelector: '#not-found',
      codeFieldSelector: '#field-code',
      groupFieldSelector: '#field-group',
      welcomeSelector: '#welcome',
      guestCountSelector: '#guestCount',
      guestlistPath: 'guestlist.json.b64'
    };
    cfg = Object.assign({}, cfgDefaults, cfg);

    const form = document.querySelector(cfg.formSelector);
    const loading = document.querySelector(cfg.loadingSelector);
    const notFound = document.querySelector(cfg.notFoundSelector);
    const codeHidden = document.querySelector(cfg.codeFieldSelector);
    const groupHidden = document.querySelector(cfg.groupFieldSelector);
    const welcome = document.querySelector(cfg.welcomeSelector);
    const guestCountInput = document.querySelector(cfg.guestCountSelector);
    const formMsg = document.querySelector('#form-msg');
    const cancelBtn = document.querySelector('#cancelBtn');

    if (!form || !loading) {
      console.warn('RSVP:init missing required elements');
      return;
    }

    const code = getQueryParam('code');

    if (!code) {
      // If no code is present, we are already showing the #lookup form
      // due to the HTML change, so we just exit the function.
      return;
    }

    hide(document.getElementById('lookup'));
    show(loading);

    try {
      const guestList = await fetchGuestList(cfg.guestlistPath);

      // ✅ Case-insensitive code matching
      const entry = guestList.find(g =>
        String(g.UniqueCode).toLowerCase() === String(code).toLowerCase()
      );

      hide(loading);

      if (!entry) {
        if (notFound) {
          show(notFound);
        } else {
          loading.textContent = "Invitation code not found.";
          show(loading);
        }
        return;
      }

      // Show RSVP form
      show(form);

      // Fill hidden fields
      codeHidden.value = entry.UniqueCode;
      groupHidden.value = entry.GroupName;

      // Welcome text
      welcome.textContent = `Welcome, ${entry.GroupName}!`;

      // Ceremony invitation
      const ceremonyFieldset = document.getElementById('ceremony-fieldset');
      const isInvitedToCeremony = entry.InvitedToCeremony === true;

      if (!isInvitedToCeremony) {
        hide(ceremonyFieldset);
        document.getElementById('attendCeremony').checked = false;
      }
      // Guest limit
      const max = parseInt(entry.MaxAllowedGuests || 1, 10);
      guestCountInput.setAttribute('min', '0');
      guestCountInput.setAttribute('max', String(max));
      guestCountInput.value = Math.min(1, max);
      guestCountInput.dataset.maxGuests = String(max);

      // Guest count validation
      guestCountInput.addEventListener('input', () => {
        const val = parseInt(guestCountInput.value || 0, 10);
        if (val > max) {
          formMsg.textContent = `Maximum allowed is ${max} guests.`;
        } else {
          formMsg.textContent = '';
        }
      });

      // Cancel button
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          window.location.href = 'index.html';
        });
      }

      // ✅ Submit to Google Sheets
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();

        const guestCount = parseInt(guestCountInput.value || 0, 10);
        const ceremonyEl = document.getElementById('attendCeremony');
        const attendCeremony = ceremonyEl.checked;
        const receptionEl = document.getElementById('attendReception');
        const attendReception = receptionEl.checked;

        if (guestCount < 0 || guestCount > max) {
          formMsg.textContent = `Guest count must be between 0 and ${max}.`;
          return;
        }

        if (guestCount > 0 && !(attendCeremony || attendReception)) {
          formMsg.textContent = 'Please select at least one event.';
          return;
        }

        const vegetarianSelector = 'input[name="Vegetarian"]:checked';
        const vegetarianInput = document.querySelector(vegetarianSelector);
        if (!vegetarianInput) {
          formMsg.textContent = 'Please select a vegetarian preference.';
          return;
        }
        const payload = {
          UniqueCode: codeHidden.value,
          GroupName: groupHidden.value,
          AttendCeremony: attendCeremony ? "Yes" : "No",
          AttendReception: attendReception ? "Yes" : "No",
          GuestCount: guestCountInput.value,
          Vegetarian: vegetarianInput.value,
          Notes: document.getElementById('notes').value
        };

        try {
          const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload),
            redirect: "follow",
            headers: {
              "Content-Type": "text/plain;charset=utf-8"
            }
          });

          if (res.ok) {
            formMsg.textContent = "✅ Thank you! Your RSVP has been recorded.";
            form.reset();
          } else {
            formMsg.textContent = "❌ Submission failed. Try again.";
          }
        } catch (err) {
          console.error(err);
          formMsg.textContent = "❌ Network error. Try again later.";
        }
      });

      notFound.textContent = "Error loading invitation data.";
      console.error(err);
      hide(loading);
      if (notFound) {
        notFound.innerHTML = "<p>Error loading invitation data.</p>";
        show(notFound);
      }
    }
  }

  return { init };
})();
