import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const suffix of [".ts", ".tsx", "/index.ts", ""]) {
      const file = base + suffix;
      if (existsSync(file) && statSync(file).isFile()) {
        return nextResolve(pathToFileURL(file).href, context);
      }
    }
  }
  // Relative imports written without an extension ("./helpers").
  if (specifier.startsWith("./") && !path.extname(specifier) && context.parentURL) {
    const file = path.join(path.dirname(new URL(context.parentURL).pathname), specifier + ".ts");
    if (existsSync(file)) return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
