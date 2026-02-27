export const createAppState = () => {
  const ioOrigin = 'https://misskey.io';
  const originToHost = origin => origin.replace('https://', '');

  const state = {
    currentOrigin: null,
    host: null,
    authInfo: null,
    timelineIndex: 1
  };

  const initOrigin = (domRefs, defaultHostText, defaultTitle) => {
    if (localStorage.getItem('tlOrigin')) {
      state.currentOrigin = localStorage.getItem('tlOrigin');
      state.host = originToHost(state.currentOrigin);
      document.title = `${state.host} マルチタイムライン(連携対応版)`;
      domRefs.hostTextWraps.forEach(hostTextWrap => {
        hostTextWrap.textContent = state.host;
      });
      domRefs.customHost.value = state.host;
      domRefs.configFrame.classList.add('customized-host');
    } else {
      state.currentOrigin = ioOrigin;
      state.host = originToHost(state.currentOrigin);
      document.title = defaultTitle;
      domRefs.hostTextWraps.forEach(hostTextWrap => {
        hostTextWrap.textContent = defaultHostText;
      });
      domRefs.customHost.value = '';
      domRefs.configFrame.classList.remove('customized-host');
    }
    if (localStorage.getItem('tlIndex')) {
      state.timelineIndex = parseInt(localStorage.getItem('tlIndex'), 10);
    } else {
      state.timelineIndex = 1;
    }
    domRefs.selectTimeline.value = state.timelineIndex;
    domRefs.misskeyLink.querySelector('a').href = state.currentOrigin;
    domRefs.keepEmojis.checked = !!localStorage.getItem(`tlEmojis${state.host}`);
    return state;
  };

  const initAuth = (authInfo, domRefs) => {
    state.authInfo = authInfo;
    if (authInfo) {
      const disabledOptions = domRefs.selectTimeline.querySelectorAll(':disabled');
      disabledOptions.forEach(option => (option.disabled = false));
      domRefs.authenticateLabel.textContent = `@${authInfo.user.username}に接続`;
      domRefs.authenticateBtn.textContent = '切断';
    } else {
      const disabledOptions = domRefs.selectTimeline.querySelectorAll('[value="0"], [value="2"]');
      disabledOptions.forEach(option => (option.disabled = true));
      if (state.timelineIndex === 0 || state.timelineIndex === 2) {
        state.timelineIndex = 1;
        domRefs.selectTimeline.value = state.timelineIndex;
        localStorage.removeItem('tlIndex');
      }
      domRefs.authenticateLabel.textContent = '認証してHTLとSTLも見る';
      domRefs.authenticateBtn.textContent = '認証';
    }
    return state;
  };

  return {
    state,
    ioOrigin,
    originToHost,
    initOrigin,
    initAuth
  };
};
