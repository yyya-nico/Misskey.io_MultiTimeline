import './style.scss'
import { Stream as misskeyStream, api as misskeyApi } from 'misskey-js';
import { parseSimple as mfmParseSimple } from 'mfm-js';
import MagicGrid from 'magic-grid';
import {scrollToBottom, htmlspecialchars, fromNow, goMiAuth, routing} from './utils';

document.addEventListener('DOMContentLoaded', async () => {
  await routing();
  const grid = document.querySelector('.grid');
  const containers = document.querySelectorAll('.container');
  const mediaContainers = [...containers].filter(container => ['media','rn-media'].some(className => container.classList.contains(className)));
  const noteList = document.getElementById('notes-list');
  const renoteList = document.getElementById('renotes-list');
  const mediaList = document.getElementById('media-list');
  const rnMediaList = document.getElementById('rn-media-list');
  const notelatestBtn = document.getElementById('note-latest');
  const renotelatestBtn = document.getElementById('renote-latest');
  const mediumlatestBtn = document.getElementById('medium-latest');
  const rnMediumlatestBtn = document.getElementById('rn-medium-latest');
  const resizeHandle = document.querySelector('.resize-handle');
  const menuBtn = document.getElementById('menu-btn');
  const configFrame = document.querySelector('.config');
  const selectDisplay = document.getElementById('select-display');
  const sdValue = document.getElementById('select-display-value');
  const selectTimeline = document.getElementById('select-timeline');
  const misskeyLink = document.querySelector('.misskey-link');
  const mlLink = misskeyLink.querySelector('a');
  const hostTextWraps = document.querySelectorAll('.host');
  const customHostForm = document.forms['custom-host'];
  const customHost = document.getElementById('custom-host');
  const resetHostBtn = document.getElementById('reset-host');
  const keepEmojis = document.getElementById('keep-emojis');
  const authenticateLabel = document.querySelector('[for="authenticate"]');
  const authenticateBtn = document.getElementById('authenticate');
  const clearEmojisCacheBtn = document.getElementById('clear-emojis-cache');
  const ioOrigin = 'https://misskey.io';
  const defaultHostText = hostTextWraps[0].textContent;
  const defaultTitle = document.title;
  const mediaMG = new MagicGrid({
    container: mediaList,
    items: 1,
    gutter: 20,
    animate: true
  });
  const rnMediaMG = new MagicGrid({
    container: rnMediaList,
    items: 1,
    gutter: 20,
    animate: true
  });
  mediaMG.listen();
  rnMediaMG.listen();
  let currentOrigin, host;
  const originToHost = origin => origin.replace('https://', '');

  const initOrigin = () => {
    if (localStorage.getItem('tlOrigin')) {
      currentOrigin = localStorage.getItem('tlOrigin');
      host = originToHost(currentOrigin);
      document.title = `${host} マルチタイムライン(連携対応版)`
      hostTextWraps.forEach(hostTextWrap => {
        hostTextWrap.textContent = host;
      });
      customHost.value = host;
      configFrame.classList.add('customized-host');
    } else {
      currentOrigin = ioOrigin;
      host = originToHost(currentOrigin);
      document.title = defaultTitle;
      hostTextWraps.forEach(hostTextWrap => {
        hostTextWrap.textContent = defaultHostText;
      });
      customHost.value = '';
      configFrame.classList.remove('customized-host');
    }
    mlLink.href = currentOrigin;
    keepEmojis.checked = !!localStorage.getItem(`tlEmojis${host}`);
  }
  initOrigin();

  const checkToken = host => {
    const storedAuths = localStorage.getItem('auths');
    const auths = storedAuths && JSON.parse(storedAuths) || [];
    return auths.find(entry => entry.host === host) || null;
  }

  let timelineIndex;
  const initAuth = authInfo => {
    if (authInfo) {
      const disabledOptions = selectTimeline.querySelectorAll(':disabled');
      disabledOptions.forEach(option => option.disabled = false);
      timelineIndex = 0;
      authenticateLabel.textContent = `@${authInfo.user.username}に接続`;
      authenticateBtn.textContent = '切断';
    } else {
      const disabledOptions = selectTimeline.querySelectorAll('[value="0"], [value="2"]');
      disabledOptions.forEach(option => option.disabled = true);
      timelineIndex = 1;
      authenticateLabel.textContent = '認証してHTLとSTLも見る';
      authenticateBtn.textContent = '認証';
    }
    selectTimeline.value = timelineIndex;
  }

  const emojiShortcodeToUrlDic = {};
  const initEmojis = async origin => {
    const host = originToHost(origin);
    const moreThan24HoursHavePassed = Date.now() - Number(localStorage.getItem(`tlEmojis${host}Loaded`)) >= 24 * 60 * 60 * 1000;
    if (localStorage.getItem(`tlEmojis${host}`) && localStorage.getItem(`tlEmojis${host}Loaded`) && !moreThan24HoursHavePassed) {
      emojiShortcodeToUrlDic[host] = JSON.parse(localStorage.getItem(`tlEmojis${host}`));
      console.log('Loaded emojis from cache');
      return;
    }

    // emojis fetch
    emojiShortcodeToUrlDic[host] = {};
    await fetch(`${origin}/api/emojis`)
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 200) {
          const emojis = data.emojis;
          emojis.forEach(entry => {
            emojiShortcodeToUrlDic[host][entry.name] = entry.url;
          });
          localStorage.setItem(`tlEmojis${host}`, JSON.stringify(emojiShortcodeToUrlDic[host]));
          localStorage.setItem(`tlEmojis${host}Loaded`, Date.now());
        } else {
          console.log('error or no content', response.status);
        }
      }).catch((e) => {
        console.error('Failed to load Emojis', e);
    });
  }

  let authInfo = checkToken(host);
  initAuth(authInfo);
  const loadTimeline = async origin => {
    await initEmojis(origin);
    const stream = new misskeyStream(origin, authInfo ? {token: authInfo.token} : null);
    const channelNames = ['homeTimeline','localTimeline','hybridTimeline','globalTimeline'];
    const hTimeline = stream.useChannel(channelNames[timelineIndex]);
    // const stream = new misskeyStream(origin, {token: ''});
    // const hTimeline = stream.useChannel('homeTimeline');
    const autoShowNew = {
      note: true,
      renote: true,
      medium: true,
      rnMedium: true
    };
    const stored = {
      notes: [],
      renotes: [],
      media: [],
      rnMedia: []
    };
    const noteLimit = 150;
    const tlDisplayClassNames = ['all', 'hide-sensitive', 'sensitive-only'];
    const sdValueStrings = ['全て', 'NSFW除外', 'NSFWのみ'];
    const controller = new AbortController();
    let wakeLock = null;

    const loadAndStoreEmoji = async (name, host) => {
      emojiShortcodeToUrlDic[host] = emojiShortcodeToUrlDic[host] || {};
      const cli = new misskeyApi.APIClient({origin: `https://${host}`});
      await cli.request('emoji', {name: name})
        .then((data) => {
          const isValid = data !== null && (host === originToHost(origin) || data.localOnly !== true);
          emojiShortcodeToUrlDic[host][name] = isValid ? data.url : null;
          // host !== originToHost(origin) && data.localOnly === true && console.log(`${host}\'s Emoji`, `:${name}:`, 'is local only');
          // emojiShortcodeToUrlDic[host][name] && console.log(`${host}\'s Emoji`, `:${name}:`, 'stored');
        }).catch((e) => {
          console.log(`${host}\'s Emoji`, `:${name}:`, 'not found');
          console.dir(e);
          emojiShortcodeToUrlDic[host][name] = null;
      });
    }

    const storeExternalEmojisFromNote = note => {
      const host = note.user.host;
      emojiShortcodeToUrlDic[host] = emojiShortcodeToUrlDic[host] || {};
      [note.user.emojis, note.emojis].forEach(emojis => {
        Object.keys(emojis).forEach(name => {
          const url = emojis[name];
          emojiShortcodeToUrlDic[host][name] = url;
        });
      });
      // console.log(`現在の${host}の絵文字記録:`, emojiShortcodeToUrlDic[host]);
    }

    const emojiShortcodeToUrl = async (name, host) => {
      // if (host === originToHost(origin)) {
      //   console.log('external host emoji:', name);
      // }
      host = host || originToHost(origin);
      if (!(host in emojiShortcodeToUrlDic) || !(name in emojiShortcodeToUrlDic[host])) {
        await loadAndStoreEmoji(name, host);
      }
      return emojiShortcodeToUrlDic[host][name] || null;
    }
    // console.log(emojiShortcodeToUrl('x_z'));

    const simpleMfmToHTML = async (text, host) => {
      if (!text) {
        return '';
      }
      const parsedMfm = mfmParseSimple(text);
      let html = '';
      for (const node of parsedMfm) {
        switch(node.type) {
          case 'emojiCode':
            const emojiUrl = await emojiShortcodeToUrl(node.props.name, host);
              if (emojiUrl === null) {
                html += `:${node.props.name}:`
              } else {
                html += `<img class="custom-emoji" src="${emojiUrl}" alt=":${node.props.name}:" title=":${node.props.name}:">`;
              }
            break;
          case 'text':
            html += node.props.text.replaceAll(/\n/g, '<br>');
            break;
          case 'unicodeEmoji':
            html += node.props.emoji;
            break;
        }
      }
      return html;
    }
    // console.log(simpleMfmToHTML(''));
    // console.log(simpleMfmToHTML(null));
    // console.log(simpleMfmToHTML());

    const makeTextHTMLFromNote = async (note, host) => {
      if (note.cw !== null) {
        return `[CW]${await simpleMfmToHTML(htmlspecialchars(note.cw), host)} <span class="cwtext">${(await simpleMfmToHTML(htmlspecialchars(note.text), host))}</span>`;
      } else if (note.text) {
        return await simpleMfmToHTML(htmlspecialchars(note.text), host);
      } else if (note.renoteId || note.fileIds.length) {
        return '';
      } else {
        return '<span class="nothing">なにもありません</span>';
      }
    }

    const detectSensitiveFile = note => {
      return note.files.some(file => file.isSensitive);
    }

    const makeHTMLFromNote = async (note, target) => {
      note.isRenote = Boolean(note.renoteId);
      note.host = note.user.host;
      const renote = note.isRenote ? note.renote : null;
      renote && (renote.host = renote.user.host);
      const formatted = {
        name:      note.user.name ? await simpleMfmToHTML(note.user.name, note.host) : note.user.username,
        plainName: note.user.name ? note.user.name : note.user.username,
        text:      await makeTextHTMLFromNote(note, note.host),
        fileCount: note.fileIds.length ? `<span class="file-count">[${note.fileIds.length}つのファイル]</span>` : '',
        time:      new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}),
        containsSensitive: (detectSensitiveFile(note) || renote && detectSensitiveFile(renote)) ? 'contains-sensitive' : '',
        ...(target === 'renote' && {
          rnName:      renote.user.name ? await simpleMfmToHTML(renote.user.name, renote.host) : renote.user.username,
          plainRnName: renote.user.name ? renote.user.name : renote.user.username,
          rnText:      await makeTextHTMLFromNote(renote, renote.host),
          rnFileCount: renote.fileIds.length ? `<span class="file-count">[${renote.fileIds.length}つのファイル]</span>` : '',
          rnTime: fromNow(new Date(renote.createdAt))
        })
      };
      const html = target === 'note' ?
      `<li data-id="${note.id}" class="${formatted.containsSensitive}">
        <span class="wrap"><span class="name" title="${formatted.plainName}">${formatted.name}</span><span class="text">${formatted.text}${formatted.fileCount}</span></span><a href="${origin}/notes/${note.id}" class="time" target="misskey" rel=”noopener”>${formatted.time}</a>
      </li>
      `
      : target === 'renote' ?
      `<li data-id="${note.id}" class="${formatted.containsSensitive}">
        <div class="renote-info">
          <span class="wrap"><span class="name" title="${formatted.plainName}">${formatted.name}</span><span class="text">${formatted.text}${formatted.fileCount}</span></span><a href="${origin}/notes/${note.id}" class="time" target="misskey" rel=”noopener”>${formatted.time}</a>
        </div>
        <div class="renoted-note">
          <span class="wrap"><span class="name" title="${formatted.plainRnName}">${formatted.rnName}</span><span class="text">${formatted.rnText}${formatted.rnFileCount}</span></span><a href="${origin}/notes/${renote.id}" class="time" target="misskey" rel=”noopener”>${formatted.rnTime}</a>
        </div>
      </li>
      `
      : false;
      return html;
    };

    const makeHTMLFromNoteForMedia = async (note, target) => {
      note.isRenote = Boolean(note.renoteId);
      note.host = note.user.host;
      const renote = note.isRenote ? note.renote : null;
      renote && (renote.host = renote.user.host);
      const targetNote = target === 'note' && note || target === 'renote' && renote;
      const firstFile = targetNote.files[0];
      const formatted = {
        text:      await makeTextHTMLFromNote(targetNote, targetNote.host),
        fileCount: (note => {return note.fileIds.length > 1 ? `<span class="more-file-count">+ ${note.fileIds.length - 1}</span>` : '';})(targetNote),
        containsSensitive: detectSensitiveFile(targetNote) || targetNote.cw !== null ? 'contains-sensitive' : ''
      };
      const html = firstFile.type.includes('image') || firstFile.type.includes('video') ?
      `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''} class="${formatted.containsSensitive}">
        <a href="${origin}/notes/${note.id}" class="link" target="misskey" rel=”noopener”>
          <img src="${firstFile.thumbnailUrl || ''}" alt="${firstFile.comment || firstFile.name}" class="${firstFile.isSensitive || targetNote.cw !== null ? 'is-sensitive' : ''}" ${firstFile.type.includes('image') ? `width="${firstFile.properties.width}" height="${firstFile.properties.height}"` : ''}>
          ${firstFile.type.includes('video') ? '<span class="is-video">動画</span>' : ''}
          ${formatted.fileCount}
        </a>${formatted.text &&`
        <div class="text">
          ${formatted.text}
        </div>`}
      </li>
      `
      : firstFile.type.includes('audio') ?
      `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''} class="${formatted.containsSensitive}">
        <a href="${origin}/notes/${note.id}" class="link" target="misskey" rel=”noopener”>
          <span class="file-type">音声</span>
          ${formatted.fileCount}
        </a>${formatted.text &&`
        <div class="text">
          ${formatted.text}
        </div>`}
      </li>
      `
      :
      `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''} class="${formatted.containsSensitive}">
        <a href="${origin}/notes/${note.id}" class="link" target="misskey" rel=”noopener”>
          <span class="file-type">その他:${firstFile.type}</span>
          ${formatted.fileCount}
        </a>${formatted.text &&`
        <div class="text">
          ${formatted.text}
        </div>`}
      </li>
      `;
      return html;
    };

    const overflowJudgment = () => {
      const textWraps = document.querySelectorAll('li .wrap');
      textWraps.forEach(wrap => {
        const text = wrap.querySelector('.text');
        if (wrap.classList.contains('is-open') || wrap.offsetWidth < wrap.scrollWidth || text.querySelector('br')) {
          text.classList.add('is-long');
        } else {
          text.classList.remove('is-long');
        }
      });
      const texts = document.querySelectorAll('li > div.text');
      texts.forEach(text => {
        if (text.classList.contains('is-open') || text.offsetWidth < text.scrollWidth || text.querySelector('br')) {
          text.classList.add('is-long');
        } else {
          text.classList.remove('is-long');
        }
      });
    }

    window.addEventListener('resize', overflowJudgment, {signal: controller.signal});

    let selecting = false;
    document.addEventListener('selectstart', () => {
      document.addEventListener('pointerup', () => {
        selecting = !window.getSelection().isCollapsed;
      }, {once: true, signal: controller.signal});
    }, {signal: controller.signal});

    const beforeAutoShowNew = {
      note: false,
      renote: false,
      medium: false,
      rnMedium: false
    }
    const textToggleHandler = e => {
      if (selecting) {
        selecting = false;
        return;
      }
      if (e.target.closest('.is-long') || e.target.closest('.wrap') && e.target.querySelector('.is-long')) {
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
    }

    noteList.addEventListener('click', textToggleHandler, {signal: controller.signal});
    renoteList.addEventListener('click', textToggleHandler, {signal: controller.signal});

    const mediaTextToggleHandler = e => {
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
    }

    mediaList.addEventListener('click', mediaTextToggleHandler, {signal: controller.signal});
    rnMediaList.addEventListener('click', mediaTextToggleHandler, {signal: controller.signal});

    Node.prototype.appendToTl = async function(noteOrNotes) {
      if (this !== noteList && this !== renoteList && this !== mediaList && this !== rnMediaList) {
        return false;
      }
      // console.log(note);
      const isNote = !Array.isArray(noteOrNotes);
      let html = '';
      if (this === noteList || this === renoteList ) {
        const target = this === noteList && 'note' || this === renoteList && 'renote';
        if (isNote) {
          const note = noteOrNotes;
          html = await makeHTMLFromNote(note, target);
        } else {
          const notes = noteOrNotes;
          while (notes.length) {
            html += await makeHTMLFromNote(notes.shift(), target);
            // console.log('note shifted, notes count:', notes.length);
          }
        }
        this.insertAdjacentHTML('beforeend', html);
        // console.log('note count:',this.querySelectorAll('li').length);
        if (autoShowNew[this === noteList && 'note' || this === renoteList && 'renote']) {
          scrollToBottom(this.parentElement);
        }
        while (this.querySelectorAll('li').length > noteLimit) {
          this.firstElementChild.remove();
        }
      } else if (this === mediaList || this === rnMediaList) {
        const target = this === mediaList && 'note' || this === rnMediaList && 'renote';
        const notesLengthCache = !isNote && noteOrNotes.length || 1;
        if (isNote) {
          const note = noteOrNotes;
          if (target == 'renote') {
            const alreadyRN = rnMediaList.querySelector(`[data-rn-id="${note.renoteId}"]`);
            alreadyRN && alreadyRN.remove();
          }
          html = await makeHTMLFromNoteForMedia(note, target);
        } else {
          const notes = noteOrNotes;
          while (notes.length) {
            const note = notes.pop();
            // console.log('note poped, notes count:', notes.length);
            if (target == 'renote') {
              const alreadyRN = rnMediaList.querySelector(`[data-rn-id="${note.renoteId}"]`);
              alreadyRN && alreadyRN.remove();
            }
            html += await makeHTMLFromNoteForMedia(note, target);
          }
        }
        this.insertAdjacentHTML('afterbegin', html);
        if (autoShowNew[this === mediaList && 'medium' || this === rnMediaList && 'rnMedium']) {
          this.parentElement.scrollTo({top: 0});
        }
        while (this.querySelectorAll('li').length > noteLimit) {
          this.lastElementChild.remove();
        }
        // console.log(this.id, 'before positionItems()');
        // console.time(this.id);
        const appendedItems = [...this.children].slice(0, notesLengthCache);
        const someAppendedItemsAreDisplayed = appendedItems
          .some(elem => getComputedStyle(elem).display !== 'none');
        // this === rnMediaList && console.log(appendedItems, someAppendedItemsAreDisplayed);
        if (someAppendedItemsAreDisplayed) {
          if (this === mediaList ) {
            mediaMG.positionItems();
          } else if (this === rnMediaList) {
            rnMediaMG.positionItems();
          }
          // console.log(this.id, 'positionItems()');
        }
        // console.timeEnd(this.id);
        const videoThumbnailImgs = appendedItems
          .map(elem => elem.querySelector('img'))
          .filter(img => img && img.style.width === '' && img.src !== '');
        videoThumbnailImgs.forEach(img => {
          img.addEventListener('load', () => {
            if (this === mediaList) {
              mediaMG.positionItems();
            } else if (this === rnMediaList) {
              rnMediaMG.positionItems();
            }
          }, {once: true});
          // console.log('videoThumbnailImgs', img);
        });
      }
      overflowJudgment();
    }

    stream.on('_connected_', async () => {
      console.log('connected');
      if (document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    });

    stream.on('_disconnected_', () => {
      console.log('disconnected');
      wakeLock !== null && wakeLock.release()
      .then(() => {
        wakeLock = null;
      });
    });

    document.addEventListener('visibilitychange', async () => {
      if (wakeLock !== null && document.visibilityState === 'visible' && stream.state == 'connected') {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    }, {signal: controller.signal});

    const parseNote = async note => {
      // console.log(note);
      const isRenote = Boolean(note.renoteId);
      const isNoteOrQuote = Boolean(note.text !== null || note.fileIds.length || !isRenote);
      const host = note.user.host;
      if (host) {
        storeExternalEmojisFromNote(note);
        // console.log(note);
      }
      if (isNoteOrQuote) {
        if (autoShowNew.note) {
          await noteList.appendToTl(note);//RN以外
        } else {
          stored.notes.push(note);//RN以外
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
          storeExternalEmojisFromNote(renote);
          // console.log(renote);
        }
        if (autoShowNew.renote) {
          await renoteList.appendToTl(note);//RN
        } else {
          stored.renotes.push(note);//RN
          // console.log('renote pushed, stored renotes count:',stored.renotes.length);
          if (stored.renotes.length > noteLimit) {
            stored.renotes = stored.renotes.slice(-noteLimit);
          }
        }
      }
      if (note.fileIds.length) {
        if (autoShowNew.medium) {
          await mediaList.appendToTl(note);
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
          await rnMediaList.appendToTl(note);
        } else {
          const deleteIndex = stored.rnMedia.findIndex(storedNote => storedNote.renoteId === note.renoteId);
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
    }

    const apiTimelineEndpoints = ['timeline','local-timeline','hybrid-timeline','global-timeline'];
    const cli = new misskeyApi.APIClient({origin: origin, ...(authInfo && {credential: authInfo.token})});
    await cli.request(`notes/${apiTimelineEndpoints[timelineIndex]}`, {limit: 15})
      .then(async (notes) => {
        notes = notes.reverse();
        let p = Promise.resolve();
        notes.forEach(note => p = p.then(() => parseNote(note)));
        await p;
      }).catch((e) => {
        console.log(`${host}\'s`, `notes/${apiTimelineEndpoints[timelineIndex]}`, 'could not load');
        console.dir(e);
    });
    // console.log(noteList.children.length + renoteList.children.length);

    hTimeline.on('note', parseNote);

    const latestBtnHandler = async e => {
      const latestBtn = e.target;
      latestBtn.textContent = '読み込み中...';
      if (latestBtn === notelatestBtn) {
        autoShowNew.note = true;
        await noteList.appendToTl(stored.notes);//RN以外
      } else if (latestBtn === renotelatestBtn) {
        autoShowNew.renote = true;
        await renoteList.appendToTl(stored.renotes);//RN
      } else if (latestBtn === mediumlatestBtn) {
        autoShowNew.medium = true;
        await mediaList.appendToTl(stored.media);//Media
      } else if (latestBtn === rnMediumlatestBtn) {
        autoShowNew.rnMedium = true;
        await rnMediaList.appendToTl(stored.rnMedia);//RNMedia
      }
      latestBtn.classList.remove('show');
      latestBtn.textContent = '新しいノートを見る';
    }

    notelatestBtn.addEventListener('click', latestBtnHandler, {signal: controller.signal});
    renotelatestBtn.addEventListener('click', latestBtnHandler, {signal: controller.signal});
    mediumlatestBtn.addEventListener('click', latestBtnHandler, {signal: controller.signal});
    rnMediumlatestBtn.addEventListener('click', latestBtnHandler, {signal: controller.signal});

    containers.forEach(container => {
      container.addEventListener('scroll', async e => {
        const latestBtn = container.querySelector('button[id$="-latest"]');
        const containerRole = container.classList.contains('notes')    ? 'notes'
                            : container.classList.contains('renotes')  ? 'renotes'
                            : container.classList.contains('media')    ? 'media'
                            : container.classList.contains('rn-media') ? 'rn-media'
                                                                       : null;
        // console.log('scrolled: '+ containerRole);
        if (containerRole === 'notes' || containerRole === 'renotes') {
          if (container.scrollHeight - container.clientHeight - container.scrollTop >= 3) {
            autoShowNew[containerRole.slice(0,-1)] = false;
            latestBtn.classList.add('show');
          } else {
            if (stored[containerRole].length) {
              if (containerRole === 'notes') {
                await noteList.appendToTl(stored.notes);//RN以外
              } else if (containerRole === 'renotes') {
                await renoteList.appendToTl(stored.renotes);//RN
              }
            } else {
              autoShowNew[containerRole.slice(0,-1)] = true;
              latestBtn.classList.remove('show');
            }
          }
        } else if (containerRole === 'media' || containerRole === 'rn-media') {
          if (container.scrollTop > 1) {
            autoShowNew[containerRole === 'media' && 'medium' || containerRole === 'rn-media' && 'rnMedium'] = false;
            latestBtn.classList.add('show');
          } else {
            if (stored[containerRole === 'media' && 'media' || containerRole === 'rn-media' && 'rnMedia'].length) {
              if (containerRole === 'media') {
                await mediaList.appendToTl(stored.media);//Media
              } else if (containerRole === 'rn-media') {
                await rnMediaList.appendToTl(stored.rnMedia);//RNMedia
              }
            }
            autoShowNew[containerRole === 'media' && 'medium' || containerRole === 'rn-media' && 'rnMedium'] = true;
            latestBtn.classList.remove('show');
          }
        }
      }, {signal: controller.signal});
    });

    const confirmSensitive = () => {
      const confirmSensitive = document.querySelector('.confirm-sensitive');
      const buttons = document.getElementsByName('confirm-sensitive');
      let runResolve;

      confirmSensitive.classList.add('show');
      buttons[0].focus();
      [...buttons].forEach(button => {
        button.addEventListener('click', e => {
          if (e.target.value === 'yes') {
            runResolve(true);
          } else if (e.target.value === 'no') {
            runResolve(false);
          }
          confirmSensitive.classList.remove('show');
        }, {signal: controller.signal});
      });
      return new Promise(resolve => {
        runResolve = resolve;
      });
    }

    let asked = false;
    if (localStorage.getItem('tlDisplay')) {
      const tlDisplay = localStorage.getItem('tlDisplay');
      if (tlDisplay === '2'/* sensitive only */) {
        const passed = await confirmSensitive();
        selectDisplay.value = passed ? tlDisplay : tlDisplay - 1;
        if (passed) {
          asked = true;
        }
      } else {
        selectDisplay.value = tlDisplay;
      }
      sdValue.textContent = sdValueStrings[selectDisplay.value];
    }
    let sdIndexCache = selectDisplay.value;
    grid.classList.add(tlDisplayClassNames[sdIndexCache]);
    selectDisplay.addEventListener('pointerdown', () => {
      sdValue.textContent = sdValueStrings[sdIndexCache];
    }, {once: true, signal: controller.signal});
    selectDisplay.addEventListener('input', async () => {
      if (selectDisplay.value === '2'/* sensitive only */ && !asked) {
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
      grid.classList.add(tlDisplayClassNames[selectDisplay.value]);
      sdValue.textContent = sdValueStrings[selectDisplay.value];
      grid.classList.remove(tlDisplayClassNames[sdIndexCache]);
      sdIndexCache = selectDisplay.value;
      if (autoShowNew.note) {
        scrollToBottom(noteList.parentElement);
      }
      if (autoShowNew.renote) {
        scrollToBottom(renoteList.parentElement);
      }
      if ([...mediaList.children].some(elem => getComputedStyle(elem).display !== 'none')) {
        mediaMG.positionItems();
      }
      if ([...rnMediaList.children].some(elem => getComputedStyle(elem).display !== 'none')) {
        rnMediaMG.positionItems();
      }
    }, {signal: controller.signal});

    document.addEventListener('keydown', (event) => {
      const keyName = event.key;

      if (keyName === 'Escape') {
        hTimeline.dispose();
        wakeLock !== null && wakeLock.release()
        .then(() => {
          wakeLock = null;
        });
        alert('Escキーが押されたため、タイムラインの受信を停止しました。');
      }
    }, {signal: controller.signal});

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
      [noteList, renoteList, mediaList, rnMediaList].forEach(elem => {
        elem.textContent = '';
      });
      [mediaList, rnMediaList].forEach(elem => {
        elem.removeAttribute('style');
      });
    }
  };
  await loadTimeline(currentOrigin);

  const gridClientHeight = grid.clientHeight;
  const headerHeight = 56;
  if (localStorage.getItem('tlGridHorizontalRatio')) {
    const ratio = localStorage.getItem('tlGridHorizontalRatio');
    const contentsHeight = gridClientHeight - headerHeight;
    const contentsPercentage = contentsHeight / gridClientHeight;
    const gridPercent = ratio * contentsPercentage;
    grid.style.gridTemplateRows = `${headerHeight}px ${gridPercent}% ${contentsPercentage * 100 - gridPercent}%`;
    mediaContainers.forEach(container => {
      container.style.paddingBottom = `${(contentsPercentage * 100 - gridPercent) * (gridClientHeight / window.innerHeight)}dvh`;
    });
  }
  const onPointerLeave = () => {
    resizeHandle.classList.remove('hover');
  }
  resizeHandle.addEventListener('pointerenter', () => {
    resizeHandle.classList.add('hover');
  });
  resizeHandle.addEventListener('pointerleave', onPointerLeave);
  resizeHandle.addEventListener('pointerdown', e => {
    resizeHandle.removeEventListener('pointerleave', onPointerLeave);
    const onPointerMove = e => {
      const gridClientHeight = grid.clientHeight;
      const pointerY = Math.round(e.pageY);
      const contentsHeight = gridClientHeight - headerHeight;
      const contentsPercentage = contentsHeight / gridClientHeight;
      const contentsPointerY = pointerY - headerHeight;
      if (!e.isPrimary || contentsPointerY < 0 || contentsPointerY > contentsHeight ) {
          return;
      }
      const gridHorizontalCenter = contentsHeight / 2;
      const diffFromCenter = contentsPointerY - gridHorizontalCenter
      const nearTheMiddle = diffFromCenter <= 15 && diffFromCenter >= -15;
      let ratio;
      if(nearTheMiddle) {
        grid.removeAttribute('style');
        localStorage.removeItem('tlGridHorizontalRatio');
        mediaContainers.forEach(container => {
          container.removeAttribute('style');
        });
        loadTimeline.notesScrollToBottom();
        return;
      } else if (contentsPointerY <= 15) {
        ratio = 0;
      } else if (contentsHeight - contentsPointerY <= 15) {
        ratio = 100;
      } else {
        ratio = (contentsPointerY / contentsHeight) * 100;
      }
      const gridPercent = ratio * contentsPercentage;
      grid.style.gridTemplateRows = `${headerHeight}px ${gridPercent}% ${contentsPercentage * 100 - gridPercent}%`;
      localStorage.setItem('tlGridHorizontalRatio', ratio);
      mediaContainers.forEach(container => {
        container.style.paddingBottom = `${(contentsPercentage * 100 - gridPercent) * (gridClientHeight / window.innerHeight)}dvh`;
      });
      loadTimeline.notesScrollToBottom();
    }
    document.addEventListener('pointermove', onPointerMove);
    const onPointerUp = e => {
      if (e.isPrimary) {
        resizeHandle.classList.remove('hover');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        resizeHandle.addEventListener('pointerleave', onPointerLeave);
      }
    }
    document.addEventListener('pointerup', onPointerUp);
  });
  resizeHandle.addEventListener('dblclick', () => {
    grid.removeAttribute('style');
    localStorage.removeItem('tlGridHorizontalRatio');
    mediaContainers.forEach(container => {
      container.removeAttribute('style');
    });
    loadTimeline.notesScrollToBottom();
  });

  const body = document.body;
  const overlayPointerdownHandler = e => {
    if (!e.target.closest('.config') && !e.target.closest('.confirm-sensitive')) {
      body.classList.remove('show-config');
      body.removeEventListener('pointerdown', overlayPointerdownHandler);
    }
  }
  menuBtn.addEventListener('pointerdown', e => {
    e.stopPropagation();
  });
  menuBtn.addEventListener('click', e => {
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
    await loadTimeline(currentOrigin);
  });

  customHostForm.addEventListener('submit', async e => {
    e.preventDefault();
    loadTimeline.dispose();
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
    initOrigin();
    authInfo = checkToken(host);
    initAuth(authInfo);
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
    initOrigin();
    authInfo = checkToken(host);
    initAuth(authInfo);
    keepEmojis.checked = !!localStorage.getItem(`tlEmojis${host}`);
    await loadTimeline(currentOrigin);
  });

  authenticateBtn.addEventListener('click', async () => {
    if (authInfo) {
      const storedAuths = localStorage.getItem('auths');
      const auths = storedAuths && JSON.parse(storedAuths) || [];
      const deleteIndex = auths.findIndex(entry => entry.host === host);
      auths.splice(deleteIndex, 1);
      localStorage.setItem('auths', JSON.stringify(auths));
      loadTimeline.dispose();
      authInfo = null;
      initAuth(authInfo);
      await loadTimeline(currentOrigin);
    } else {
      goMiAuth(host);
    }
  });

  clearEmojisCacheBtn.addEventListener('click', async () => {
    const oldEmojis = localStorage.getItem(`tlEmojis${host}`);
    localStorage.removeItem(`tlEmojis${host}`);
    await initEmojis(currentOrigin);
    const newEmojis = localStorage.getItem(`tlEmojis${host}`);
    if (oldEmojis === newEmojis) {
      alert('絵文字URLを再取得しましたが、変更はありませんでした。');
    } else {
      const parsed = {
        oldEmojis: JSON.parse(oldEmojis),
        newEmojis: JSON.parse(newEmojis)
      };
      const oldEmojiNames = Object.keys(parsed.oldEmojis);
      const newEmojiNames = Object.keys(parsed.newEmojis);
      const diffEmojiNames = {
        old: oldEmojiNames.filter(key => !(key in parsed.newEmojis)),
        new: newEmojiNames.filter(key => !(key in parsed.oldEmojis))
      };
      alert(
`絵文字URLを再取得した結果、変更がありました。
消去された絵文字(${diffEmojiNames.old.length}件):
${diffEmojiNames.old.length ? `:${diffEmojiNames.old.join(':\n:')}:` : 'なし'}
登録された絵文字(${diffEmojiNames.new.length}件):
${diffEmojiNames.new.length ? `:${diffEmojiNames.new.join(':\n:')}:` : 'なし'}`
      );
    }
  });
});