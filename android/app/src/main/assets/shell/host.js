// Lifecycle and Back adaptation stays in the wrapper, outside the web project.
(() => {
  'use strict';

  const playing = () => typeof gameMode !== 'undefined'
    && typeof mainGame !== 'undefined' && gameMode === mainGame;
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true
  }));

  // The app is always fullscreen, so the main menu offers Exit in its place
  // and the pause menu drops the button, closing the gap it leaves.
  const baseControls = uiControls;
  const baseActivate = uiActivate;
  uiControls = () => {
    const buttons = baseControls();
    const index = buttons.findIndex(b => b.id === 'fullscreen');
    if (index < 0) return buttons;
    const modal = uiModal();
    if (modal === 'welcome') Object.assign(buttons[index], {id: 'exit', label: 'Exit'});
    else if (modal === 'pause') {
      const [removed] = buttons.splice(index, 1);
      const next = buttons[index];
      const step = next ? next.y - removed.y : 0;
      for (const button of buttons.slice(index)) button.y -= step;
    }
    return buttons;
  };
  uiActivate = button => {
    // MainActivity intercepts this navigation and finishes.
    if (button.id === 'exit') location.href = 'https://appassets.androidplatform.net/exit';
    else baseActivate(button);
  };
  // The menu may already be drawn with the original buttons; force a redraw.
  uiDrawSignature = '';

  window.sltdHost = {
    pause() {
      window.dispatchEvent(new Event('blur'));
      if (playing()) {
        paused = true;
        if (uiOverlay !== 'guide') uiOverlay = 'pause';
        cancelUIInput();
      }
    },
    back() {
      if (typeof uiOverlay !== 'undefined' && uiOverlay === 'maps') {
        uiActivate({id: 'map-back'});
        return 'handled';
      }
      if (typeof uiOverlay !== 'undefined' && uiOverlay === 'guide') {
        escape();
        return 'handled';
      }
      if (!playing()) return 'exit';
      if (!paused || (!uiOverlay && (selectedTower || selectedBuild))) {
        escape();
        return 'handled';
      }
      if (!uiOverlay) {
        this.pause();
        return 'handled';
      }
      this.pause();
      return 'confirm';
    }
  };
})();
