import './style.scss';
import { Stream as misskeyStream, api as misskeyApi } from 'misskey-js';
import MagicGrid from 'magic-grid';
import { scrollToBottom, goMiAuth, routing, normalizeHostInput } from './utils';
import { createEmojiStore } from './emoji-store';
import { createNoteRenderer } from './note-renderer';
import { createAuthManager } from './auth';
import { initializeDomRefs } from './dom-refs';
import { createAppState } from './state';

const authManager = createAuthManager();
await routing(authManager.processCallback);

const domRefs = initializeDomRefs();
const {
  grid,
  containers,
  noteList,
  renoteList,
  mediaList,
  rnMediaList,
  notelatestBtn,
  renotelatestBtn,
  mediumlatestBtn,
  rnMediumlatestBtn,
  resizeHandle,
  menuBtn,
  configFrame,
  selectDisplay,
  sdValue,
  selectTimeline,
  misskeyLink,
  hostTextWraps,
  customHostForm,
  customHost,
  resetHostBtn,
  keepEmojis,
  authenticateLabel,
  authenticateBtn,
  body,
} = domRefs;

const mediaContainers = [...containers].filter((container) =>
  ['media', 'rn-media'].some((className) => container.classList.contains(className))
);
const mlLink = misskeyLink.querySelector('a');
const defaultHostText = hostTextWraps[0].textContent;
const defaultTitle = document.title;

const mediaMG = new MagicGrid({
  container: mediaList,
  items: 1,
  gutter: 20,
  animate: true,
});
const rnMediaMG = new MagicGrid({
  container: rnMediaList,
  items: 1,
  gutter: 20,
  animate: true,
});
mediaMG.listen();
rnMediaMG.listen();

const appState = createAppState();
const { ioOrigin, originToHost } = appState;
appState.initOrigin(domRefs, defaultHostText, defaultTitle);
let { currentOrigin, host, timelineIndex } = appState.state;

let authInfo = authManager.checkToken(host);
appState.initAuth(authInfo, domRefs);
timelineIndex = appState.state.timelineIndex;
const loadTimeline = async (origin) => {
  const emojiStore = createEmojiStore(origin);
  await emojiStore.initEmojis();
  const renderer = createNoteRenderer({ origin, emojiStore });
  const stream = new misskeyStream(origin, authInfo ? { token: authInfo.token } : null);
  const channelNames = ['homeTimeline', 'localTimeline', 'hybridTimeline', 'globalTimeline'];
  const hTimeline = stream.useChannel(channelNames[timelineIndex]);
  // const stream = new misskeyStream(origin, {token: ''});
  // const hTimeline = stream.useChannel('homeTimeline');
  const roles = ['notes', 'renotes', 'media', 'rn-media'];
  const roleToTypePair = {
    notes: 'note',
    renotes: 'renote',
    media: 'medium',
    'rn-media': 'rnMedium',
  };
  const autoShowNew = {
    note: true,
    renote: true,
    medium: true,
    rnMedium: true,
  };
  const beforeAutoShowNew = {
    note: false,
    renote: false,
    medium: false,
    rnMedium: false,
  };
  const stored = {
    notes: [],
    renotes: [],
    media: [],
    rnMedia: [],
  };
  const noteLimit = 150;
  const displayModes = [
    {
      name: 'all',
      label: '全て',
    },
    {
      name: 'hide-sensitive',
      label: 'NSFW除外',
    },
    {
      name: 'sensitive-only',
      label: 'NSFWのみ',
    },
  ];
  const controller = new AbortController();
  let wakeLock = null;

  const overflowJudgment = () => {
    const textWraps = document.querySelectorAll('li .wrap');
    textWraps.forEach((wrap) => {
      const text = wrap.querySelector('.text');
      if (wrap.classList.contains('is-open') || wrap.offsetWidth < wrap.scrollWidth || text.querySelector('br')) {
        text.classList.add('is-long');
      } else {
        text.classList.remove('is-long');
      }
    });
    const texts = document.querySelectorAll('li > div.text');
    texts.forEach((text) => {
      if (text.classList.contains('is-open') || text.offsetWidth < text.scrollWidth || text.querySelector('br')) {
        text.classList.add('is-long');
      } else {
        text.classList.remove('is-long');
      }
    });
  };

  window.addEventListener('resize', overflowJudgment, {
    signal: controller.signal,
  });

  let selecting = false;
  document.addEventListener(
    'selectstart',
    () => {
      document.addEventListener(
        'pointerup',
        () => {
          selecting = !window.getSelection().isCollapsed;
        },
        { once: true, signal: controller.signal }
      );
    },
    { signal: controller.signal }
  );

  const textToggleHandler = (e) => {
    if (selecting) {
      selecting = false;
      return;
    }
    if (e.target.closest('.is-long') || (e.target.closest('.wrap') && e.target.querySelector('.is-long'))) {
      e.target.closest('.wrap').classList.toggle('is-open');
      if (e.target.closest('.wrap').classList.contains('is-open')) {
        if (e.currentTarget === noteList) {
          beforeAutoShowNew.note = autoShowNew.note;
          autoShowNew.note = false;
          notelatestBtn.classList.add('show');
        } else if (e.currentTarget === renoteList) {
          beforeAutoShowNew.renote = autoShowNew.renote;
          autoShowNew.renote = false;
          renotelatestBtn.classList.add('show');
        }
      } else {
        if (e.currentTarget === noteList) {
          if (beforeAutoShowNew.note) {
            notelatestBtn.click();
          }
        } else if (e.currentTarget === renoteList) {
          if (beforeAutoShowNew.renote) {
            renotelatestBtn.click();
          }
        }
      }
    }
  };

  noteList.addEventListener('click', textToggleHandler, {
    signal: controller.signal,
  });
  renoteList.addEventListener('click', textToggleHandler, {
    signal: controller.signal,
  });

  const mediaTextToggleHandler = (e) => {
    if (selecting) {
      selecting = false;
      return;
    }
    if (e.target.closest('.is-long')) {
      e.target.closest('.is-long').classList.toggle('is-open');
      if (e.currentTarget === mediaList) {
        mediaMG.positionItems();
      } else if (e.currentTarget === rnMediaList) {
        rnMediaMG.positionItems();
      }
      if (e.target.closest('.is-long').classList.contains('is-open')) {
        if (e.currentTarget === mediaList) {
          beforeAutoShowNew.medium = autoShowNew.medium;
          autoShowNew.medium = false;
          mediumlatestBtn.classList.add('show');
        } else if (e.currentTarget === rnMediaList) {
          beforeAutoShowNew.rnMedium = autoShowNew.rnMedium;
          autoShowNew.rnMedium = false;
          rnMediumlatestBtn.classList.add('show');
        }
      } else {
        if (e.currentTarget === mediaList) {
          if (beforeAutoShowNew.medium) {
            mediumlatestBtn.click();
          }
        } else if (e.currentTarget === rnMediaList) {
          if (beforeAutoShowNew.rnMedium) {
            rnMediumlatestBtn.click();
          }
        }
      }
    }
  };

  mediaList.addEventListener('click', mediaTextToggleHandler, {
    signal: controller.signal,
  });
  rnMediaList.addEventListener('click', mediaTextToggleHandler, {
    signal: controller.signal,
  });

  const listElems = [noteList, renoteList, mediaList, rnMediaList];
  const appendToTimeline = async (targetList, noteOrNotes) => {
    if (!listElems.includes(targetList)) {
      return false;
    }
    const notes = Array.isArray(noteOrNotes) ? noteOrNotes : [noteOrNotes];
    let html = '';

    if ([noteList, renoteList].includes(targetList)) {
      const target = targetList === noteList ? 'note' : 'renote';
      while (notes.length) {
        html += await renderer.makeHTMLFromNote(notes.shift(), target);
      }
      targetList.insertAdjacentHTML('beforeend', html);
      if (autoShowNew[target]) {
        scrollToBottom(targetList.parentElement);
      }
      while (targetList.querySelectorAll('li').length > noteLimit) {
        targetList.firstElementChild.remove();
      }
    } else if ([mediaList, rnMediaList].includes(targetList)) {
      const target = targetList === mediaList ? 'note' : 'renote';
      const notesLengthCache = notes.length;
      while (notes.length) {
        const note = notes.pop();
        if (target === 'renote') {
          const alreadyRN = rnMediaList.querySelector(`[data-rn-id="${note.renoteId}"]`);
          alreadyRN && alreadyRN.remove();
        }
        html += await renderer.makeHTMLFromNoteForMedia(note, target);
      }
      targetList.insertAdjacentHTML('afterbegin', html);
      if (autoShowNew[targetList === mediaList ? 'medium' : 'rnMedium']) {
        targetList.parentElement.scrollTo({ top: 0 });
      }
      while (targetList.querySelectorAll('li').length > noteLimit) {
        targetList.lastElementChild.remove();
      }
      const appendedItems = [...targetList.children].slice(0, notesLengthCache);
      const someAppendedItemsAreDisplayed = appendedItems.some((elem) => getComputedStyle(elem).display !== 'none');
      if (someAppendedItemsAreDisplayed) {
        if (targetList === mediaList) {
          mediaMG.positionItems();
        } else if (targetList === rnMediaList) {
          rnMediaMG.positionItems();
        }
      }
      const videoThumbnailImgs = appendedItems
        .map((elem) => elem.querySelector('img'))
        .filter((img) => img && img.style.width === '' && img.src !== '');
      videoThumbnailImgs.forEach((img) => {
        img.addEventListener(
          'load',
          () => {
            if (targetList === mediaList) {
              mediaMG.positionItems();
            } else if (targetList === rnMediaList) {
              rnMediaMG.positionItems();
            }
          },
          { once: true }
        );
      });
    }
    overflowJudgment();
  };

  stream.on('_connected_', async () => {
    console.log('connected');
    if (document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  });

  stream.on('_disconnected_', () => {
    console.log('disconnected');
    wakeLock !== null &&
      wakeLock.release().then(() => {
        wakeLock = null;
      });
  });

  document.addEventListener(
    'visibilitychange',
    async () => {
      if (wakeLock !== null && document.visibilityState === 'visible' && stream.state == 'connected') {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    },
    { signal: controller.signal }
  );

  const parseNote = async (note) => {
    // console.log(note);
    const isRenote = Boolean(note.renoteId);
    const isNoteOrQuote = Boolean(note.text !== null || note.fileIds.length || !isRenote);
    const host = note.user.host;
    if (host) {
      emojiStore.storeExternalEmojisFromNote(note);
      // console.log(note);
    }
    if (isNoteOrQuote) {
      if (autoShowNew.note) {
        await appendToTimeline(noteList, note); //RN以外
      } else {
        stored.notes.push(note); //RN以外
        // console.log('note pushed, stored notes count:',stored.notes.length);
        if (stored.notes.length > noteLimit) {
          stored.notes = stored.notes.slice(-noteLimit);
        }
      }
    }
    if (isRenote) {
      const renote = note.renote;
      const host = renote.user.host;
      if (host) {
        emojiStore.storeExternalEmojisFromNote(renote);
        // console.log(renote);
      }
      if (autoShowNew.renote) {
        await appendToTimeline(renoteList, note); //RN
      } else {
        stored.renotes.push(note); //RN
        // console.log('renote pushed, stored renotes count:',stored.renotes.length);
        if (stored.renotes.length > noteLimit) {
          stored.renotes = stored.renotes.slice(-noteLimit);
        }
      }
    }
    if (note.fileIds.length) {
      if (autoShowNew.medium) {
        await appendToTimeline(mediaList, note);
      } else {
        stored.media.push(note);
        // console.log('media pushed, stored media count:',stored.media.length);
        if (stored.media.length > noteLimit) {
          stored.media = stored.media.slice(-noteLimit);
        }
      }
    }
    if (isRenote && note.renote.fileIds.length) {
      if (autoShowNew.rnMedium) {
        await appendToTimeline(rnMediaList, note);
      } else {
        const deleteIndex = stored.rnMedia.findIndex((storedNote) => storedNote.renoteId === note.renoteId);
        if (deleteIndex !== -1) {
          stored.rnMedia.splice(deleteIndex, 1);
        }
        stored.rnMedia.push(note);
        // console.log('rnMedia pushed, stored rnMedia count:',stored.rnMedia.length);
        if (stored.rnMedia.length > noteLimit) {
          stored.rnMedia = stored.rnMedia.slice(-noteLimit);
        }
      }
    }
  };

  const apiTimelineEndpoints = ['timeline', 'local-timeline', 'hybrid-timeline', 'global-timeline'];
  const cli = new misskeyApi.APIClient({
    origin: origin,
    ...(authInfo && { credential: authInfo.token }),
  });
  await cli
    .request(`notes/${apiTimelineEndpoints[timelineIndex]}`, { limit: 15 })
    .then(async (notes) => {
      notes = notes.reverse();
      let p = Promise.resolve();
      notes.forEach((note) => (p = p.then(() => parseNote(note))));
      await p;
    })
    .catch((e) => {
      console.log(`${host}\'s`, `notes/${apiTimelineEndpoints[timelineIndex]}`, 'could not load');
      console.dir(e);
    });
  // console.log(noteList.children.length + renoteList.children.length);

  hTimeline.on('note', parseNote);

  const latestBtnHandler = async (e) => {
    const latestBtn = e.target;
    latestBtn.textContent = '読み込み中...';
    if (latestBtn === notelatestBtn) {
      autoShowNew.note = true;
      await appendToTimeline(noteList, stored.notes); //RN以外
    } else if (latestBtn === renotelatestBtn) {
      autoShowNew.renote = true;
      await appendToTimeline(renoteList, stored.renotes); //RN
    } else if (latestBtn === mediumlatestBtn) {
      autoShowNew.medium = true;
      await appendToTimeline(mediaList, stored.media); //Media
    } else if (latestBtn === rnMediumlatestBtn) {
      autoShowNew.rnMedium = true;
      await appendToTimeline(rnMediaList, stored.rnMedia); //RNMedia
    }
    latestBtn.classList.remove('show');
    latestBtn.textContent = '新しいノートを見る';
  };

  notelatestBtn.addEventListener('click', latestBtnHandler, {
    signal: controller.signal,
  });
  renotelatestBtn.addEventListener('click', latestBtnHandler, {
    signal: controller.signal,
  });
  mediumlatestBtn.addEventListener('click', latestBtnHandler, {
    signal: controller.signal,
  });
  rnMediumlatestBtn.addEventListener('click', latestBtnHandler, {
    signal: controller.signal,
  });

  containers.forEach((container) => {
    const latestBtn = container.querySelector('button[id$="-latest"]');
    const role = roles.find((role) => container.classList.contains(role));
    const type = roleToTypePair[role];
    container.addEventListener(
      'scroll',
      async (e) => {
        // console.log('scrolled: '+ containerRole);
        if (role.includes('notes')) {
          if (container.scrollHeight - container.clientHeight - container.scrollTop >= 3) {
            autoShowNew[type] = false;
            latestBtn.classList.add('show');
          } else {
            if (stored[role].length) {
              if (role === 'notes') {
                await appendToTimeline(noteList, stored.notes); //RN以外
              } else if (role === 'renotes') {
                await appendToTimeline(renoteList, stored.renotes); //RN
              }
            } else {
              autoShowNew[type] = true;
              latestBtn.classList.remove('show');
            }
          }
        } else if (role.includes('media')) {
          if (container.scrollTop > 1) {
            autoShowNew[type] = false;
            latestBtn.classList.add('show');
          } else {
            if (stored.media.length && role === 'media') {
              await appendToTimeline(mediaList, stored.media); //Media
            } else if (stored.rnMedia.length && role === 'rn-media') {
              await appendToTimeline(rnMediaList, stored.rnMedia); //RNMedia
            }
            autoShowNew[type] = true;
            latestBtn.classList.remove('show');
          }
        }
      },
      { signal: controller.signal }
    );
  });

  const confirmSensitive = () => {
    const confirmSensitive = document.querySelector('.confirm-sensitive');
    const buttons = document.getElementsByName('confirm-sensitive');
    let runResolve;

    confirmSensitive.classList.add('show');
    buttons[0].focus();
    [...buttons].forEach((button) => {
      button.addEventListener(
        'click',
        (e) => {
          if (e.target.value === 'yes') {
            runResolve(true);
          } else if (e.target.value === 'no') {
            runResolve(false);
          }
          confirmSensitive.classList.remove('show');
        },
        { signal: controller.signal }
      );
    });
    return new Promise((resolve) => {
      runResolve = resolve;
    });
  };

  let asked = false;
  if (localStorage.getItem('tlDisplay')) {
    const tlDisplay = localStorage.getItem('tlDisplay');
    if (tlDisplay === '2' /* sensitive only */) {
      const passed = await confirmSensitive();
      selectDisplay.value = passed ? tlDisplay : tlDisplay - 1;
      if (passed) {
        asked = true;
      }
    } else {
      selectDisplay.value = tlDisplay;
    }
    sdValue.textContent = displayModes[selectDisplay.value].label;
  }
  let sdIndexCache = selectDisplay.value;
  grid.classList.add(displayModes[sdIndexCache].name);
  selectDisplay.addEventListener(
    'pointerdown',
    () => {
      sdValue.textContent = displayModes[sdIndexCache].label;
    },
    { once: true, signal: controller.signal }
  );
  selectDisplay.addEventListener(
    'input',
    async () => {
      if (selectDisplay.value === '2' /* sensitive only */ && !asked) {
        const passed = await confirmSensitive();
        if (!passed) {
          selectDisplay.value = sdIndexCache;
          return;
        } else {
          asked = true;
        }
      }
      if (selectDisplay.value !== '0') {
        localStorage.setItem('tlDisplay', selectDisplay.value);
      } else {
        localStorage.removeItem('tlDisplay');
      }
      grid.classList.add(displayModes[selectDisplay.value].name);
      sdValue.textContent = displayModes[selectDisplay.value].label;
      grid.classList.remove(displayModes[sdIndexCache].name);
      sdIndexCache = selectDisplay.value;
      if (autoShowNew.note) {
        scrollToBottom(noteList.parentElement);
      }
      if (autoShowNew.renote) {
        scrollToBottom(renoteList.parentElement);
      }
      if ([...mediaList.children].some((elem) => getComputedStyle(elem).display !== 'none')) {
        mediaMG.positionItems();
      }
      if ([...rnMediaList.children].some((elem) => getComputedStyle(elem).display !== 'none')) {
        rnMediaMG.positionItems();
      }
    },
    { signal: controller.signal }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      const keyName = event.key;

      if (keyName === 'Escape') {
        hTimeline.dispose();
        wakeLock !== null &&
          wakeLock.release().then(() => {
            wakeLock = null;
          });
        alert('Escキーが押されたため、タイムラインの受信を停止しました。');
      }
    },
    { signal: controller.signal }
  );

  loadTimeline.notesScrollToBottom = () => {
    if (autoShowNew.note) {
      scrollToBottom(noteList.parentElement);
    }
    if (autoShowNew.renote) {
      scrollToBottom(renoteList.parentElement);
    }
  };

  loadTimeline.dispose = () => {
    hTimeline.dispose();
    controller.abort();
    [noteList, renoteList, mediaList, rnMediaList].forEach((elem) => {
      elem.textContent = '';
    });
    [mediaList, rnMediaList].forEach((elem) => {
      elem.removeAttribute('style');
    });
  };
};
await loadTimeline(currentOrigin);

const setupResizeHandle = () => {
  const headerHeight = 56;
  const getContentsHeight = () => grid.clientHeight - headerHeight;
  const getContentsRatio = () => (getContentsHeight() / grid.clientHeight) * 100;
  const setResize = (ratio) => {
    grid.style.gridTemplateRows = `${headerHeight}px ${ratio}fr ${100 - ratio}fr`;
    mediaContainers.forEach((container) => {
      container.style.paddingBottom = `${getContentsRatio() - (ratio * getContentsRatio()) / 100}dvh`;
    });
  };
  const resetResize = () => {
    grid.removeAttribute('style');
    mediaContainers.forEach((container) => {
      container.removeAttribute('style');
    });
    localStorage.removeItem('tlGridHorizontalRatio');
    loadTimeline.notesScrollToBottom();
  };

  if (localStorage.getItem('tlGridHorizontalRatio')) {
    const ratio = localStorage.getItem('tlGridHorizontalRatio');
    setResize(ratio);
  }
  let isResizing = false;
  resizeHandle.addEventListener('pointerdown', (e) => {
    isResizing = true;
    resizeHandle.setPointerCapture(e.pointerId);
  });
  resizeHandle.addEventListener('pointermove', (e) => {
    if (!isResizing) {
      return;
    }
    const y = e.clientY - headerHeight;
    const contentsPointerRatio = (y / getContentsHeight()) * 100;
    if (!e.isPrimary || contentsPointerRatio < 0 || contentsPointerRatio > 100) {
      return;
    }
    const defaultPoint = 50;
    const snapPoints = [0, defaultPoint, 100];
    const snapY = snapPoints.map((point) => (getContentsHeight() * point) / 100);
    const snapThreshold = 15;
    const foundSnapPoint = snapPoints.find((_, index) => Math.abs(y - snapY[index]) <= snapThreshold) ?? null;
    if (foundSnapPoint === defaultPoint) {
      resetResize();
      return;
    }
    let ratio;
    if (foundSnapPoint !== null) {
      ratio = foundSnapPoint;
    } else {
      ratio = contentsPointerRatio;
    }
    setResize(ratio);
    localStorage.setItem('tlGridHorizontalRatio', ratio);
  });
  document.addEventListener('pointerup', (e) => {
    if (e.isPrimary) {
      isResizing = false;
    }
  });
  resizeHandle.addEventListener('dblclick', resetResize);
};
setupResizeHandle();

const overlayPointerdownHandler = (e) => {
  if (!e.target.closest('.config') && !e.target.closest('.confirm-sensitive')) {
    body.classList.remove('show-config');
    body.removeEventListener('pointerdown', overlayPointerdownHandler);
  }
};
menuBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
});
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  body.classList.toggle('show-config');
  if (body.classList.contains('show-config')) {
    body.addEventListener('pointerdown', overlayPointerdownHandler);
  } else {
    body.removeEventListener('pointerdown', overlayPointerdownHandler);
  }
});

selectTimeline.addEventListener('change', async () => {
  loadTimeline.dispose();
  timelineIndex = Number(selectTimeline.value);
  localStorage.setItem('tlIndex', timelineIndex);
  await loadTimeline(currentOrigin);
});

customHostForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loadTimeline.dispose();
  customHost.value = normalizeHostInput(customHost.value);
  if (customHost.value !== originToHost(ioOrigin)) {
    localStorage.setItem('tlOrigin', `https://${customHost.value}`);
    if (currentOrigin !== ioOrigin) {
      if (!keepEmojis.checked) {
        localStorage.removeItem(`tlEmojis${host}`);
        localStorage.removeItem(`tlEmojis${host}Loaded`);
      }
    }
  } else {
    localStorage.removeItem('tlOrigin');
  }
  appState.initOrigin(domRefs, defaultHostText, defaultTitle);
  currentOrigin = appState.state.currentOrigin;
  host = appState.state.host;
  authInfo = authManager.checkToken(host);
  appState.initAuth(authInfo, domRefs);
  timelineIndex = appState.state.timelineIndex;
  localStorage.setItem('tlIndex', timelineIndex);
  keepEmojis.checked = !!localStorage.getItem(`tlEmojis${host}`);
  await loadTimeline(currentOrigin);
});

resetHostBtn.addEventListener('click', async () => {
  loadTimeline.dispose();
  localStorage.removeItem('tlOrigin');
  if (!keepEmojis.checked) {
    localStorage.removeItem(`tlEmojis${host}`);
    localStorage.removeItem(`tlEmojis${host}Loaded`);
  }
  appState.initOrigin(domRefs, defaultHostText, defaultTitle);
  currentOrigin = appState.state.currentOrigin;
  host = appState.state.host;
  authInfo = authManager.checkToken(host);
  appState.initAuth(authInfo, domRefs);
  timelineIndex = appState.state.timelineIndex;
  localStorage.setItem('tlIndex', timelineIndex);
  keepEmojis.checked = !!localStorage.getItem(`tlEmojis${host}`);
  await loadTimeline(currentOrigin);
});

authenticateBtn.addEventListener('click', async () => {
  if (authInfo) {
    authManager.removeAuthInfo(host);
    loadTimeline.dispose();
    authInfo = null;
    appState.initAuth(authInfo, domRefs);
    timelineIndex = appState.state.timelineIndex;
    localStorage.setItem('tlIndex', timelineIndex);
    await loadTimeline(currentOrigin);
  } else {
    goMiAuth(host);
  }
});
