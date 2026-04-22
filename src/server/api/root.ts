import { createTRPCRouter, createCallerFactory } from "~/server/api/trpc";
import { categoryRouter } from "~/server/api/routers/category";
import { expenseRouter } from "~/server/api/routers/expense";
import { reportRouter } from "~/server/api/routers/report";
import { tripRouter } from "~/server/api/routers/trip";
import { investmentRouter } from "~/server/api/routers/investment";

export const appRouter = createTRPCRouter({
  category: categoryRouter,
  expense: expenseRouter,
  report: reportRouter,
  trip: tripRouter,
  investment: investmentRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
