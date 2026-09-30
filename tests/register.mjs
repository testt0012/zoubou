import { register } from "node:module";

// Lets the tests import the app's "@/lib/…" paths as written.
register("./alias-loader.mjs", import.meta.url);
