import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Modal
      title={props.title}
      onClose={props.onCancel}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={props.onCancel}>取消</button>
          <button className="danger-button" type="button" disabled={props.busy} onClick={props.onConfirm}>
            {props.busy ? '处理中…' : props.confirmLabel ?? '删除'}
          </button>
        </>
      }
    >
      <p className="confirm-message">{props.message}</p>
    </Modal>
  );
}

