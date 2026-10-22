import { Inbox } from "lucide-react";

export default function EmptyState({ title, text, children }) {
  return (
    <div className="empty">
      <Inbox size={36} />
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
