import { getSessionFromRequest } from "@/utils/auth";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    const session = await getSessionFromRequest(context.request);
    if (session && session.user) {
        context.locals.user = session.user;
        context.locals.session = session.session;
    } else {
        context.locals.user = null;
        context.locals.session = null;
    }
    return next();
});
