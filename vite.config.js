import { VitePWA } from 'vite-plugin-pwa'

export default {
    base: '/misskey.io-multi-tl/',
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: {
            "theme_color": "#101010",
            "background_color": "#1f1f1f",
            "display": "standalone",
            "start_url": "/misskey.io_multi_tl/",
            "name": "Misskey.io マルチタイムライン",
            "short_name": "マルチTL",
            "description": "見やすいタイムラインを目指しました",
            "dir": "ltr",
            "lang": "ja-JP",
            "icons": [
                {
                    "src": "icon/icon-192x192.png",
                    "sizes": "192x192",
                    "type": "image/png"
                },
                {
                    "src": "icon/icon-256x256.png",
                    "sizes": "256x256",
                    "type": "image/png"
                },
                {
                    "src": "icon/icon-384x384.png",
                    "sizes": "384x384",
                    "type": "image/png"
                },
                {
                    "src": "icon/icon-512x512.png",
                    "sizes": "512x512",
                    "type": "image/png"
                }
            ]
        }
      })
    ]
}