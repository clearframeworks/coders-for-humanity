import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-content">
      <div className="eyebrow">404 / RECORD NOT FOUND</div>
      <h1>This page isn’t in the public record.</h1>
      <p>The link may have changed, or the record may not be public.</p>
      <Link className="button primary" href="/search">
        Search the institution →
      </Link>
    </div>
  );
}
