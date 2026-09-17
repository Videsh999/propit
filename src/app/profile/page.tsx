import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = {
  title: "Your profile",
  description: "Saved homes, saved searches, your anchors and recently viewed properties.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <main>
      <ProfileView />
    </main>
  );
}
