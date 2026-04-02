import { createTRPCRouter, createCallerFactory } from "~/server/api/trpc";
import { categoryRouter } from "~/server/api/routers/category";
import { expenseRouter } from "~/server/api/routers/expense";
import { reportRouter } from "~/server/api/routers/report";

/**
 * Root router — aggiungere qui i nuovi sub-router man mano che vengono creati.
 * Fase 1: category, expense
 * Fase 2: report
 */
export const appRouter = createTRPCRouter({
  category: categoryRouter,
  expense: expenseRouter,
  report: reportRouter
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);