import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileOnboarding } from "@/components/profile-onboarding";
import { communityReady, getViewer } from "@/lib/community";

export const metadata = { title: "Create your profile" };
export default async function Join() {
  const viewer = await getViewer();
  if (viewer?.profile) redirect("/account");
  return (
    <div className="page-content join-page">
      <div className="join-heading">
        <div className="eyebrow">BECOME A CONTRIBUTOR</div>
        <h1>Create your profile.</h1>
        <p>
          Tell people who you are and what you’d like to work on. Start with
          what you know.
        </p>
        {!viewer && (
          <p className="join-existing">
            Already have an account?{" "}
            <Link href="/login?next=/join">Sign in</Link>
          </p>
        )}
      </div>
      {!communityReady() && (
        <div className="notice join-registration-note">
          Registration is being connected. You can prepare and preview your
          profile now; it stays in this browser until you can verify an account.
        </div>
      )}
      <ProfileOnboarding
        connected={communityReady()}
        authenticated={!!viewer}
      />
    </div>
  );
}
