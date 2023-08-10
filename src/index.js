import { Stream as misskeyStream } from 'misskey-js';
import { parseSimple as mfmParseSimple } from 'mfm-js';
import MagicGrid from 'magic-grid';

document.addEventListener('DOMContentLoaded', async () => {
  const currentOrigin = 'https://misskey.io';
  const stream = new misskeyStream(currentOrigin);
  const hTimeline = stream.useChannel('localTimeline');
  // const stream = new misskeyStream(currentOrigin, {token: ''});
  // const hTimeline = stream.useChannel('homeTimeline');
  const containers = document.querySelectorAll('.container');
  const noteList = document.getElementById('notes-list');
  const renoteList = document.getElementById('renotes-list');
  const mediaList = document.getElementById('media-list');
  const rnMediaList = document.getElementById('rn-media-list');
  const notelatestBtn = document.getElementById('note-latest');
  const renotelatestBtn = document.getElementById('renote-latest');
  const mediumlatestBtn = document.getElementById('medium-latest');
  const rnMediumlatestBtn = document.getElementById('rn-medium-latest');
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
    container: '#media-list',
    items: 1,
    gutter: 20,
    animate: true
  });
  const rnMediaMG = new MagicGrid({
    container: '#rn-media-list',
    items: 1,
    gutter: 20,
    animate: true
  });
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
          html += node.props.text;
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
    if (note.cw) {
      return `[CW]${await simpleMfmToHTML(htmlspecialchars(note.cw), host)} <span class="cwtext">${(await simpleMfmToHTML(htmlspecialchars(note.text), host)).replace(/\n/g, '<br>')}</span>`;
    } else if (note.text) {
      return (await simpleMfmToHTML(htmlspecialchars(note.text), host)).replace(/\n/g, '<br>');
    } else if (note.renoteId || note.fileIds.length) {
      return '';
    } else {
      return '<span class="nothing">なにもありません</span>';
    }
  }

  const makeHTMLFromNote = async note => {
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
      ...(renote && {
        rnName:      renote.user.name ? await simpleMfmToHTML(renote.user.name, renote.host) : renote.user.username,
        plainRnName: renote.user.name ? renote.user.name : renote.user.username,
        rnText:      await makeTextHTMLFromNote(renote, renote.host),
        rnFileCount: renote.fileIds.length ? `<span class="file-count">[${renote.fileIds.length}つのファイル]</span>` : '', 
        rnTime: fromNow(new Date(renote.createdAt))
      })
    };
    const html = !renote ? 
    `<li data-id="${note.id}">
      <span class="wrap"><span class="name" title="${formatted.plainName}">${formatted.name}</span><span class="text">${formatted.text}${formatted.fileCount}</span></span><a href="${currentOrigin}/notes/${note.id}" class="time" target="_blank" rel=”noopener”>${formatted.time}</a>
    </li>
    `
    :
    `<li data-id="${note.id}">
      <div class="renote-info">
        <span class="wrap"><span class="name" title="${formatted.plainName}">${formatted.name}</span><span class="text">${formatted.text}${formatted.fileCount}</span></span><a href="${currentOrigin}/notes/${note.id}" class="time" target="_blank" rel=”noopener”>${formatted.time}</a>
      </div>
      <div class="renoted-note">
        <span class="wrap"><span class="name" title="${formatted.plainRnName}">${formatted.rnName}</span><span class="text">${formatted.rnText}${formatted.rnFileCount}</span></span><a href="${currentOrigin}/notes/${renote.id}" class="time" target="_blank" rel=”noopener”>${formatted.rnTime}</a>
      </div>
    </li>
    `;
    return html;
  };

  const makeHTMLFromNoteForMedia = async (note, target) => {
    note.isRenote = Boolean(note.renoteId);
    const renote = note.isRenote ? note.renote : null;
    const targetNote = target === 'note' && note || target === 'renote' && renote;
    const firstFile = targetNote.files[0];
    const formatted = {
      text:      await makeTextHTMLFromNote(targetNote, renote && renote.host),
      plainText: (note => {return note.cw ? note.cw : note.text ? note.text.replace(/\n/g, '') : ''})(targetNote),
      fileCount: (note => {return note.fileIds.length > 1 ? `<span class="more-file-count">+ ${note.fileIds.length - 1}</span>` : '';})(targetNote),
    };
    const html = firstFile.type.includes('image') || firstFile.type.includes('video') ?
    `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''}>
      <a href="${currentOrigin}/notes/${note.id}" class="link" target="_blank" rel=”noopener”>
        <img src="${firstFile.thumbnailUrl || ''}" alt="${firstFile.comment || firstFile.name}" class="${firstFile.isSensitive || (targetNote.cw) ? 'is-sensitive' : ''}">
        ${firstFile.type.includes('video') ? '<span class="is-video">動画</span>' : ''}
        ${formatted.fileCount}
      </a>${formatted.text &&`
      <div class="text" title="${formatted.plainText}">
        ${formatted.text}
      </div>`}
    </li>
    `
    : firstFile.type.includes('audio') ?
    `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''}>
      <a href="${currentOrigin}/notes/${note.id}" class="link" target="_blank" rel=”noopener”>
        <span class="file-type">音声</span>
        ${formatted.fileCount}
      </a>${formatted.text &&`
      <div class="text" title="${formatted.plainText}">
        ${formatted.text}
      </div>`}
    </li>
    `
    : 
    `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''}>
      <a href="${currentOrigin}/notes/${note.id}" class="link" target="_blank" rel=”noopener”>
        <span class="file-type">その他:${firstFile.type}</span>
        ${formatted.fileCount}
      </a>${formatted.text &&`
      <div class="text" title="${formatted.plainText}">
        ${formatted.text}
      </div>`}
    </li>
    `;
    return html;
  };

  Node.prototype.appendToTl = async function(noteOrNotes) {
    if (this !== noteList && this !== renoteList && this !== mediaList && this !== rnMediaList) {
      return false;
    }
    // console.log(note);
    const isNote = !Array.isArray(noteOrNotes);
    let html = '';
    if (this === noteList || this === renoteList ) {
      if (isNote) {
        const note = noteOrNotes;
        html = await makeHTMLFromNote(note);
      } else {
        const notes = noteOrNotes;
        while (notes.length) {
          html += await makeHTMLFromNote(notes.shift());
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
      if (isNote) {
        const note = noteOrNotes;
        const target = this === mediaList && 'note' || this === rnMediaList && 'renote';
        if (target == 'renote') {
          const alreadyRN = rnMediaList.querySelector(`[data-rn-id="${note.renoteId}"]`);
          alreadyRN && alreadyRN.remove();
        }
        html = await makeHTMLFromNoteForMedia(note, target);
      } else {
        const notes = noteOrNotes;
        const latestRenotes = [];
        const target = this === mediaList && 'note' || this === rnMediaList && 'renote';
        if (target === 'renote') {
          const renoteIds = new Set(notes.map(note => note.renoteId));
          renoteIds.forEach(renoteId => {
            latestRenotes.push(notes.findLast(note => note.renoteId === renoteId));
            const alreadyRN = rnMediaList.querySelector(`[data-rn-id="${renoteId}"]`);
            alreadyRN && alreadyRN.remove();
          });
          console.log('stored rnMedia length:', notes.length, '\nlatest rnMedia length:', latestRenotes.length);
          notes.length = 0;
        }
        (async notes => {
          while (notes.length) {
            const note = notes.shift();
            // console.log('note shifted, notes count:', notes.length);
            html = `${await makeHTMLFromNoteForMedia(note, target)}${html}`;
          }
        })(target === 'note' && notes || target === 'renote' && latestRenotes);
      }
      this.insertAdjacentHTML('afterbegin', html);
      if (autoShowNew[this === mediaList && 'medium' || this === rnMediaList && 'rnMedium']) {
        this.parentElement.scrollTop = 0;
      }
      const img = this.querySelector('img');
      if (img && img.src !== '') {
        img.addEventListener('load', () => {
          if (this === mediaList) {
            mediaMG.positionItems();
          } else if (this === rnMediaList) {
            rnMediaMG.positionItems();
          }
        });
      } else {
        if (this === mediaList) {
          mediaMG.positionItems();
        } else if (this === rnMediaList) {
          rnMediaMG.positionItems();
        }
      }
      while (this.querySelectorAll('li').length > noteLimit) {
        this.lastElementChild.remove();
      }
    }
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
  });

  hTimeline.on('note', async note => {
    // console.log(note);
    const isRenote = Boolean(note.renoteId);
    const kind = !isRenote ? 'note' : 'renote';
    if (autoShowNew[kind]) {
      if (!isRenote) {
        await noteList.appendToTl(note);//RN以外
      }else {
        await renoteList.appendToTl(note);//RN
      }
    } else {
      stored[`${kind}s`].push(note);
      // console.log(kind + ' pushed, stored ' + kind +'s count:',stored[`${kind}s`].length);
      if (stored[`${kind}s`].length > noteLimit) {
        stored[`${kind}s`] = stored[`${kind}s`].slice(-noteLimit);
      }
    }
    // const mediumKind = !isRenote ? ['medium', 'media'] : ['rnMedium', 'rnMedia'];
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
        stored.rnMedia.push(note);
        // console.log('rnMedia pushed, stored rnMedia count:',stored.rnMedia.length);
        if (stored.rnMedia.length > noteLimit) {
          stored.rnMedia = stored.rnMedia.slice(-noteLimit);
        }
      }
    }
  });

  const textToggleHandler = e => {
    if (e.target.closest('.wrap')) {
      e.target.closest('.wrap').classList.toggle('is-open');
    }
  }

  noteList.addEventListener('click', textToggleHandler);
  renoteList.addEventListener('click', textToggleHandler);

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

  notelatestBtn.addEventListener('click', latestBtnHandler);
  renotelatestBtn.addEventListener('click', latestBtnHandler);
  mediumlatestBtn.addEventListener('click', latestBtnHandler);
  rnMediumlatestBtn.addEventListener('click', latestBtnHandler);

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
            } else if (containerRole === 'renotes') {
              await rnMediaList.appendToTl(stored.rnMedia);//RNMedia
            }
          }
          autoShowNew[containerRole === 'media' && 'medium' || containerRole === 'rn-media' && 'rnMedium'] = true;
          latestBtn.classList.remove('show');
        }
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    const keyName = event.key;

    if (keyName === 'Escape') {
      hTimeline.dispose();
      alert('Escキーが押されたため、タイムラインの受信を停止しました。');
    }
  });
});