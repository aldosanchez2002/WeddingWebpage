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
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
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
      loading.textContent = 'Please enter your invitation code.';
      hide(loading);
      show(document.getElementById('lookup'));
      return;
    }

    hide(document.getElementById('lookup'));

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
      const ceremonyYes = document.getElementById('attendCeremonyYes');
      const ceremonyNo = document.getElementById('attendCeremonyNo');
      const isInvitedToCeremony = entry.InvitedToCeremony === true;

      if (!isInvitedToCeremony) {
        // Hide and lock ceremony RSVP if not invited
        hide(ceremonyFieldset);
        if (ceremonyYes) ceremonyYes.disabled = true;
        if (ceremonyNo) {
          ceremonyNo.checked = true;
          ceremonyNo.disabled = true;
        }
      }
      // Guest limit
      const max = parseInt(entry.MaxAllowedGuests || 1, 10);
      const initialGuests = Math.min(max, Math.max(0, 1));
      guestCountInput.setAttribute('min', '0');
      guestCountInput.setAttribute('max', String(max));
      guestCountInput.value = initialGuests;
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
        const ceremonyChoice = document.querySelector('input[name="AttendCeremony"]:checked');
        const receptionChoice = document.querySelector('input[name="AttendReception"]:checked');
        const attendCeremony = ceremonyChoice ? ceremonyChoice.value === "Yes" : false;
        const attendReception = receptionChoice ? receptionChoice.value === "Yes" : false;
        const vegetarianInput = document.querySelector('input[name="Vegetarian"]:checked');

        if (guestCount < 0 || guestCount > max) {
          formMsg.textContent = `Guest count must be between 0 and ${max}.`;
          return;
        }

        if (guestCount > 0 && !(attendCeremony || attendReception)) {
          formMsg.textContent = 'Please select at least one event.';
          return;
        }

        const payload = {
          UniqueCode: codeHidden.value,
          GroupName: groupHidden.value,
          AttendCeremony: attendCeremony ? "Yes" : "No",
          AttendReception: attendReception ? "Yes" : "No",
          GuestCount: guestCountInput.value,
          Vegetarian: vegetarianInput ? vegetarianInput.value : "No",
          Notes: document.getElementById('notes').value
        };

        formMsg.textContent = "Submitting...";

        try {
          const res = await fetch(
            "https://script.google.com/macros/s/AKfycbwCmS-12Ba1242022ahM5Rl9hUgVSKXlpdLPUqead2E0BmOm02EMKYb1HikZrsEH1RA/exec",
            {
              method: "POST",
              body: JSON.stringify(payload),
              redirect: "follow",
              headers: {
                "Content-Type": "text/plain;charset=utf-8"
              }
            }
          );

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

    } catch (err) {
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

// Initialize RSVP after DOM is ready to avoid race conditions
document.addEventListener('DOMContentLoaded', () => {
  RSVP.init({
    formSelector: '#rsvp-form',
    loadingSelector: '#loading',
    notFoundSelector: '#not-found',
    codeFieldSelector: '#field-code',
    groupFieldSelector: '#field-group',
    welcomeSelector: '#welcome',
    guestCountSelector: '#guestCount'
  });
});
