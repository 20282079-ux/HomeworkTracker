// auth.config.js — tells Convex how to verify the session JWTs issued by
// Convex Auth (see @convex-dev/auth docs).
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
