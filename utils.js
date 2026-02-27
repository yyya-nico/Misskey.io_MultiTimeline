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

const nl2br = (text) => {
    return text.replace(/\n/g, "<br>");
};

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

const getDeviceType = () => {
    const ua = navigator.userAgent;
    const is = reg => reg.test(ua);
    const getOsName = () => {
        if (is(/Android/)) {
            return 'Android';
        } else if (is(/Linux/)) {
            return 'Linux';
        } else if (is(/Mac OS X/) && !is(/iPhone OS|CPU OS/)) {
            return 'macOS';
        } else if (is(/Windows/)) {
            return 'Windows';
        } else if (is(/iPhone|iPod/)) {
            return 'iOS';
        } else if (is(/iPad/)) {
            return 'iPadOS';
        } else if (is(/CrOS/)) {
            return 'ChromeOS';
        } else {
            return 'Unknown OS';
        }
    }
    const os = getOsName();
    const betweenText = (start, end) => new RegExp(`(${start})(.*?)(${end})`).exec(ua)[2];
    const getOsVersion = () => {
        switch (os) {
            case 'Android':
                return betweenText('Android ','[.;]');
            case 'macOS':
                return betweenText('Mac OS X ','[;)]').replaceAll('_', '.');
            case 'Windows':
                const ntVersion = Number(betweenText('Windows NT ','[;)]'));
                switch (ntVersion) {
                    case 10.0:
                        return '10(11)';
                    case 6.3:
                        return '8.1';
                    case 6.2:
                        return '8';
                    case 6.1:
                        return '7';
                    case 6.0:
                        return 'Vista';

                    default:
                        if (ntVersion > 10.0) {
                            return '新規のバージョン';
                        } else if (ntVersion < 6.0) {
                            return '以前のバージョン';
                        } else {
                            return '未知のバージョン';
                        }
                }
            case 'iOS':
            case 'iPadOS':
                return betweenText('iPhone;? i?OS |CPU OS ',';? ').replaceAll('_', '.');
            case 'ChromeOS':
                return betweenText('CrOS ',' ');

            default:
                return '';
        }
    }
    const osVersion = getOsVersion();
    const getBrowser = () => {
        if (is(/Edge|Edg/)) {
            return 'Edge';
        } else if (is(/Firefox|FxiOS/)) {
            return 'Firefox';
        } else if (is(/Chrome|CriOS/)) {
            return 'Chrome';
        } else if (is(/iPhone|iPad|iPod|Mac/) && is(/Safari/)) {
            return 'Safari';
        } else if (is(/iPad/)) {
            return 'iPadOS';
        } else {
            return 'Unknown Browser';
        }
    }
    const browser = getBrowser();
    return `${browser} on ${os} ${osVersion}`;
}

const goMiAuth = host => {
  const sessionId = crypto.randomUUID();
  const miAuthUrl = new URL(`https://${host}/miauth/${sessionId}`);
  const miAuthParams = miAuthUrl.searchParams;
  const deviceType = getDeviceType();
  miAuthParams.append('name',`マルチタイムライン via ${deviceType}`);
  const callbackUrl = new URL(`${location.origin}/callback`);
  callbackUrl.searchParams.append('host', host);
  miAuthParams.append('callback', callbackUrl.toString());
  miAuthParams.append('permission', 'read:account');
  location.href = miAuthUrl.toString();
}

const normalizeHostInput = input => {
    if (typeof input !== 'string') {
        return '';
    }
    return input.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

const routing = async (processCallback) => {
    switch (location.pathname) {
        case '/':
            break;
        case '/callback':
            await processCallback();
            break;
        default:
            alert('指定のURLにはページがありません。');
            history.replaceState(null, null, '/');
    }
}

export {scrollToBottom, htmlspecialchars, nl2br, fromNow, goMiAuth, routing, normalizeHostInput}