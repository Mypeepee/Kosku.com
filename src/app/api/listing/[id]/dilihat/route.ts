// app/api/listing/[id]/dilihat/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = BigInt(params.id); // sesuaikan dengan tipe id_property (BigInt)

    await prisma.listing.update({
      where: { id_property: id },
      data: {
        dilihat: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ Error increment view:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
