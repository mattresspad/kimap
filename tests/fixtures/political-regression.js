import { createHash } from "node:crypto";
import {
  createPoliticalAreaIndex,
  createPoliticalEvidenceCatalog,
  createPoliticalRasterProjection,
  evaluatePoliticalInfluence,
  POLITICAL_CONFIDENCE_RULES,
  POLITICAL_SOURCE_MIXES,
  POLITICAL_TOWN_METRICS,
  projectPoliticalEvidence
} from "../../modules/political/index.js";
import { createPoliticalFixture } from "./political-fixture.js";

// Fingerprint only the pre-reporting fields and actual pixels, over 240 evaluations.
export function politicalRegressionDigest() {
  const hash = createHash("sha256");
  for (const variant of ["baseline", "active", "empty-town", "hidden"]) {
    const fixture = createPoliticalFixture();
    if (variant === "active") {
      for (const area of Object.values(fixture.snapshot.world.spawns)) {
        for (const entry of Object.values(area.entries)) entry.status = "Active";
      }
    }
    if (variant === "empty-town") {
      fixture.snapshot.world.towns["town-base"].activeTownId = "town-override";
      fixture.snapshot.world.towns["town-base"].ownerId = "faction-b";
    }
    const areaIndex = createPoliticalAreaIndex({
      raster: fixture.raster,
      spawnAreas: fixture.baseline.spawnAreas
    });
    const catalog = createPoliticalEvidenceCatalog({ baseline: fixture.baseline, areaIndex });
    const projection = projectPoliticalEvidence({ catalog, snapshot: fixture.snapshot });
    for (const townMetric of POLITICAL_TOWN_METRICS) {
      for (const sourceMix of POLITICAL_SOURCE_MIXES) {
        for (const confidenceRule of POLITICAL_CONFIDENCE_RULES) {
          const influence = evaluatePoliticalInfluence({
            projection,
            participantIds: variant === "hidden" ? [] : ["faction-a", "faction-b"],
            townMetric,
            sourceMix,
            confidenceRule
          });
          const areas = influence.areas.map((area) => ({
            ...area,
            contributions: area.contributions.map(({ factionId, score, share, participant }) => ({
              factionId,
              score,
              share,
              participant
            }))
          }));
          hash.update(JSON.stringify(areas));
          hash.update(
            createPoliticalRasterProjection({
              areaIndex,
              influence,
              colorsByFactionId: { "faction-a": "#ff0000", "faction-b": "#00ff00" }
            }).copyRgba()
          );
        }
      }
    }
  }
  return hash.digest("hex");
}
