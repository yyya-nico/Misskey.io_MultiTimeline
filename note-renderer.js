import { parseSimple as mfmParseSimple } from 'mfm-js';
import { htmlspecialchars, nl2br, fromNow } from './utils';

export const createNoteRenderer = ({ origin, emojiStore }) => {
  const simpleMfmToHTML = async (text, host) => {
    if (!text) {
      return '';
    }
    const parsedMfm = mfmParseSimple(text);
    let html = '';
    for (const node of parsedMfm) {
      switch (node.type) {
        case 'emojiCode': {
          const emojiUrl = await emojiStore.emojiShortcodeToUrl(node.props.name, host);
          if (emojiUrl === null) {
            html += `:${node.props.name}:`;
          } else {
            html += `<img class="custom-emoji" src="${emojiUrl}" alt=":${node.props.name}:" title=":${node.props.name}:">`;
          }
          break;
        }
        case 'text':
          html += nl2br(node.props.text);
          break;
        case 'unicodeEmoji':
          html += node.props.emoji;
          break;
      }
    }
    return html;
  };

  const makeTextHTMLFromNote = async (note, host) => {
    if (note.cw !== null) {
      return `[CW]${await simpleMfmToHTML(htmlspecialchars(note.cw), host)} <span class="cwtext">${await simpleMfmToHTML(htmlspecialchars(note.text), host)}</span>`;
    } else if (note.text) {
      return await simpleMfmToHTML(htmlspecialchars(note.text), host);
    } else if (note.renoteId || note.fileIds.length) {
      return '';
    }
    return '<span class="nothing">なにもありません</span>';
  };

  const detectSensitiveFile = note => note.files.some(file => file.isSensitive);

  const makeHTMLFromNote = async (note, target) => {
    note.isRenote = Boolean(note.renoteId);
    note.host = note.user.host;
    const renote = note.isRenote ? note.renote : null;
    if (renote) {
      renote.host = renote.user.host;
    }
    const formatted = {
      name: note.user.name ? await simpleMfmToHTML(note.user.name, note.host) : note.user.username,
      plainName: note.user.name ? note.user.name : note.user.username,
      text: await makeTextHTMLFromNote(note, note.host),
      fileCount: note.fileIds.length ? `<span class="file-count">[${note.fileIds.length}つのファイル]</span>` : '',
      time: new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      containsSensitive: detectSensitiveFile(note) || (renote && detectSensitiveFile(renote)) ? 'contains-sensitive' : '',
      ...(target === 'renote' && {
        rnName: renote.user.name ? await simpleMfmToHTML(renote.user.name, renote.host) : renote.user.username,
        plainRnName: renote.user.name ? renote.user.name : renote.user.username,
        rnText: await makeTextHTMLFromNote(renote, renote.host),
        rnFileCount: renote.fileIds.length ? `<span class="file-count">[${renote.fileIds.length}つのファイル]</span>` : '',
        rnTime: fromNow(new Date(renote.createdAt))
      })
    };

    if (target === 'note') {
      return `<li data-id="${note.id}" class="${formatted.containsSensitive}">
      <span class="wrap"><span class="name" title="${formatted.plainName}">${formatted.name}</span><span class="text">${formatted.text}${formatted.fileCount}</span></span><a href="${origin}/notes/${note.id}" class="time" target="misskey" rel="noopener">${formatted.time}</a>
    </li>
    `;
    }
    if (target === 'renote') {
      return `<li data-id="${note.id}" class="${formatted.containsSensitive}">
      <div class="renote-info">
        <span class="wrap"><span class="name" title="${formatted.plainName}">${formatted.name}</span><span class="text">${formatted.text}${formatted.fileCount}</span></span><a href="${origin}/notes/${note.id}" class="time" target="misskey" rel="noopener">${formatted.time}</a>
      </div>
      <div class="renoted-note">
        <span class="wrap"><span class="name" title="${formatted.plainRnName}">${formatted.rnName}</span><span class="text">${formatted.rnText}${formatted.rnFileCount}</span></span><a href="${origin}/notes/${renote.id}" class="time" target="misskey" rel="noopener">${formatted.rnTime}</a>
      </div>
    </li>
    `;
    }
    return false;
  };

  const makeHTMLFromNoteForMedia = async (note, target) => {
    note.isRenote = Boolean(note.renoteId);
    note.host = note.user.host;
    const renote = note.isRenote ? note.renote : null;
    if (renote) {
      renote.host = renote.user.host;
    }
    const targetNote = (target === 'note' && note) || (target === 'renote' && renote);
    const firstFile = targetNote.files[0];
    const formatted = {
      text: await makeTextHTMLFromNote(targetNote, targetNote.host),
      fileCount: targetNote.fileIds.length > 1 ? `<span class="more-file-count">+ ${targetNote.fileIds.length - 1}</span>` : '',
      containsSensitive: detectSensitiveFile(targetNote) || targetNote.cw !== null ? 'contains-sensitive' : ''
    };

    if (firstFile.type.includes('image') || firstFile.type.includes('video')) {
      return `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''} class="${formatted.containsSensitive}">
      <a href="${origin}/notes/${note.id}" class="link" target="misskey" rel="noopener">
        <img src="${firstFile.thumbnailUrl || ''}" alt="${firstFile.comment || firstFile.name}" class="${firstFile.isSensitive || targetNote.cw !== null ? 'is-sensitive' : ''}" ${firstFile.type.includes('image') ? `width="${firstFile.properties.width}" height="${firstFile.properties.height}"` : ''}>
        ${firstFile.type.includes('video') ? '<span class="is-video">動画</span>' : ''}
        ${formatted.fileCount}
      </a>${formatted.text && `
      <div class="text">
        ${formatted.text}
      </div>`}
    </li>
    `;
    }
    if (firstFile.type.includes('audio')) {
      return `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''} class="${formatted.containsSensitive}">
      <a href="${origin}/notes/${note.id}" class="link" target="misskey" rel="noopener">
        <span class="file-type">音声</span>
        ${formatted.fileCount}
      </a>${formatted.text && `
      <div class="text">
        ${formatted.text}
      </div>`}
    </li>
    `;
    }
    return `<li data-id="${note.id}" ${renote ? `data-rn-id="${renote.id}"` : ''} class="${formatted.containsSensitive}">
      <a href="${origin}/notes/${note.id}" class="link" target="misskey" rel="noopener">
        <span class="file-type">その他:${firstFile.type}</span>
        ${formatted.fileCount}
      </a>${formatted.text && `
      <div class="text">
        ${formatted.text}
      </div>`}
    </li>
    `;
  };

  return {
    simpleMfmToHTML,
    makeTextHTMLFromNote,
    makeHTMLFromNote,
    makeHTMLFromNoteForMedia,
    detectSensitiveFile
  };
};
