/* script.js
   Handles:
   - decoding guestlist.json.b64 (Base64)
   - looking up unique code from URL (?code=XYZ)
   - pre-loading and enforcing RSVP constraints
   - client-side validation before submit
*/
const RSVP = (function(){
  // Helper: get query param
  function getQueryParam(name){
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Helper: fetch base64 file and decode into JSON
  async function fetchGuestList(path='guestlist.json.b64'){
    const resp = await fetch(path, {cache: "no-store"});
    if(!resp.ok) throw new Error('Failed to fetch guest list');
    const b64 = (await resp.text()).trim();
    // atob handles base64 -> binary string; then decode JSON
    // We assume b64 encodes UTF-8 JSON without any additional prefix
    try {
      const jsonStr = atob(b64);
      return JSON.parse(jsonStr);
    } catch(err){
      // try decode via percent encoding in case non-latin data
      try{
        // fallback for utf-8 sequences
        const bin = atob(b64);
        let bytes = new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
        const decoded = new TextDecoder('utf-8').decode(bytes);
        return JSON.parse(decoded);
      } catch(e){
        throw new Error('Failed to decode guestlist file');
      }
    }
  }

  // UI helpers
  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }

  // Main init; config object allows selecting DOM ids
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

    if(!form || !loading || !notFound) {
      console.warn('RSVP:init missing selectors');
      return;
    }

    const code = getQueryParam('code');
    if(!code) {
      loading.textContent = 'No code provided in URL. Please use the personalized link.';
      show(notFound);
      hide(loading);
      return;
    }

    try{
      const guestList = await fetchGuestList(cfg.guestlistPath);
      // Find code - case sensitive matching
      const entry = guestList.find(g => g.UniqueCode === code);
      hide(loading);

      if(!entry){
        show(notFound);
        return;
      }

      // We have a valid entry - show the form
      show(form);
      // Fill hidden fields
      codeHidden.value = entry.UniqueCode;
      groupHidden.value = entry.GuestGroupName;

      // Show personalized welcome
      welcome.textContent = `Welcome, ${entry.GuestGroupName}!`;

      // Enforce maximum guests
      const max = parseInt(entry.MaxAllowedGuests || 1, 10);
      guestCountInput.setAttribute('min','0');
      guestCountInput.value = Math.min(guestCountInput.value || 1, max);
      guestCountInput.setAttribute('max', String(max));
      // store max for validation convenience
      guestCountInput.dataset.maxGuests = String(max);

      // Add event listeners
      guestCountInput.addEventListener('input', () => {
        const val = parseInt(guestCountInput.value || 0, 10);
        if(val > max){
          formMsg.textContent = `The maximum allowed for this invitation is ${max}.`;
        } else {
          formMsg.textContent = '';
        }
      });

      // Validate on submit (client-side)
      form.addEventListener('submit', (ev) => {
        // basic checks:
        const guestCount = parseInt(guestCountInput.value || 0, 10);
        const attendCeremony = document.getElementById('attendCeremony').checked;
        const attendReception = document.getElementById('attendReception').checked;

        if(isNaN(guestCount) || guestCount < 0){
          ev.preventDefault();
          formMsg.textContent = 'Please enter a valid number of guests.';
          return;
        }
        if(guestCount > max){
          ev.preventDefault();
          formMsg.textContent = `You cannot RSVP more than ${max} guests for this invitation.`;
          return;
        }
        // If guestCount > 0 ensure at least one event selected
        if(guestCount > 0 && !(attendCeremony || attendReception)){
          ev.preventDefault();
          formMsg.textContent = 'If someone is attending, please check Ceremony and/or Reception.';
          return;
        }

        // Add a small UX touch: disable submit while request is in progress.
        const submitBtn = form.querySelector('button[type="submit"]');
        if(submitBtn){
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
        }
        // Let the form submit naturally to the 3rd-party endpoint (Formspree etc).
        // Optionally, you could intercept and send via fetch to the service API.
      });

      // Cancel - return visitor to home
      cancelBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });

    } catch(err){
      hide(loading);
      console.error(err);
      notFound.querySelector('p').textContent = 'There was an error loading your invitation. Please try again later or contact the couple.';
      show(notFound);
    }
  }

  return { init, _fetchGuestList: fetchGuestList, _getQuery: getQueryParam };
})();
