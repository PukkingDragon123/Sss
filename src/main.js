// main.js — boot the game once the DOM is ready.
import { Game } from './game.js';

function boot() {
  try {
    window.game = new Game();
  } catch (err) {
    console.error(err);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.remove('hidden');
      loading.innerHTML = `<div class="loading-text" style="max-width:600px">Couldn\'t summon the tavern.<br><br>
        ${err && err.message ? err.message : err}<br><br>
        <span style="font-size:14px">This game needs WebGL and an internet connection (it loads three.js from a CDN).
        Try a modern browser, and make sure you\'re serving the folder over http:// (see README).</span></div>`;
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
