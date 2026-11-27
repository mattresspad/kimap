import { cp, mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function copyNotices(root, site) {
  const output = join(site, "notices");
  await mkdir(output, { recursive: true });
  for (const [source, name] of [
    ["LICENSE", "KiMap-MIT.txt"],
    ["LICENSING.md", "Licensing.md"],
    ["libs/Exo2/OFL.txt", "Exo2-OFL.txt"],
    ["libs/tga-codec-main/LICENSE", "TGA-MIT.txt"]
  ]) {
    await cp(join(root, source), join(output, name));
  }
  const { packages } = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  for (const [location, metadata] of Object.entries(packages)) {
    if (!location || metadata.dev || metadata.optional) continue;
    const directory = join(root, location);
    const notices = (await readdir(directory)).filter((name) =>
      /^(licen[cs]e|copying|notice)([.-].+)?$/i.test(name)
    );
    for (const notice of notices) {
      const prefix = location.replaceAll("node_modules/", "").replaceAll("/", "-");
      await cp(join(directory, notice), join(output, prefix + "-" + notice));
    }
  }
}
