import { useEffect, useMemo, useState } from 'react';

import { getDuplicateChoices, saveVisualBookmark } from '../services/visualBookmark';
import type { BookmarkViewModel, CaptureResult } from '../types/bookmark';
import { Modal } from './Modal';

interface CaptureDialogProps {
  capture: CaptureResult;
  folders: BookmarkViewModel[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function CaptureDialog({ capture, folders, onClose, onSaved }: CaptureDialogProps) {
  const [title, setTitle] = useState(capture.metadata.title);
  const [parentId, setParentId] = useState('');
  const [tags, setTags] = useState('');
  const [targetBookmarkId, setTargetBookmarkId] = useState('');
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; title: string; parentId?: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getDuplicateChoices(capture.metadata.url).then((choices) => {
      setDuplicates(choices);
      if (choices.length === 1) setTargetBookmarkId(choices[0]?.id ?? '');
    });
  }, [capture.metadata.url]);

  const previewUrl = useMemo(() => capture.screenshotDataUrl, [capture.screenshotDataUrl]);

  const save = async (): Promise<void> => {
    if (!title.trim()) {
      setError('标题不能为空。');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const result = await saveVisualBookmark({
        capture,
        title: title.trim(),
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        ...(parentId ? { parentId } : {}),
        ...(targetBookmarkId ? { targetBookmarkId } : {}),
      });
      const action = result.updatedExisting ? '已更新已有书签' : '已收藏当前页面';
      onSaved(result.coverSaved || !capture.screenshotDataUrl
        ? action
        : `${action}，但封面保存失败`);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="收藏当前页面"
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>
            {saving ? '正在保存…' : targetBookmarkId ? '更新书签' : '保存书签'}
          </button>
        </>
      }
    >
      <div className="capture-preview">
        {previewUrl ? <img src={previewUrl} alt="当前网页截图预览" /> : (
          <div className="capture-preview__empty">当前页面无法截图，将使用占位封面。</div>
        )}
      </div>
      <label className="field">
        <span>标题</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      {duplicates.length ? (
        <label className="field">
          <span>发现相同网址</span>
          <select value={targetBookmarkId} onChange={(event) => setTargetBookmarkId(event.target.value)}>
            <option value="">仍然创建副本</option>
            {duplicates.map((choice) => (
              <option key={choice.id} value={choice.id}>更新：{choice.title}</option>
            ))}
          </select>
        </label>
      ) : null}
      {!targetBookmarkId ? (
        <label className="field">
          <span>文件夹</span>
          <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">其他书签（默认）</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {[...folder.folderPath, folder.title].join(' / ')}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field">
        <span>标签（逗号分隔）</span>
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="待读, 产品灵感" />
      </label>
      <p className="field-hint">{capture.metadata.url}</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </Modal>
  );
}

