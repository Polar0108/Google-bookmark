import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_appName__',
    description: '__MSG_appDescription__',
    default_locale: 'zh_CN',
    minimum_chrome_version: '116',
    permissions: [
      'activeTab',
      'bookmarks',
      'favicon',
      'scripting',
      'sidePanel',
      'storage',
      'unlimitedStorage',
    ],
    host_permissions: [
      '<all_urls>',
    ],
    action: {
      default_title: '__MSG_openSidePanel__',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});
