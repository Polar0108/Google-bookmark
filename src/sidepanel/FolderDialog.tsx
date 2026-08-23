import { useState } from 'react';

import { createFolder } from '../data/bookmarks';
import type { BookmarkViewModel } from '../types/bookmark';
import { Modal } from './Modal';

interface FolderDialogProps {
  folders: BookmarkViewModel[];
  initialParentId?: string;
  onClose: () => void;
  onCreated: (folderId: string) => void;
}

export function FolderDialog({ folders, initialParentId, onClose, onCreated }: FolderDialogProps) {
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState(initialParentId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const save = async (): Promise<void> => {
    if (!title.trim()) return setError('文件夹名称不能为空。');
    setSaving(true);
    setError(undefined);
    try {
      const folder = await createFolder(title.trim(), parentId || undefined);
      onCreated(folder.id);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '新建文件夹失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="新建文件夹"
      onClose={onClose}
      footer={<>
        <button className="secondary-button" type="button" onClick={onClose}>取消</button>
        <button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? '新建中…' : '新建'}</button>
      </>}
    >
      <label className="field"><span>名称</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(); }} /></label>
      <label className="field">
        <span>上级文件夹</span>
        <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
          <option value="">其他书签（默认）</option>
          {folders.map((folder) => <option key={folder.id} value={folder.id}>{[...folder.folderPath, folder.title].join(' / ')}</option>)}
        </select>
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </Modal>
  );
}
