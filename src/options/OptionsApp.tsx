import { useEffect, useState } from 'react';

import { clearAllCovers, clearAllEnhancements, getStorageStats } from '../data/database';
import { loadSettings, saveSettings } from '../data/settings';
import type { UserSettings } from '../types/bookmark';

interface Stats {
  coverCount: number;
  coverBytes: number;
  metaCount: number;
}

export function OptionsApp() {
  const [settings, setSettings] = useState<UserSettings>();
  const [stats, setStats] = useState<Stats>();
  const [status, setStatus] = useState<string>();

  const refreshStats = async (): Promise<void> => setStats(await getStorageStats());

  useEffect(() => {
    void Promise.all([loadSettings(), getStorageStats()]).then(([nextSettings, nextStats]) => {
      setSettings(nextSettings);
      setStats(nextStats);
    });
  }, []);

  const update = async (changes: Partial<UserSettings>): Promise<void> => {
    const next = await saveSettings(changes);
    setSettings(next);
    setStatus('设置已保存');
  };

  const clearCovers = async (): Promise<void> => {
    if (!window.confirm('删除全部本地封面？Chrome 原生书签不会被删除。')) return;
    await clearAllCovers();
    await refreshStats();
    setStatus('本地封面已清除，原生书签保持不变。');
  };

  const clearEnhancements = async (): Promise<void> => {
    if (!window.confirm('删除全部本地封面、标签和增强元数据？Chrome 原生书签不会被删除。')) return;
    await clearAllEnhancements();
    await refreshStats();
    setStatus('本地增强数据已清除，原生书签保持不变。');
  };

  if (!settings || !stats) return <main className="options-loading">正在加载设置…</main>;

  return (
    <main className="options-page" data-theme="dark">
      <header className="options-hero">
        <span className="options-logo">V</span>
        <div><h1>Visual Bookmark</h1><p>让 Chrome 原生书签拥有可识别的网页封面。</p></div>
      </header>

      {!settings.onboardingComplete ? (
        <section className="onboarding-card">
          <span>首次使用</span>
          <h2>从工具栏打开 Visual Bookmark</h2>
          <p>请在 Chrome 扩展菜单中固定 Visual Bookmark。点击图标会打开扩展专属侧边栏，并临时授权读取当前页面。Chrome 自带的“书签”侧边栏不会被修改。</p>
          <button type="button" onClick={() => void update({ onboardingComplete: true })}>我知道了</button>
        </section>
      ) : null}

      <section className="settings-section">
        <div className="settings-section__heading"><h2>外观与行为</h2><p>这些小型设置可通过 Chrome Sync 同步。</p></div>
        <div className="setting-row">
          <div><strong>主题</strong><span>与 Visual Bookmark 的深色界面保持一致。</span></div>
          <span className="setting-value">深色</span>
        </div>
        <label className="setting-row">
          <div><strong>默认在新标签页打开</strong><span>关闭时，普通点击会替换当前标签页。</span></div>
          <input type="checkbox" checked={settings.openInNewTab} onChange={(event) => void update({ openInNewTab: event.target.checked })} />
        </label>
        <label className="setting-row">
          <div><strong>显示文件夹标签</strong><span>极窄侧边栏会自动隐藏。</span></div>
          <input type="checkbox" checked={settings.showFolderBadge} onChange={(event) => void update({ showFolderBadge: event.target.checked })} />
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-section__heading"><h2>本地存储</h2><p>封面不会上传或通过扩展服务器同步。</p></div>
        <div className="storage-grid"><div><strong>{stats.coverCount}</strong><span>本地封面</span></div><div><strong>{formatBytes(stats.coverBytes)}</strong><span>封面空间</span></div><div><strong>{stats.metaCount}</strong><span>增强记录</span></div></div>
        <button className="outline-danger" type="button" onClick={() => void clearCovers()}>清除全部本地封面</button>
        <button className="outline-danger" type="button" onClick={() => void clearEnhancements()}>清除全部本地增强数据</button>
      </section>

      <section className="settings-section privacy-copy">
        <div className="settings-section__heading"><h2>隐私与权限</h2></div>
        <p>书签权限用于读取和维护 Chrome 原生书签。网站访问权限用于捕获当前页面截图，并在你点击“重新加载全部网站封面”时读取书签网站公开的预览图；不会读取表单或 Cookie。截图、标签和增强元数据只保存在本机。</p>
        <p>扩展不读取 Cookie，不采集分析数据，不向开发者服务器上传浏览记录或截图。</p>
      </section>
      {status ? <div className="options-toast" role="status">{status}</div> : null}
    </main>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
