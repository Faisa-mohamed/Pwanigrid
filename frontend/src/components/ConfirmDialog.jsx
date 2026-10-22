import Modal from "./Modal";

export default function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger, busy, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel}>
      <p>{message}</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
