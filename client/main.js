import { initLocalMode } from './mode-local.js';
import { initOnlineMode, setConnectionLabel } from './mode-online.js';

const screens = {
  home: document.getElementById('screen-home'),
  local: document.getElementById('screen-local'),
  online: document.getElementById('screen-online'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

document.getElementById('btn-go-local').addEventListener('click', () => {
  showScreen('local');
});

document.getElementById('btn-go-online').addEventListener('click', () => {
  showScreen('online');
});

document.getElementById('btn-back-home-from-local').addEventListener('click', () => {
  showScreen('home');
});

document.getElementById('btn-back-home-from-online').addEventListener('click', () => {
  showScreen('home');
});

initLocalMode();
initOnlineMode();
setConnectionLabel(document.getElementById('online-connection-label'));
