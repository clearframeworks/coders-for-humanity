import { PageIntro } from "@/components/ui";
import { LoginForm } from "@/components/login-form";
import { isDemo, configured } from "@/lib/supabase";
import { safeNext } from "@/lib/filters";
import Link from "next/link";
import { githubAuthEnabled } from "@/lib/account-readiness";
export const metadata = { title: "Join the work" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const p = await searchParams;
  const disabled = isDemo() || !configured();
  const next = safeNext(p.next);
  const joining = next.split(/[?#]/, 1)[0] === "/join";
  return (
    <div className="page-content">
      <PageIntro
        eyebrow="WELCOME TO THE WORK"
        title={joining ? "Join the community." : "A contribution begins with you."}
      >
        {joining
          ? "Verify your email to create an account or sign in. Then finish your contributor profile."
          : "Read everything publicly. Sign in to claim work, submit a proposal, and keep a meaningful record of your contributions."}
      </PageIntro>
      {disabled && (
        <div className="notice">
          Member accounts are not connected yet. Explore the public work,
          prepare a local draft, and review the founding tasks. Shared posting
          and task claiming open after identity and permissions are verified.
        </div>
      )}
      {p.error && (
        <div className="notice error" role="alert">
          The sign-in link could not be verified. Please request a new link.
        </div>
      )}
      <LoginForm next={next} intent={joining ? "signup" : "signin"} disabled={disabled} githubEnabled={githubAuthEnabled(process.env.CFH_GITHUB_AUTH_ENABLED)} />
      <p className="auth-create-link">
        New to the community? <Link href="/join">Create your profile →</Link>
      </p>
    </div>
  );
}
