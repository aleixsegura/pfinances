import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  title?: ReactNode;
  /** A small link in the header corner ("All holdings →"). */
  action?: { to: string; label: string };
  children: ReactNode;
  className?: string;
  /** Tighter padding for dense list cards. */
  dense?: boolean;
}

/** The dashboard/transactions card: shared header, padding and the `card`
 * surface recipe from index.css. */
export default function Card({ title, action, children, className = "", dense = false }: Props) {
  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      {(title || action) && (
        <header className="card-head flex items-baseline justify-between gap-3 px-5 py-2">
          {title && (
            <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-secondary">{title}</h2>
          )}
          {action && (
            <Link
              to={action.to}
              className="whitespace-nowrap text-[12.5px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {action.label} →
            </Link>
          )}
        </header>
      )}
      <div className={`flex min-w-0 flex-1 flex-col ${dense ? "px-5 py-4" : "px-6 py-5"}`}>{children}</div>
    </section>
  );
}
