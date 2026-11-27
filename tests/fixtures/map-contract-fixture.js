import { REQUIRED_DATASET_KEYS } from "../../modules/map-contract.js";

export function createMapContractFixture({ manifestId = "vanilla" } = {}) {
  const datasets = Object.fromEntries(
    REQUIRED_DATASET_KEYS.map((key) => [
      key,
      {
        url: `/data/vanilla/test/${key}.json`,
        required: true,
        pattern: `${key}_*.json`
      }
    ])
  );

  const getmapdata = {
    contractVersion: 3,
    userData: {
      isLoggedIn: false,
      name: "Anonymous",
      manifestId
    },
    manifest: {
      id: manifestId,
      title: "Test Manifest",
      description: "Deterministic contract fixture",
      kenshiVersion: "fixture",
      activeMods: [],
      bundledDate: null
    },
    datasets,
    assets: {
      buildingLocations: {
        url: "/data/vanilla/test/building_locations.json",
        required: true,
        source: "vanilla"
      },
      roadNetwork: {
        url: "/data/overlays/Vanilla_RoadNetwork.svg",
        required: false,
        source: "vanilla"
      },
      areasMap: {
        url: null,
        required: false,
        source: null
      }
    }
  };

  return { getmapdata };
}
