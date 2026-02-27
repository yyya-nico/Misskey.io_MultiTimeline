import { api as misskeyApi } from 'misskey-js';

export const createAuthManager = () => {
  const checkToken = host => {
    const storedAuths = localStorage.getItem('auths');
    if (!storedAuths) {
      return null;
    }
    const auths = JSON.parse(storedAuths);
    return auths.find(entry => entry.host === host) || null;
  };

  const saveAuthInfo = (host, token, user) => {
    const storedAuths = localStorage.getItem('auths');
    const auths = storedAuths ? JSON.parse(storedAuths) : [];
    auths.push({
      host,
      token,
      user
    });
    localStorage.setItem('auths', JSON.stringify(auths));
  };

  const removeAuthInfo = host => {
    const storedAuths = localStorage.getItem('auths');
    if (!storedAuths) {
      return;
    }
    const auths = JSON.parse(storedAuths);
    const newAuths = auths.filter(entry => entry.host !== host);
    localStorage.setItem('auths', JSON.stringify(newAuths));
  };

  const processCallback = async () => {
    const params = new URLSearchParams(location.search);
    history.replaceState(null, null, '/');
    const sessionId = params.get('session');
    const host = params.get('host');
    if (!sessionId || !host) {
      return;
    }
    const cli = new misskeyApi.APIClient({ origin: `https://${host}` });
    await cli
      .request(`miauth/${sessionId}/check`, {})
      .then(data => {
        if (data.ok) {
          saveAuthInfo(host, data.token, data.user);
        }
      })
      .catch(e => {
        console.log(`${host}\'s miauth/{session}/check could not load`);
        console.dir(e);
      });
  };

  return {
    checkToken,
    saveAuthInfo,
    removeAuthInfo,
    processCallback
  };
};
