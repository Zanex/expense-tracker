import NextAuth from "next-auth";

import { authConfig } from "./config";

const { auth, handlers, signIn, signOut } = NextAuth(authConfig);

export { auth, handlers, signIn, signOut };
