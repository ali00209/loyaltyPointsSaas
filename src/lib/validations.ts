// Barrel for server-side route handlers: schemas plus the NextResponse-based
// `parseBody`. Client components must import from "@/lib/validations/schemas"
// instead — this module reaches next/server, which does not belong in a bundle.
export * from "./validations/schemas";
export { parseBody } from "./validations/parse-body";
