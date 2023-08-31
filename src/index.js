import { Stream as misskeyStream } from 'misskey-js';
import { parseSimple as mfmParseSimple } from 'mfm-js';
import MagicGrid from 'magic-grid';

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('.grid');
  const containers = document.querySelectorAll('.container');
  const noteList = document.getElementById('notes-list');
  const renoteList = document.getElementById('renotes-list');
  const mediaList = document.getElementById('media-list');
  const rnMediaList = document.getElementById('rn-media-list');
  const notelatestBtn = document.getElementById('note-latest');
  const renotelatestBtn = document.getElementById('renote-latest');
  const mediumlatestBtn = document.getElementById('medium-latest');
  const rnMediumlatestBtn = document.getElementById('rn-medium-latest');
  const menuBtn = document.getElementById('menu-btn');
  const configFrame = document.querySelector('.config');
  const selectDisplay = document.getElementById('select-display');
  const sdValue = document.getElementById('select-display-value');
  const customHostForm = document.forms['custom-host'];
  const customHost = document.getElementById('custom-host');
  const resetHostBtn = document.getElementById('reset-host');
  const ioOrigin = 'https://misskey.io';
  const defaultTitle = document.title;
  const loadTimeline = async () => {
    let currentOrigin;
    if (localStorage.getItem('tlOrigin')) {
      currentOrigin = localStorage.getItem('tlOrigin');
      const host = currentOrigin.replace('https://', '');
      document.title = `${host} マルチタイムライン`
      customHost.value = host;
      configFrame.classList.add('customized-host');
    } else {
      currentOrigin = ioOrigin;
      document.title = defaultTitle;
      customHost.value = '';
      configFrame.classList.remove('customized-host');
    }
    const stream = new misskeyStream(currentOrigin);
    const hTimeline = stream.useChannel('localTimeline');
    // const stream = new misskeyStream(currentOrigin, {token: ''});
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
    const emojiShortcodeToUrlDic = {};
    const noteLimit = 150;
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
    const tlDisplayClassNames = ['all', 'hide-sensitive', 'sensitive-only'];
    const sdValueStrings = ['全て', 'NSFW除外', 'NSFWのみ'];
    const controller = new AbortController();
    let wakeLock = null;
    mediaMG.listen();
    rnMediaMG.listen();
  
    const scrollToBottom = node => {
      node.scrollTop = node.scrollHeight;
    }
  
    const htmlspecialchars = unsafeText => {
      if(typeof unsafeText !== 'string'){
        return unsafeText;
      }
      return unsafeText.replace(
        /[&'`"<>]/g, 
        match => {
          return {
            '&': '&amp;',
            "'": '&#x27;',
            '`': '&#x60;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;',
          }[match]
        }
      );
    }
  
    const fromNow = posted => {
      const diff = new Date().getTime() - posted.getTime();
      const progress = new Date(diff);
  
      if (progress.getUTCFullYear() - 1970) {
        return progress.getUTCFullYear() - 1970 + '年前';
      } else if (progress.getUTCMonth()) {
        return progress.getUTCMonth() + 'ヶ月前';
      } else if (progress.getUTCDate() - 1) {
        return progress.getUTCDate() - 1 + '日前';
      } else if (progress.getUTCHours()) {
        return progress.getUTCHours() + '時間前';
      } else if (progress.getUTCMinutes()) {
        return progress.getUTCMinutes() + '分前';
      } else {
        return progress.getUTCSeconds() + '秒前';
      }
    }
  
    const emojiShortcodeToUrl = async (name, host) => {
      // if (host) {
      //   console.log('external host emoji:', name);
      // }
      if (!(name in emojiShortcodeToUrlDic)) {
        const targetOrigin = host ? `https://${host}` : currentOrigin;
        await fetch(`${targetOrigin}/api/emoji?name=${name}`)
          .then((response) => response.json())
          .then((data) => {
            if (data.error) {
              // console.log('error');
              emojiShortcodeToUrlDic[name] = null;
            } else {
              emojiShortcodeToUrlDic[name] = data.url;
            }
          }).catch((e) => {
            // console.log('catch');
            emojiShortcodeToUrlDic[name] = null;
          });
      }
      return emojiShortcodeToUrlDic[name];
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
            html += node.props.text.replace(/\n/g, '<br>');
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
      const renote = note.isRenote ? note.renote : null;
      renote && (renote.host = renote.user.host);
      // if (renote.host) {
      //   console.log('detected external host renote:', renote.host, 'note id:', note.id);
      // }
      const formatted = {
        name:      note.user.name ? await simpleMfmToHTML(note.user.name) : note.user.username,
        plainName: note.user.name ? note.user.name : note.user.username,
        text:      await makeTextHTMLFromNote(note),
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
        <span class="wrap"><span class="name" title="${formatted.plainName}">${formatted.name}</span><span class="text">${formatted.text}${formatted.fileCount}</span></span><a href="${currentOrigin}/notes/${note.id}" class="time" target="misskey" rel=”noopener”>${formatted.time}</a>
      </li>
      `
      : target === 'renote' ?
      `<li data-id="${note.id}" class="${formatted.containsSensitive}">
        <div class="renote-info">
          <span class="wrap"><span class="name" title="${formatted.plainName}">${formatted.name}</span><span class="text">${formatted.text}${formatted.fileCount}</span></span><a href="${currentOrigin}/notes/${note.id}" class="time" target="misskey" rel=”noopener”>${formatted.time}</a>
        </div>
        <div class="renoted-note">
          <span class="wrap"><span class="name" title="${formatted.plainRnName}">${formatted.rnName}</span><span class="text">${formatted.rnText}${formatted.rnFileCount}</span></span><a href="${currentOrigin}/notes/${renote.id}" class="time" target="misskey" rel=”noopener”>${formatted.rnTime}</a>
        </div>
      </li>
      `
      : false;
      return html;
    };
  
    const makeHTMLFromNoteForMedia = async (note, target) => {
      note.isRenote = Boolean(note.renoteId);
      const renote = note.isRenote ? note.renote : null;
      const targetNote = target === 'note' && note || target === 'renote' && renote;
      const firstFile = targetNote.files[0];
      const formatted = {
        text:      await makeTextHTMLFromNote(targetNote, renote && renote.host),
        fileCount: (note => {return note.fileIds.length > 1 ? `<span class="more-file-count">+ ${note.fileIds.length - 1}</span>` : '';})(targetNote),
        containsSensitive: detectSensitiveFile(targetNote) || targetNote.cw !== null ? 'contains-sensitive' : ''
      };
      const html = firstFile.type.includes('image') || firstFile.type.includes('video') ?
      `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''} class="${formatted.containsSensitive}">
        <a href="${currentOrigin}/notes/${note.id}" class="link" target="misskey" rel=”noopener”>
          <img src="${firstFile.thumbnailUrl || ''}" alt="${firstFile.comment || firstFile.name}" class="${firstFile.isSensitive || targetNote.cw !== null ? 'is-sensitive' : ''}">
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
        <a href="${currentOrigin}/notes/${note.id}" class="link" target="misskey" rel=”noopener”>
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
        <a href="${currentOrigin}/notes/${note.id}" class="link" target="misskey" rel=”noopener”>
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
    });
  
    const textToggleHandler = e => {
      if (selecting) {
        selecting = false;
        return;
      }
      if (e.target.closest('.is-long') || e.target.closest('.wrap') && e.target.querySelector('.is-long')) {
        e.target.closest('.wrap').classList.toggle('is-open');
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
      }
      if (e.target.closest('#media-list')) {
        mediaMG.positionItems();
      } else if (e.target.closest('#rn-media-list')) {
        rnMediaMG.positionItems();
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
          this.parentElement.scrollTop = 0;
        }
        while (this.querySelectorAll('li').length > noteLimit) {
          this.lastElementChild.remove();
        }
        const notesLength = !isNote && noteOrNotes.length || 1;
        const displayedElems = [...this.children]
          .slice(0, notesLength)
          .filter(elem => getComputedStyle(elem).display !== 'none');
        let foundImg = false;
        displayedElems.forEach(elem => {
          const img = elem.querySelector('img');
          foundImg = img && true;
          if (img && img.src !== '') {
            img.addEventListener('load', () => {
              if (this === mediaList) {
                mediaMG.positionItems();
              } else if (this === rnMediaList) {
                rnMediaMG.positionItems();
              }
            }, {once: true});
          }
        });
        if (!foundImg) {
          if (this === mediaList) {
            mediaMG.positionItems();
          } else if (this === rnMediaList) {
            rnMediaMG.positionItems();
          }
        }
      }
      overflowJudgment();
    }
  
    stream.on('_connected_', async () => {
      // console.log('connected');
      wakeLock = await navigator.wakeLock.request('screen');
    });
  
    stream.on('_disconnected_', () => {
      // console.log('disconnected');
      wakeLock.release()
      .then(() => {
        wakeLock = null;
      });
    });
  
    document.addEventListener('visibilitychange', async () => {
      if (wakeLock !== null && document.visibilityState === 'visible' && stream.state == 'connected') {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    }, {signal: controller.signal});
  
    hTimeline.on('note', async note => {
      // console.log(note);
      const isRenote = Boolean(note.renoteId);
      const isNoteOrQuote = Boolean(note.text !== null || note.fileIds.length || !isRenote);
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
    });
  
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
      if (mediaList.firstElementChild) {
        mediaMG.positionItems();
      }
      if (rnMediaList.firstElementChild) {
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
    }, {once: true, signal: controller.signal});

    loadTimeline.dispose = () => {
      hTimeline.dispose();
      controller.abort();
      [noteList, renoteList, mediaList, rnMediaList].forEach(elem => {
        elem.textContent = '';
      });
    }
  };
  await loadTimeline();
  
  const overlayClickHandler = e => {
    if (!e.target.closest('.config') && !e.target.closest('.confirm-sensitive')) {
      body.classList.remove('show-config');
      body.removeEventListener('click', overlayClickHandler);
    }
  }
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    const body = document.body;
    body.classList.toggle('show-config');
    if (body.classList.contains('show-config')) {
      body.addEventListener('click', overlayClickHandler);
    } else {
      body.removeEventListener('click', overlayClickHandler);
    }
  });
  
  customHostForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (customHost.value !== ioOrigin.replace('https://', '')) {
      localStorage.setItem('tlOrigin', `https://${customHost.value}`);
    } else {
      localStorage.removeItem('tlOrigin');
    }
    loadTimeline.dispose();
    await loadTimeline();
  });

  resetHostBtn.addEventListener('click', async () => {
    localStorage.removeItem('tlOrigin');
    loadTimeline.dispose();
    await loadTimeline();
  });
});