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
    <section className={`card flex min-w-0 flex-col ${dense ? "px-5 py-4" : "px-6 py-5"} ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold text-primary">{title}</h2>}
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
      {children}
    </section>
  );
}
