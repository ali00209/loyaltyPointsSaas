// In-memory stand-in for next/headers. Route handlers read the ambient
// request scope through it, so tests drive auth by seeding cookies/headers
// here (see src/test/helpers.ts) instead of booting a Next server.
//
// Every test file registers it with:
//   vi.mock("next/headers", () => import("@/test/next-headers"));

const cookieJar = new Map<string, string>();
const headerBag = new Map<string, string>();

export function resetRequestContext(): void {
  cookieJar.clear();
  headerBag.clear();
}

export function setRequestCookie(name: string, value: string): void {
  cookieJar.set(name, value);
}

export function setRequestHeader(name: string, value: string): void {
  headerBag.set(name.toLowerCase(), value);
}

export async function cookies() {
  return {
    get(name: string) {
      if (!cookieJar.has(name)) return undefined;
      return { name, value: cookieJar.get(name)! };
    },
    getAll() {
      return [...cookieJar].map(([name, value]) => ({ name, value }));
    },
    has(name: string) {
      return cookieJar.has(name);
    },
    set(name: string, value: string) {
      cookieJar.set(name, String(value));
    },
    delete(name: string) {
      cookieJar.delete(name);
    },
  };
}

export async function headers() {
  return {
    get(name: string) {
      return headerBag.get(name.toLowerCase()) ?? null;
    },
    has(name: string) {
      return headerBag.has(name.toLowerCase());
    },
    entries() {
      return headerBag.entries();
    },
    keys() {
      return headerBag.keys();
    },
    values() {
      return headerBag.values();
    },
  };
}

export async function draftMode() {
  return {
    isEnabled: false,
    enable() {},
    disable() {},
  };
}

export async function connection() {
  return {};
}
