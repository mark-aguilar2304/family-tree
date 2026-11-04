import { redirect } from "next/navigation";

export default async function FamilyIndexPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  redirect(`/families/${familyId}/tree`);
}
