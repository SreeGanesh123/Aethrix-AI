import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="dashboard-page not-found-page">
      <section className="dash-card not-found-card">
        <span className="not-found-code">404</span>
        <span className="card-kicker">Page not found</span>
        <h1>This workspace does not exist.</h1>
        <p>The page may have moved, or the link may be incorrect.</p>
        <Link to="/" className="primary-cta">
          Back to home
        </Link>
      </section>
    </main>
  );
}
