import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/captcha";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(createCaptcha());
}
