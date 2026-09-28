import { z } from "zod";
import { profileSchema } from "./validation";

export type ProfileDraft = z.infer<typeof profileSchema>;
export const emptyProfile: ProfileDraft = {
  name: "",
  username: "",
  bio: "",
  location: "",
  availability: "",
  github_url: "",
  website_url: "",
  is_public: false,
};
export const profileDraftKey = "cfh-profile-draft-v1";
// Incomplete fields are allowed in a draft, but storage never supplies authority.
const draftSchema = profileSchema.extend({
  username: z.string().max(40),
  name: z.string().max(100),
  github_url: z.string().max(2000),
  website_url: z.string().max(2000),
});
const envelope = z.object({
  version: z.literal(1),
  profile: draftSchema,
  step: z.number().int().min(0).max(2),
});
export function readProfileDraft(raw: string | null) {
  if (!raw || raw.length > 18000) return null;
  try {
    const result = envelope.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
