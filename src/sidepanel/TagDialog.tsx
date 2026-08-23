import { useState } from 'react';

import { addBookmarkTags } from '../services/enhancements';
import type { BookmarkViewModel } from '../types/bookmark';
import { Modal } from './Modal';

interface TagDialogProps {
  bookmarks: BookmarkViewModel[];
  onClose: () => void;
  onSaved: () => void;
}

export function TagDialog({ bookmarks, onClose, onSaved }: TagDialogProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const save = async (): Promise<void> => {
    const tags = value.split(',');
    if (!tags.some((tag) => tag.trim())) return setError('至少输入一个标签。');
    setSaving(true);
    setError(undefined);
    try {
      await addBookmarkTags(bookmarks, tags);
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '添加标签失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`为 ${bookmarks.length} 个书签添加标签`}
      onClose={onClose}
      footer={<>
        <button className="secondary-button" type="button" onClick={onClose}>取消</button>
        <button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '添加标签'}</button>
      </>}
    >
      <label className="field"><span>标签（逗号分隔，保留已有标签）</span><input autoFocus value={value} placeholder="待读, 工作" onChange={(event) => setValue(event.target.value)} /></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </Modal>
  );
}
