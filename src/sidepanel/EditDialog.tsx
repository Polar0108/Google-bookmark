import { useState } from 'react';

import { moveBookmark, updateBookmark } from '../data/bookmarks';
import { removeBookmarkCover, saveBookmarkCover, saveBookmarkTags } from '../services/enhancements';
import type { BookmarkViewModel } from '../types/bookmark';
import { getNavigationSafety } from '../utils/url';
import { Modal } from './Modal';

interface EditDialogProps {
  bookmark: BookmarkViewModel;
  folders: BookmarkViewModel[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditDialog({ bookmark, folders, onClose, onSaved }: EditDialogProps) {
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url ?? '');
  const [parentId, setParentId] = useState(bookmark.parentId ?? '');
  const [tags, setTags] = useState(bookmark.meta?.tags.join(', ') ?? '');
  const [coverFile, setCoverFile] = useState<File>();
  const [removeCover, setRemoveCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const save = async (): Promise<void> => {
    if (!title.trim()) return setError('标题不能为空。');
    if (getNavigationSafety(url.trim()) === 'blocked') return setError('请输入可打开的网址；不支持脚本或数据网址。');
    setSaving(true);
    setError(undefined);
    try {
      await updateBookmark(bookmark.id, { title: title.trim(), url: url.trim() });
      if (parentId && parentId !== bookmark.parentId) {
        await moveBookmark(bookmark.id, parentId);
      }
      const updatedBookmark: BookmarkViewModel = {
        ...bookmark,
        title: title.trim(),
        url: url.trim(),
        ...(parentId ? { parentId } : {}),
      };
      await saveBookmarkTags(updatedBookmark, tags.split(','));
      if (coverFile) {
        await saveBookmarkCover(updatedBookmark, await readFileAsDataUrl(coverFile), 'upload');
      } else if (removeCover) {
        await removeBookmarkCover(updatedBookmark);
      }
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="编辑书签"
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="button" disabled={saving || bookmark.isManaged} onClick={() => void save()}>
            {saving ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      {bookmark.isManaged ? <p className="notice">此书签由管理员管理，只能查看。</p> : null}
      <label className="field"><span>标题</span><input value={title} disabled={bookmark.isManaged} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="field"><span>网址</span><input value={url} disabled={bookmark.isManaged} onChange={(event) => setUrl(event.target.value)} /></label>
      <label className="field">
        <span>文件夹</span>
        <select value={parentId} disabled={bookmark.isManaged} onChange={(event) => setParentId(event.target.value)}>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>{[...folder.folderPath, folder.title].join(' / ')}</option>
          ))}
        </select>
      </label>
      <label className="field"><span>标签</span><input value={tags} disabled={bookmark.isManaged} onChange={(event) => setTags(event.target.value)} /></label>
      <label className="field">
        <span>自定义封面（自动裁切为 16:10）</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={bookmark.isManaged}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && file.size > 20 * 1024 * 1024) {
              setError('封面图片不能超过 20 MB。');
              event.target.value = '';
              return;
            }
            setError(undefined);
            setCoverFile(file);
            setRemoveCover(false);
          }}
        />
      </label>
      {bookmark.meta?.coverAssetId && !coverFile ? (
        <label className="field field--check">
          <input type="checkbox" checked={removeCover} disabled={bookmark.isManaged} onChange={(event) => setRemoveCover(event.target.checked)} />
          <span>移除当前封面，改用网站占位图</span>
        </label>
      ) : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </Modal>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('无法读取所选图片。'));
    reader.onerror = () => reject(new Error('无法读取所选图片。'));
    reader.readAsDataURL(file);
  });
}
