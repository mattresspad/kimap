export const MAP_CONTRACT_VERSION = 3;

export const REQUIRED_DATASET_KEYS = Object.freeze([
  "aiPackages",
  "animals",
  "armours",
  "artifacts",
  "bags",
  "biomes",
  "buildings",
  "buildingSwaps",
  "characters",
  "colourSchemes",
  "constants",
  "crossbows",
  "effects",
  "factionCampaigns",
  "factions",
  "gameStarts",
  "items",
  "itemMaterialsWeapon",
  "limbReplacements",
  "mapItems",
  "nestItems",
  "races",
  "research",
  "resources",
  "seasons",
  "spawnAreas",
  "squads",
  "stats",
  "townFcsData",
  "tradeCultures",
  "vendorLists",
  "mapData",
  "weapons",
  "weaponManufacturers",
  "weather",
  "worldStates"
]);

export class MapContractError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = "MapContractError";
    this.code = code;
    this.context = context;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, label, context) {
  if (!isRecord(value)) {
    throw new MapContractError("invalid_metadata", `${label} is missing or malformed.`, context);
  }

  return value;
}

function requireString(value, label, context) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new MapContractError("invalid_metadata", `${label} must be a non-empty string.`, context);
  }

  return value;
}

function requireBoolean(value, label, context) {
  if (typeof value !== "boolean") {
    throw new MapContractError("invalid_metadata", `${label} must be a boolean.`, context);
  }

  return value;
}

function requireAssetSource(value, label, context) {
  if (value === null || (typeof value === "string" && value.trim() !== "")) return value;

  throw new MapContractError(
    "invalid_metadata",
    `${label} must be a non-empty string or null.`,
    context
  );
}

function normalizeHttpUrl(value, baseOrigin, label, context) {
  const rawValue = requireString(value, label, context);
  let url;

  try {
    url = new URL(rawValue, `${baseOrigin.replace(/\/$/, "")}/`);
  } catch (_error) {
    throw new MapContractError("invalid_url", `${label} is not a valid URL.`, context);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new MapContractError("invalid_url", `${label} must use HTTP or HTTPS.`, context);
  }

  return url.toString();
}

function normalizeOptionalUrl(value, baseOrigin, label, context) {
  if (value === null) return null;
  return normalizeHttpUrl(value, baseOrigin, label, context);
}

export function getKimapRuntimeConfig(location = globalThis.location) {
  return Object.freeze({ manifestDataOrigin: location.origin });
}

export function buildMapDataApiUrl(config) {
  return new URL("/map-data/vanilla.json", config.manifestDataOrigin).href;
}

export function parseMapDataResponse(apiResponse, options) {
  const manifestDataOrigin = options?.manifestDataOrigin;
  if (!manifestDataOrigin) {
    throw new MapContractError(
      "invalid_runtime_config",
      "The manifest data origin is not configured."
    );
  }

  const response = requireRecord(apiResponse, "Caravan API response", {});
  if (isRecord(response.error)) {
    throw new MapContractError("api_error", "Caravan rejected the map-data request.");
  }

  const result = requireRecord(response.getmapdata, "getmapdata response", {});
  const contractVersion = result.contractVersion;
  const initialContext = { contractVersion };

  if (contractVersion !== MAP_CONTRACT_VERSION) {
    throw new MapContractError(
      "unsupported_contract",
      `Unsupported Caravan map contract version: ${String(contractVersion)}.`,
      initialContext
    );
  }

  const userData = requireRecord(result.userData, "userData", initialContext);
  const manifest = requireRecord(result.manifest, "manifest", initialContext);
  const manifestId = requireString(userData.manifestId, "userData.manifestId", initialContext);
  const context = { contractVersion, manifestId };

  const normalizedUserData = {
    ...userData,
    isLoggedIn: requireBoolean(userData.isLoggedIn, "userData.isLoggedIn", context),
    name: requireString(userData.name, "userData.name", context),
    manifestId
  };
  const summaryManifestId = requireString(manifest.id, "manifest.id", context);
  if (summaryManifestId !== manifestId) {
    throw new MapContractError(
      "invalid_metadata",
      "manifest.id must match userData.manifestId.",
      context
    );
  }

  const datasets = requireRecord(result.datasets, "datasets", context);
  const normalizedDatasets = {};

  for (const key of REQUIRED_DATASET_KEYS) {
    const dataset = requireRecord(datasets[key], `datasets.${key}`, context);
    if (dataset.required !== true) {
      throw new MapContractError(
        "invalid_dataset",
        `datasets.${key}.required must be true.`,
        context
      );
    }

    normalizedDatasets[key] = {
      ...dataset,
      url: normalizeHttpUrl(dataset.url, manifestDataOrigin, `datasets.${key}.url`, context),
      required: true,
      pattern: requireString(dataset.pattern, `datasets.${key}.pattern`, context)
    };
  }

  const assets = requireRecord(result.assets, "assets", context);
  const buildingLocations = requireRecord(
    assets.buildingLocations,
    "assets.buildingLocations",
    context
  );
  if (buildingLocations.required !== true) {
    throw new MapContractError(
      "invalid_asset",
      "assets.buildingLocations.required must be true.",
      context
    );
  }

  const normalizedAssets = {
    buildingLocations: {
      ...buildingLocations,
      url: normalizeHttpUrl(
        buildingLocations.url,
        manifestDataOrigin,
        "assets.buildingLocations.url",
        context
      ),
      required: true,
      source: requireAssetSource(
        buildingLocations.source,
        "assets.buildingLocations.source",
        context
      )
    }
  };

  for (const key of ["roadNetwork", "areasMap"]) {
    const asset = requireRecord(assets[key], `assets.${key}`, context);
    if (asset.required !== false) {
      throw new MapContractError("invalid_asset", `assets.${key}.required must be false.`, context);
    }

    normalizedAssets[key] = {
      ...asset,
      url: normalizeOptionalUrl(asset.url, manifestDataOrigin, `assets.${key}.url`, context),
      required: false,
      source: requireAssetSource(asset.source, `assets.${key}.source`, context)
    };
  }

  return {
    contractVersion,
    userData: Object.freeze(normalizedUserData),
    manifest: Object.freeze({ ...manifest }),
    datasets: Object.freeze(normalizedDatasets),
    assets: Object.freeze(normalizedAssets)
  };
}

export async function loadRequiredDatasets(contract, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new MapContractError("fetch_unavailable", "Dataset fetching is unavailable.");
  }

  const entries = await Promise.all(
    REQUIRED_DATASET_KEYS.map(async (key) => {
      const dataset = contract.datasets[key];
      let response;

      try {
        response = await fetchImpl(dataset.url, { credentials: "omit" });
      } catch (_error) {
        throw new MapContractError(
          "dataset_network_error",
          `Required dataset '${key}' could not be fetched.`,
          {
            contractVersion: contract.contractVersion,
            manifestId: contract.userData.manifestId,
            key
          }
        );
      }

      if (!response?.ok) {
        throw new MapContractError(
          "dataset_http_error",
          `Required dataset '${key}' returned HTTP ${String(response?.status ?? "unknown")}.`,
          {
            contractVersion: contract.contractVersion,
            manifestId: contract.userData.manifestId,
            key
          }
        );
      }

      try {
        return [key, await response.json()];
      } catch (_error) {
        throw new MapContractError(
          "dataset_json_error",
          `Required dataset '${key}' did not contain valid JSON.`,
          {
            contractVersion: contract.contractVersion,
            manifestId: contract.userData.manifestId,
            key
          }
        );
      }
    })
  );

  return Object.freeze(Object.fromEntries(entries));
}

export function commitRequiredDatasets(loadingQueue, loadedDatasets, context = {}) {
  const queuedKeys = loadingQueue.map((item) => item.key);
  for (const key of REQUIRED_DATASET_KEYS) {
    if (queuedKeys.filter((queuedKey) => queuedKey === key).length !== 1) {
      throw new MapContractError(
        "invalid_dataset_handler",
        `Required dataset '${key}' must have exactly one handler.`,
        context
      );
    }
  }

  for (const item of loadingQueue) {
    if (!REQUIRED_DATASET_KEYS.includes(item.key) || typeof item.handler !== "function") {
      throw new MapContractError(
        "invalid_dataset_handler",
        `Required dataset '${String(item.key)}' has no valid handler.`,
        context
      );
    }

    if (!Object.hasOwn(loadedDatasets, item.key)) {
      throw new MapContractError(
        "missing_staged_dataset",
        `Required dataset '${item.key}' was not staged.`,
        context
      );
    }

    try {
      item.handler(loadedDatasets[item.key]);
    } catch (_error) {
      throw new MapContractError(
        "dataset_handler_error",
        `Required dataset '${item.key}' could not be initialized.`,
        { ...context, key: item.key }
      );
    }
  }
}
