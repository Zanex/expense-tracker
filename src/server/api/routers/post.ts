import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async () => {
      // return ctx.db.post.create({
      //   data: {
      //     name: input.name,
      //     createdBy: { connect: { id: ctx.session.user.id } },
      //   },
      // });
      return null;
    }),

  getLatest: protectedProcedure.query(async () => {
    // const post = await ctx.db.post.findFirst({
    //   orderBy: { createdAt: "desc" },
    //   where: { createdBy: { id: ctx.session.user.id } },
    // });

    // return post ?? null;
    return { id: "mock", name: "Mock Post" };
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
