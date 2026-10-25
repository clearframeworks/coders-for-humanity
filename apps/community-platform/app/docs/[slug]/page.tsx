import { notFound } from "next/navigation";
import { docs } from "@/lib/content";
import { ArticlePage } from "@/components/article";
export function generateStaticParams() {
  return Object.keys(docs).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return { title: docs[(await params).slug]?.title || "Guide not found" };
}
export default async function Doc({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const article = docs[(await params).slug];
  if (!article) notFound();
  return <ArticlePage article={article} />;
}
