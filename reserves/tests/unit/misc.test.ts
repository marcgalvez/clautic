import { describe, expect, it } from "vitest";
import { decrypt, encrypt, hmacSha256Hex } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { accessState } from "@/lib/auth/access";
import { verifyMetaSignature } from "@/lib/whatsapp/webhook";

describe("utilitats", () => {
  it("xifra i desxifra", () => {
    const c = encrypt("secret-token");
    expect(c).not.toContain("secret");
    expect(decrypt(c)).toBe("secret-token");
  });
  it("normalitza telèfons", () => {
    expect(normalizePhone("600 11 22 33")).toBe("+34600112233");
    expect(normalizePhone("0034 600112233")).toBe("+34600112233");
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("912345678")).toBeNull(); // fix espanyol: sense WhatsApp
    expect(normalizePhone("abc")).toBeNull();
  });
  it("estat d'accés de l'empresa", () => {
    const now = new Date("2026-11-21T00:00:00Z");
    expect(accessState({ status: "PENDING_APPROVAL" }, null, now)).toBe("PENDING_APPROVAL");
    expect(accessState({ status: "ACTIVE" }, { endsAt: new Date("2026-11-20T00:00:00Z") }, now)).toBe("EXPIRED");
    expect(accessState({ status: "ACTIVE" }, { endsAt: null }, now)).toBe("ACTIVE");
    expect(accessState({ status: "SUSPENDED" }, null, now)).toBe("SUSPENDED");
  });
  it("verifica la signatura dels webhooks de Meta", () => {
    const body = '{"a":1}';
    const sig = "sha256=" + hmacSha256Hex("appsecret", body);
    expect(verifyMetaSignature(body, sig, "appsecret")).toBe(true);
    expect(verifyMetaSignature(body, sig, "other")).toBe(false);
    expect(verifyMetaSignature(body, null, "appsecret")).toBe(false);
  });
});
