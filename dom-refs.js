export const initializeDomRefs = () => {
  return {
    grid: document.querySelector('.grid'),
    containers: document.querySelectorAll('.container'),
    noteList: document.getElementById('notes-list'),
    renoteList: document.getElementById('renotes-list'),
    mediaList: document.getElementById('media-list'),
    rnMediaList: document.getElementById('rn-media-list'),
    notelatestBtn: document.getElementById('note-latest'),
    renotelatestBtn: document.getElementById('renote-latest'),
    mediumlatestBtn: document.getElementById('medium-latest'),
    rnMediumlatestBtn: document.getElementById('rn-medium-latest'),
    resizeHandle: document.querySelector('.resize-handle'),
    menuBtn: document.getElementById('menu-btn'),
    configFrame: document.querySelector('.config'),
    selectDisplay: document.getElementById('select-display'),
    sdValue: document.getElementById('select-display-value'),
    selectTimeline: document.getElementById('select-timeline'),
    misskeyLink: document.querySelector('.misskey-link'),
    hostTextWraps: document.querySelectorAll('.host'),
    customHostForm: document.forms['custom-host'],
    customHost: document.getElementById('custom-host'),
    resetHostBtn: document.getElementById('reset-host'),
    keepEmojis: document.getElementById('keep-emojis'),
    authenticateLabel: document.querySelector('[for="authenticate"]'),
    authenticateBtn: document.getElementById('authenticate'),
    body: document.body
  };
};
