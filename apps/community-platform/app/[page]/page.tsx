import { notFound } from "next/navigation";
import { institution } from "@/lib/content";
import { ArticlePage } from "@/components/article";
export function generateStaticParams() {
  return Object.keys(institution).map((page) => ({ page }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  return { title: institution[(await params).page]?.title || "Page not found" };
}
export default async function InstitutionPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const article = institution[(await params).page];
  if (!article) notFound();
  return <ArticlePage article={article} />;
}
