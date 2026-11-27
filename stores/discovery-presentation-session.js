import { deepFreeze } from "../modules/scenario/utils.js";

const INTERNALS = new WeakMap();
const SUBJECTS = Object.freeze([
  "keyCharacters",
  "bountyTargets",
  "deadlyAnimals",
  "fancyWeaponWielders",
  "nestTreasures",
  "treasureSpots",
  "narcotics"
]);
const CHARACTER_SUBJECTS = new Set(["keyCharacters", "bountyTargets", "fancyWeaponWielders"]);

function requireSubject(subjectId) {
  if (!SUBJECTS.includes(subjectId)) {
    throw new TypeError(`Unknown Discovery Context subject '${String(subjectId)}'.`);
  }
  return subjectId;
}

function requireIdentity(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty stable ID.`);
  }
  return value;
}

function sourcePairKey(pair) {
  return `${pair.nestItemId}\u0000${pair.nestId}`;
}

function normalizePair(pair) {
  return {
    nestItemId: requireIdentity(pair?.nestItemId, "Nest Item ID"),
    nestId: requireIdentity(pair?.nestId, "Nest ID")
  };
}

function createSnapshot(internal) {
  return deepFreeze({
    searchBySubject: { ...internal.searchBySubject },
    checkedKeyCharacterIds: [...internal.checkedKeyCharacterIds].sort(),
    checkedBountyTargetIds: [...internal.checkedBountyTargetIds].sort(),
    checkedFancyWielderIds: [...internal.checkedFancyWielderIds].sort(),
    checkedAnimalIds: [...internal.checkedAnimalIds].sort(),
    checkedNestSources: [...internal.checkedNestSources.values()].sort(
      (left, right) =>
        left.nestItemId.localeCompare(right.nestItemId) || left.nestId.localeCompare(right.nestId)
    ),
    checkedTreasureTownIds: [...internal.checkedTreasureTownIds].sort(),
    checkedNarcoticItemIds: [...internal.checkedNarcoticItemIds].sort(),
    activeNarcoticProhibitionId: internal.activeNarcoticProhibitionId
  });
}

function notify(session, type) {
  const internal = INTERNALS.get(session);
  internal.snapshot = createSnapshot(internal);
  const change = deepFreeze({ type, snapshot: internal.snapshot });
  for (const subscriber of [...internal.subscribers]) {
    try {
      subscriber(change);
    } catch (_error) {
      // Presentation observers cannot roll back an already committed change.
    }
  }
  return change;
}

export class DiscoveryPresentationSession {
  constructor({
    keyCharacterIds = [],
    bountyTargetIds = [],
    fancyWielderIds = [],
    animalIds = [],
    nestSources = [],
    treasureTownIds = [],
    narcoticItemIds = []
  } = {}) {
    if (
      !Array.isArray(keyCharacterIds) ||
      !Array.isArray(bountyTargetIds) ||
      !Array.isArray(fancyWielderIds) ||
      !Array.isArray(animalIds) ||
      !Array.isArray(nestSources) ||
      !Array.isArray(treasureTownIds) ||
      !Array.isArray(narcoticItemIds)
    ) {
      throw new TypeError("Discovery presentation identities must be arrays.");
    }
    const validKeyCharacterIds = new Set(
      keyCharacterIds.map((id) => requireIdentity(id, "Key Character ID"))
    );
    const validBountyTargetIds = new Set(
      bountyTargetIds.map((id) => requireIdentity(id, "Bounty Target ID"))
    );
    const validFancyWielderIds = new Set(
      fancyWielderIds.map((id) => requireIdentity(id, "Fancy Wielder ID"))
    );
    const validAnimalIds = new Set(animalIds.map((id) => requireIdentity(id, "Animal ID")));
    const validNestSources = new Set(nestSources.map((pair) => sourcePairKey(normalizePair(pair))));
    const validTreasureTownIds = new Set(
      treasureTownIds.map((id) => requireIdentity(id, "Treasure Town ID"))
    );
    const validNarcoticItemIds = new Set(
      narcoticItemIds.map((id) => requireIdentity(id, "Narcotic Item ID"))
    );
    const internal = {
      searchBySubject: {
        keyCharacters: "",
        bountyTargets: "",
        fancyWeaponWielders: "",
        deadlyAnimals: "",
        nestTreasures: "",
        treasureSpots: "",
        narcotics: ""
      },
      checkedKeyCharacterIds: new Set(),
      checkedBountyTargetIds: new Set(),
      checkedFancyWielderIds: new Set(),
      checkedAnimalIds: new Set(),
      checkedNestSources: new Map(),
      checkedTreasureTownIds: new Set(),
      checkedNarcoticItemIds: new Set(),
      activeNarcoticProhibitionId: null,
      validKeyCharacterIds,
      validBountyTargetIds,
      validFancyWielderIds,
      validAnimalIds,
      validNestSources,
      validTreasureTownIds,
      validNarcoticItemIds,
      subscribers: new Set(),
      snapshot: null
    };
    internal.snapshot = createSnapshot(internal);
    INTERNALS.set(this, internal);
  }

  setSearch(subjectId, text) {
    requireSubject(subjectId);
    if (typeof text !== "string") throw new TypeError("Context search text must be a string.");
    const internal = INTERNALS.get(this);
    if (internal.searchBySubject[subjectId] === text) return false;
    internal.searchBySubject[subjectId] = text;
    return notify(this, "setSearch");
  }

  toggleAnimal(entityId, checked = null) {
    requireIdentity(entityId, "Animal ID");
    const internal = INTERNALS.get(this);
    if (!internal.validAnimalIds.has(entityId)) {
      throw new TypeError(`Unknown Context Animal ID '${entityId}'.`);
    }
    const next = checked === null ? !internal.checkedAnimalIds.has(entityId) : Boolean(checked);
    if (next === internal.checkedAnimalIds.has(entityId)) return false;
    if (next) internal.checkedAnimalIds.add(entityId);
    else internal.checkedAnimalIds.delete(entityId);
    return notify(this, "toggleAnimal");
  }

  toggleCharacter(subjectId, entityId, checked = null) {
    requireSubject(subjectId);
    requireIdentity(entityId, "Character ID");
    if (!CHARACTER_SUBJECTS.has(subjectId)) {
      throw new TypeError(`Context subject '${subjectId}' does not contain Characters.`);
    }
    const internal = INTERNALS.get(this);
    const valid = {
      keyCharacters: internal.validKeyCharacterIds,
      bountyTargets: internal.validBountyTargetIds,
      fancyWeaponWielders: internal.validFancyWielderIds
    }[subjectId];
    const collection = {
      keyCharacters: internal.checkedKeyCharacterIds,
      bountyTargets: internal.checkedBountyTargetIds,
      fancyWeaponWielders: internal.checkedFancyWielderIds
    }[subjectId];
    if (!valid.has(entityId)) {
      throw new TypeError(`Unknown Context Character ID '${entityId}' for '${subjectId}'.`);
    }
    const next = checked === null ? !collection.has(entityId) : Boolean(checked);
    if (next === collection.has(entityId)) return false;
    if (next) collection.add(entityId);
    else collection.delete(entityId);
    return notify(this, "toggleCharacter");
  }

  toggleNestSource(pair, checked = null) {
    const normalized = normalizePair(pair);
    const key = sourcePairKey(normalized);
    const internal = INTERNALS.get(this);
    if (!internal.validNestSources.has(key)) {
      throw new TypeError("Unknown Context Nest Item source pair.");
    }
    const next = checked === null ? !internal.checkedNestSources.has(key) : Boolean(checked);
    if (next === internal.checkedNestSources.has(key)) return false;
    if (next) internal.checkedNestSources.set(key, normalized);
    else internal.checkedNestSources.delete(key);
    return notify(this, "toggleNestSource");
  }

  toggleTreasureTown(entityId, checked = null) {
    requireIdentity(entityId, "Treasure Town ID");
    const internal = INTERNALS.get(this);
    if (!internal.validTreasureTownIds.has(entityId)) {
      throw new TypeError(`Unknown Treasure Town ID '${entityId}'.`);
    }
    const next =
      checked === null ? !internal.checkedTreasureTownIds.has(entityId) : Boolean(checked);
    if (next === internal.checkedTreasureTownIds.has(entityId)) return false;
    if (next) internal.checkedTreasureTownIds.add(entityId);
    else internal.checkedTreasureTownIds.delete(entityId);
    return notify(this, "toggleTreasureTown");
  }

  toggleNarcotic(entityId, checked = null) {
    requireIdentity(entityId, "Narcotic Item ID");
    const internal = INTERNALS.get(this);
    if (!internal.validNarcoticItemIds.has(entityId)) {
      throw new TypeError(`Unknown Narcotic Item ID '${entityId}'.`);
    }
    const next =
      checked === null ? !internal.checkedNarcoticItemIds.has(entityId) : Boolean(checked);
    if (next === internal.checkedNarcoticItemIds.has(entityId)) return false;
    if (next) internal.checkedNarcoticItemIds.add(entityId);
    else internal.checkedNarcoticItemIds.delete(entityId);
    return notify(this, "toggleNarcotic");
  }

  setNarcoticProhibition(entityId) {
    if (entityId !== null) {
      requireIdentity(entityId, "Narcotic Item ID");
      if (!INTERNALS.get(this).validNarcoticItemIds.has(entityId)) {
        throw new TypeError(`Unknown Narcotic Item ID '${entityId}'.`);
      }
    }
    const internal = INTERNALS.get(this);
    if (internal.activeNarcoticProhibitionId === entityId) return false;
    internal.activeNarcoticProhibitionId = entityId;
    return notify(this, "setNarcoticProhibition");
  }

  showMany(subjectId, identities) {
    requireSubject(subjectId);
    if (!Array.isArray(identities)) throw new TypeError("Context identities must be an array.");
    const internal = INTERNALS.get(this);
    let changed = false;
    if (CHARACTER_SUBJECTS.has(subjectId)) {
      const valid = {
        keyCharacters: internal.validKeyCharacterIds,
        bountyTargets: internal.validBountyTargetIds,
        fancyWeaponWielders: internal.validFancyWielderIds
      }[subjectId];
      const collection = {
        keyCharacters: internal.checkedKeyCharacterIds,
        bountyTargets: internal.checkedBountyTargetIds,
        fancyWeaponWielders: internal.checkedFancyWielderIds
      }[subjectId];
      for (const entityId of identities) {
        requireIdentity(entityId, "Character ID");
        if (!valid.has(entityId)) {
          throw new TypeError(`Unknown Context Character ID '${entityId}' for '${subjectId}'.`);
        }
        if (!collection.has(entityId)) {
          collection.add(entityId);
          changed = true;
        }
      }
    } else if (subjectId === "deadlyAnimals") {
      for (const entityId of identities) {
        requireIdentity(entityId, "Animal ID");
        if (!internal.validAnimalIds.has(entityId)) {
          throw new TypeError(`Unknown Context Animal ID '${entityId}'.`);
        }
        if (!internal.checkedAnimalIds.has(entityId)) {
          internal.checkedAnimalIds.add(entityId);
          changed = true;
        }
      }
    } else if (subjectId === "nestTreasures") {
      for (const pair of identities) {
        const normalized = normalizePair(pair);
        const key = sourcePairKey(normalized);
        if (!internal.validNestSources.has(key)) {
          throw new TypeError("Unknown Context Nest Item source pair.");
        }
        if (!internal.checkedNestSources.has(key)) {
          internal.checkedNestSources.set(key, normalized);
          changed = true;
        }
      }
    } else {
      const collection =
        subjectId === "treasureSpots"
          ? internal.checkedTreasureTownIds
          : internal.checkedNarcoticItemIds;
      const valid =
        subjectId === "treasureSpots"
          ? internal.validTreasureTownIds
          : internal.validNarcoticItemIds;
      const label = subjectId === "treasureSpots" ? "Treasure Town ID" : "Narcotic Item ID";
      for (const entityId of identities) {
        requireIdentity(entityId, label);
        if (!valid.has(entityId)) throw new TypeError(`Unknown ${label} '${entityId}'.`);
        if (!collection.has(entityId)) {
          collection.add(entityId);
          changed = true;
        }
      }
    }
    return changed ? notify(this, "showMany") : false;
  }

  clearSubject(subjectId) {
    requireSubject(subjectId);
    const internal = INTERNALS.get(this);
    const collection = {
      keyCharacters: internal.checkedKeyCharacterIds,
      bountyTargets: internal.checkedBountyTargetIds,
      fancyWeaponWielders: internal.checkedFancyWielderIds,
      deadlyAnimals: internal.checkedAnimalIds,
      nestTreasures: internal.checkedNestSources,
      treasureSpots: internal.checkedTreasureTownIds,
      narcotics: internal.checkedNarcoticItemIds
    }[subjectId];
    const clearsProhibition =
      subjectId === "narcotics" && internal.activeNarcoticProhibitionId !== null;
    if (collection.size === 0 && !clearsProhibition) return false;
    collection.clear();
    if (clearsProhibition) internal.activeNarcoticProhibitionId = null;
    return notify(this, "clearSubject");
  }

  restoreDefaults() {
    const internal = INTERNALS.get(this);
    const unchanged =
      internal.searchBySubject.keyCharacters === "" &&
      internal.searchBySubject.bountyTargets === "" &&
      internal.searchBySubject.fancyWeaponWielders === "" &&
      internal.searchBySubject.deadlyAnimals === "" &&
      internal.searchBySubject.nestTreasures === "" &&
      internal.searchBySubject.treasureSpots === "" &&
      internal.searchBySubject.narcotics === "" &&
      internal.checkedKeyCharacterIds.size === 0 &&
      internal.checkedBountyTargetIds.size === 0 &&
      internal.checkedFancyWielderIds.size === 0 &&
      internal.checkedAnimalIds.size === 0 &&
      internal.checkedNestSources.size === 0 &&
      internal.checkedTreasureTownIds.size === 0 &&
      internal.checkedNarcoticItemIds.size === 0 &&
      internal.activeNarcoticProhibitionId === null;
    if (unchanged) return false;
    internal.searchBySubject = {
      keyCharacters: "",
      bountyTargets: "",
      fancyWeaponWielders: "",
      deadlyAnimals: "",
      nestTreasures: "",
      treasureSpots: "",
      narcotics: ""
    };
    internal.checkedKeyCharacterIds.clear();
    internal.checkedBountyTargetIds.clear();
    internal.checkedFancyWielderIds.clear();
    internal.checkedAnimalIds.clear();
    internal.checkedNestSources.clear();
    internal.checkedTreasureTownIds.clear();
    internal.checkedNarcoticItemIds.clear();
    internal.activeNarcoticProhibitionId = null;
    return notify(this, "restoreDefaults");
  }

  getSnapshot() {
    return INTERNALS.get(this).snapshot;
  }

  subscribe(subscriber) {
    if (typeof subscriber !== "function") throw new TypeError("Subscriber must be a function.");
    const subscribers = INTERNALS.get(this).subscribers;
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }
}

export const DISCOVERY_PRESENTATION_SUBJECTS = SUBJECTS;
