// Lets plain Node scripts import server modules: "server-only" is provided by Next at build time, so stub it here.
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    return next(specifier, context);
  },
});
