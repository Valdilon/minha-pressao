const PROFILE_KEY = "minhaPressao.profile";
const MEASUREMENTS_KEY = "minhaPressao.measurements";

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function getProfile() {
  const profile = readJson(PROFILE_KEY, null);
  return profile && typeof profile === "object" ? profile : null;
}

export async function saveProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new Error("Perfil invalido.");
  }

  writeJson(PROFILE_KEY, profile);
  return profile;
}

export async function getMeasurements() {
  const measurements = readJson(MEASUREMENTS_KEY, []);

  if (!Array.isArray(measurements)) {
    return [];
  }

  return sortByDateDesc(
    measurements.filter(item =>
      item &&
      typeof item === "object" &&
      item.id &&
      item.measuredAt
    )
  );
}

export async function getMeasurement(id) {
  if (!id) return null;

  const measurements = await getMeasurements();
  return measurements.find(item => item.id === id) || null;
}

export async function saveMeasurement(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Medicao invalida.");
  }

  const measurements = await getMeasurements();

  const measurement = {
    id: input.id || generateId(),
    systolic: Number(input.systolic),
    diastolic: Number(input.diastolic),
    heartRate: Number(input.heartRate),
    measuredAt: new Date(input.measuredAt).toISOString(),
    observation: String(input.observation || "").slice(0, 500)
  };

  if (
    !Number.isFinite(measurement.systolic) ||
    !Number.isFinite(measurement.diastolic) ||
    !Number.isFinite(measurement.heartRate) ||
    Number.isNaN(new Date(measurement.measuredAt).getTime())
  ) {
    throw new Error("Dados da medicao invalidos.");
  }

  const index = measurements.findIndex(item => item.id === measurement.id);

  if (index >= 0) {
    measurements[index] = measurement;
  } else {
    measurements.push(measurement);
  }

  writeJson(MEASUREMENTS_KEY, measurements);
  return measurement;
}

export async function deleteMeasurement(id) {
  if (!id) return false;

  const measurements = await getMeasurements();
  const next = measurements.filter(item => item.id !== id);

  if (next.length === measurements.length) {
    return false;
  }

  writeJson(MEASUREMENTS_KEY, next);
  return true;
}

export async function replaceAllMeasurements(items) {
  if (!Array.isArray(items)) {
    throw new Error("Lista de medicoes invalida.");
  }

  const normalized = items.map(item => ({
    id: item?.id || generateId(),
    systolic: Number(item?.systolic),
    diastolic: Number(item?.diastolic),
    heartRate: Number(item?.heartRate),
    measuredAt: new Date(item?.measuredAt || Date.now()).toISOString(),
    observation: String(item?.observation || "").slice(0, 500)
  })).filter(item =>
    Number.isFinite(item.systolic) &&
    Number.isFinite(item.diastolic) &&
    Number.isFinite(item.heartRate) &&
    !Number.isNaN(new Date(item.measuredAt).getTime())
  );

  writeJson(MEASUREMENTS_KEY, normalized);
  return sortByDateDesc(normalized);
}
