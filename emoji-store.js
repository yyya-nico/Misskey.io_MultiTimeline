import { api as misskeyApi } from 'misskey-js';

const emojiShortcodeToUrlDic = {};
const originToHost = (origin) => origin.replace('https://', '');

export const createEmojiStore = (origin) => {
  const localHost = originToHost(origin);

  const initEmojis = async () => {
    const host = originToHost(origin);
    const moreThan24HoursHavePassed = Date.now() - Number(localStorage.getItem(`tlEmojis${host}Loaded`)) >= 24 * 60 * 60 * 1000;

    if (localStorage.getItem(`tlEmojis${host}`) && localStorage.getItem(`tlEmojis${host}Loaded`) && !moreThan24HoursHavePassed) {
      emojiShortcodeToUrlDic[host] = JSON.parse(localStorage.getItem(`tlEmojis${host}`));
      console.log('Loaded emojis from cache');
      return;
    }

    emojiShortcodeToUrlDic[host] = {};
    const cli = new misskeyApi.APIClient({ origin });
    await cli
      .request('emojis', {})
      .then((data) => {
        const emojis = data.emojis;
        emojis.forEach((entry) => {
          emojiShortcodeToUrlDic[host][entry.name] = entry.url;
        });
        localStorage.setItem(`tlEmojis${host}`, JSON.stringify(emojiShortcodeToUrlDic[host]));
        localStorage.setItem(`tlEmojis${host}Loaded`, Date.now());
      })
      .catch((e) => {
        console.error('Failed to load Emojis', e);
      });
  };

  const loadAndStoreEmoji = async (name, host) => {
    emojiShortcodeToUrlDic[host] = emojiShortcodeToUrlDic[host] || {};
    const cli = new misskeyApi.APIClient({ origin: `https://${host}` });
    await cli
      .request('emoji', { name: name })
      .then((data) => {
        const isValid = data !== null && (host === localHost || data.localOnly !== true);
        emojiShortcodeToUrlDic[host][name] = isValid ? data.url : null;
      })
      .catch((e) => {
        console.log(`${host}\'s Emoji`, `:${name}:`, 'not found');
        console.dir(e);
        emojiShortcodeToUrlDic[host][name] = null;
      });
  };

  const storeExternalEmojisFromNote = (note) => {
    const host = note.user.host;
    emojiShortcodeToUrlDic[host] = emojiShortcodeToUrlDic[host] || {};
    [note.user.emojis, note.emojis].forEach((emojis) => {
      Object.keys(emojis).forEach((name) => {
        const url = emojis[name];
        emojiShortcodeToUrlDic[host][name] = url;
      });
    });
  };

  const emojiShortcodeToUrl = async (name, host) => {
    const resolvedHost = host || localHost;
    if (!(resolvedHost in emojiShortcodeToUrlDic) || !(name in emojiShortcodeToUrlDic[resolvedHost])) {
      await loadAndStoreEmoji(name, resolvedHost);
    }
    return emojiShortcodeToUrlDic[resolvedHost][name] || null;
  };

  return {
    initEmojis,
    storeExternalEmojisFromNote,
    emojiShortcodeToUrl,
  };
};
