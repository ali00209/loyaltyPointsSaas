import { NextResponse } from "next/server";

const retired = () =>
  NextResponse.json(
    { error: "Rewards have been replaced by automatic redemption rules" },
    { status: 410 },
  );

export const GET = retired;
export const POST = retired;
export const PUT = retired;
export const DELETE = retired;
