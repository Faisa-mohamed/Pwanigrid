import { Construction } from "lucide-react";

export default function ComingSoon({ title, uses }) {
  return (
    <>
      <div className="page-head"><h1>{title}</h1></div>
      <section className="card">
        <div className="empty">
          <Construction size={36} />
          <strong>This page is built in the next step</strong>
          <p>It will use the existing backend: <code>{uses}</code></p>
        </div>
      </section>
    </>
  );
}
