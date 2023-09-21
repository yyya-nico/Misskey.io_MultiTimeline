import { api as misskeyApi } from 'misskey-js';

const scrollToBottom = node => {
    node.scrollTo({top: node.scrollHeight});
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

const goMiAuth = host => {
  const sessionId = crypto.randomUUID();
  const miAuthUrl = new URL(`https://${host}/miauth/${sessionId}`);
  const miAuthParams = miAuthUrl.searchParams;
  miAuthParams.append('name','マルチタイムライン');
  const callbackUrl = new URL(`${location.origin}/callback`);
  callbackUrl.searchParams.append('host', host);
  miAuthParams.append('callback', callbackUrl.toString());
  location.href = miAuthUrl.toString();
}

const saveToken = async () => {
    const params = new URLSearchParams(location.search);
    history.replaceState(null, null, '/');
    const sessionId = params.get('session');
    const host = params.get('host');
    if (!sessionId || !host) {
        return;        
    }
    const cli = new misskeyApi.APIClient({origin: `https://${host}`});
    await cli.request(`miauth/${sessionId}/check`, {})
      .then(data => {
        if (data.ok) {
          const storedAuths = localStorage.getItem('auths');
          const auths = storedAuths && JSON.parse(storedAuths) || [];
          auths.push({
            host: host,
            token: data.token,
            user: data.user
          });
          localStorage.setItem('auths', JSON.stringify(auths));
        }
      }).catch((e) => {
        console.log(`${host}\'s miauth/{session}/check could not load`);
        console.dir(e);
    });
}

const routing = async () => {
    switch (location.pathname) {
        case '/':
            break;
        case '/callback':
            await saveToken();
            break;
        default:
            alert('指定のURLにはページがありません。');
            history.replaceState(null, null, '/');
    }
}

export {scrollToBottom, htmlspecialchars, fromNow, goMiAuth, routing}