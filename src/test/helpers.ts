import { vi } from "vitest";
import { type createTRPCContext } from "~/server/api/trpc";

// ─── Mock Session ─────────────────────────────────────────

export const mockUser = {
  id: "user-test-1",
  name: "Utente Test",
  email: "test@example.com",
  image: null,
};

export const mockSession = {
  user: mockUser,
  expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
};

// ─── Mock Prisma ──────────────────────────────────────────
// Ogni metodo è un vi.fn() — nei test puoi fare .mockResolvedValue(...)

export function createMockDb() {
  return {
    expense: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      $transaction: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

export type MockDb = ReturnType<typeof createMockDb>;

// ─── Context factory ──────────────────────────────────────

export function createTestContext(db: MockDb) {
  return {
    db: db as unknown as Awaited<ReturnType<typeof createTRPCContext>>["db"],
    session: mockSession,
    headers: new Headers(),
  };
}