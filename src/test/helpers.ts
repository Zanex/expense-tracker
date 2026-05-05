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

export function createMockDb() {
  return {
    expense: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    trip: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    investment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    investmentTransaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    vehicle: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vehicleRefuel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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
