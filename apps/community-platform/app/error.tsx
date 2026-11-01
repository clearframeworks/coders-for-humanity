"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <div className="page-content">
      <h1>We couldn’t load this record.</h1>
      <p>
        Please try again. If the problem continues, the platform connection may
        need attention.
      </p>
      <button className="button primary" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
