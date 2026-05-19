// DataBook Viewer — popup.js
// Queries the content script in the active tab and reflects current viewer state.

(async () => {
  const viewActive = document.getElementById('view-active');
  const viewIdle   = document.getElementById('view-idle');
  const docTitle   = document.getElementById('doc-title');
  const docMeta    = document.getElementById('doc-meta');
  const indFm      = document.getElementById('ind-fm');
  const indHidden  = document.getElementById('ind-hidden');

  // Query the active tab
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    viewIdle.style.display = 'block';
    return;
  }

  // Try to ping the content script
  let status = null;
  try {
    status = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
  } catch {
    // Content script not active on this page
  }

  if (!status || !status.isDataBook) {
    viewIdle.style.display  = 'block';
    viewActive.style.display = 'none';
    return;
  }

  // Show active state
  viewIdle.style.display   = 'none';
  viewActive.style.display = 'block';

  // Populate doc info
  docTitle.textContent = status.title || 'Untitled DataBook';
  const parts = [];
  if (status.docType)  parts.push(status.docType);
  if (status.version)  parts.push('v' + status.version);
  docMeta.textContent = parts.join(' · ');

  // Read current toggle state from the tab's localStorage via scripting
  let showFm     = true;
  let showHidden = false;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        showFm:     localStorage.getItem('dbv:showFm')     !== 'false',
        showHidden: localStorage.getItem('dbv:showHidden') === 'true',
      }),
    });
    if (results && results[0] && results[0].result) {
      showFm     = results[0].result.showFm;
      showHidden = results[0].result.showHidden;
    }
  } catch { /* scripting permission not available — use defaults */ }

  function updateIndicators() {
    indFm.classList.toggle('on',     showFm);
    indHidden.classList.toggle('on', showHidden);
  }

  updateIndicators();

  // Toggle actions via injected script
  async function toggleInPage(key, value) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (k, v) => {
          // Simulate a keyboard event for the in-page toggle
          const evt = new KeyboardEvent('keydown', { key: k, bubbles: true });
          document.dispatchEvent(evt);
        },
        args: [key, value],
      });
    } catch {
      // Fallback: no scripting permission
    }
  }

  indFm.addEventListener('click', async () => {
    showFm = !showFm;
    updateIndicators();
    await toggleInPage('f');
  });

  indHidden.addEventListener('click', async () => {
    showHidden = !showHidden;
    updateIndicators();
    await toggleInPage('h');
  });

})();
