import { PageIntro } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { isDemo, configured } from "@/lib/supabase";
import { safeNext } from "@/lib/filters";
export const metadata = { title: "Join the work" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const p = await searchParams;
  const disabled = isDemo() || !configured();
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="WELCOME TO THE WORK"
        title="A contribution begins with you."
      >
        Read everything publicly. Sign in to claim work, submit a proposal, and
        keep a meaningful record of your contributions.
      </PageIntro>
      {disabled && (
        <div className="notice">
          This is a demonstration. Account sign-in is not connected yet. Public
          pages and browser-saved proposal drafts are available.
        </div>
      )}
      {p.error && (
        <div className="notice error" role="alert">
          The sign-in link could not be verified. Please request a new link.
        </div>
      )}
      <LoginForm next={safeNext(p.next)} disabled={disabled} />
    </div>
  );
}
