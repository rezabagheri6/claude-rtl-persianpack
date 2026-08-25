const toggle = document.getElementById('toggle');
const note = document.getElementById('note');

function activeTab() {
  return chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => tabs[0]);
}

function disable(message) {
  toggle.checked = false;
  toggle.disabled = true;
  note.textContent = message;
}

activeTab()
  .then((tab) => chrome.tabs.sendMessage(tab.id, { type: 'claude-rtl:get' }))
  .then((res) => {
    toggle.checked = !!(res && res.enabled);
  })
  .catch(() => disable('این تب claude.ai نیست. تب کلاد را باز کنید.'));

toggle.addEventListener('change', () => {
  activeTab()
    .then((tab) =>
      chrome.tabs.sendMessage(tab.id, {
        type: 'claude-rtl:set',
        value: toggle.checked,
      })
    )
    .catch(() => disable('ارتباط با صفحه برقرار نشد. صفحه را رفرش کنید.'));
});
