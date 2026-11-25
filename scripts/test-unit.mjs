import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function tests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? tests(`${directory}/${entry.name}`)
        : entry.name.endsWith(".test.mjs") &&
            !entry.name.endsWith("http.test.mjs")
          ? [`${directory}/${entry.name}`]
          : [],
    ),
  );
  return files.flat();
}
const files = (await tests("lib")).sort();
const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
