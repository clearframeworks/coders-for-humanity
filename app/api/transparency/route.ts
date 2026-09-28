import { ledger } from "@/lib/records";
export async function GET() {
  try {
    const data = await ledger();
    return Response.json(
      {
        schema_version: 1,
        status:
          data.funding.length || data.expenses.length
            ? "published_records"
            : "no_published_records",
        note: "Absence of published records is not a statement of audited zero income or expenses.",
        ...data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "The public ledger is temporarily unavailable." },
      { status: 503 },
    );
  }
}
