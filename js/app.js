import {
  getProfile,
  saveProfile,
  getMeasurements,
  getMeasurement,
  saveMeasurement,
  deleteMeasurement,
  replaceAllMeasurements
} from "./database.js";

import { renderCharts } from "./charts.js";

import {
  exportXlsx,
  exportPdf,
  exportJson,
  readJsonFile
} from "./export.js";

let profile = null;
let measurements = [];
const APP_VERSION = "1.1.0";
const APP_BUILD = "2026-08-19-v18";
const APP_BUILD_KEY = "minhaPressao.appBuild";

const $ = selector => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const reloaded = await ensureFreshClientState();
  if (reloaded) return;

  bindNavigation();
  bindForms();
  bindFilters();
  bindExports();
  bindTheme();
  bindClassificationTable();
  renderAppVersionLabel();

  setCurrentDateTime();
  await loadData();

  registerServiceWorker();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
    .then(registration => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(registration);
          }
        });
      });
    })
    .catch(error => console.warn("Service Worker:", error));

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

function showUpdateBanner(registration) {
  const banner = $("#updateBanner");
  const button = $("#btnUpdateNow");

  banner.classList.remove("d-none");
  button.addEventListener("click", () => {
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  }, { once: true });
}

function bindClassificationTable() {
  const overlay = $("#classificationOverlay");
  const toggleBtn = $("#btnClassificationTable");
  const closeBtn = $("#btnCloseClassificationTable");

  toggleBtn.addEventListener("click", () => overlay.classList.toggle("d-none"));
  closeBtn.addEventListener("click", () => overlay.classList.add("d-none"));
  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.classList.add("d-none");
  });
}

async function ensureFreshClientState() {
  const currentBuild = localStorage.getItem(APP_BUILD_KEY);
  if (currentBuild === APP_BUILD) return false;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }

    if (typeof caches !== "undefined") {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(cacheKey => caches.delete(cacheKey)));
    }
  } catch (error) {
    console.warn("Falha ao limpar cache antigo:", error);
  }

  localStorage.setItem(APP_BUILD_KEY, APP_BUILD);
  location.reload();
  return true;
}

async function loadData() {
  try {
    profile = await getProfile();
    measurements = await getMeasurements();

    populateProfileForm();
    updateProfileWarning();
    renderDashboard();
    renderHistory();
    renderCharts(measurements);
  } catch (error) {
    showAlert("Não foi possível carregar os dados locais.", "danger");
    console.error(error);
  }
}

function bindNavigation() {
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-section]");
    if (!button) return;

    showSection(button.dataset.section);

    document.querySelectorAll(".nav-link[data-section]")
      .forEach(item => item.classList.remove("active"));

    const navButton = document.querySelector(
      `.nav-link[data-section="${button.dataset.section}"]`
    );

    navButton?.classList.add("active");
  });
}

function showSection(sectionId) {
  document.querySelectorAll(".app-section").forEach(section => {
    section.classList.toggle("d-none", section.id !== sectionId);
  });

  if (sectionId === "graficos") {
    renderCharts(getFilteredMeasurements("chart"));
  }
}

function bindForms() {
  $("#profileForm").addEventListener("submit", handleProfileSubmit);
  $("#measurementForm").addEventListener("submit", handleMeasurementSubmit);
  $("#cancelEdit").addEventListener("click", resetMeasurementForm);

  ["weight", "height"].forEach(id => {
    $(`#${id}`).addEventListener("input", updateImcPreview);
  });

  $("#birthDate").addEventListener("input", updateAgePreview);

  ["systolic", "diastolic", "heartRate"].forEach(id => {
    $(`#${id}`).addEventListener("input", updateClassificationPreview);
  });
}

function bindFilters() {
  ["filterStart", "filterEnd", "sortOrder"].forEach(id => {
    $(`#${id}`).addEventListener("change", renderHistory);
  });

  $("#updateCharts").addEventListener("click", () => {
    renderCharts(getFilteredMeasurements("chart"));
  });
}

function bindExports() {
  $("#exportXlsx").addEventListener("click", () => {
    exportXlsx(profile, getFilteredMeasurements("history"));
  });

  $("#exportPdf").addEventListener("click", () => {
    exportPdf(profile, getFilteredMeasurements("history"));
  });

  $("#exportJson").addEventListener("click", () => {
    exportJson(profile, measurements);
  });

  $("#importJson").addEventListener("change", handleImport);
}

function bindTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.dataset.theme = savedTheme;
  updateThemeIcon(savedTheme);

  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme;
    const next = current === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    updateThemeIcon(next);
  });
}

function renderAppVersionLabel() {
  const label = $("#appVersionLabel");
  if (!label) return;

  const buildDate = APP_BUILD.slice(0, 10);
  const buildTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  label.textContent = `${APP_VERSION} - ${buildDate} ${buildTime}`;
}

function updateThemeIcon(theme) {
  $("#themeToggle i").className =
    theme === "dark" ? "bi bi-sun" : "bi bi-moon";
}

function populateProfileForm() {
  if (!profile) {
    updateImcPreview();
    return;
  }

  $("#fullName").value = profile.fullName || "";
  $("#sex").value = profile.sex || "";
  $("#birthDate").value = profile.birthDate || "";
  $("#weight").value = profile.weight || "";
  $("#height").value = profile.height || "";
  updateImcPreview();
  updateAgePreview();
}

function calculateAge(birthDateValue) {
  if (!birthDateValue) return "";

  const birthDate = new Date(birthDateValue);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) age--;
  return age >= 0 ? age : "";
}

function updateAgePreview() {
  const ageField = $("#age");
  if (!ageField) return;

  const age = calculateAge($("#birthDate")?.value);
  if (age !== "") {
    ageField.value = `${age} anos`;
  } else if (profile?.age) {
    ageField.value = `${profile.age} anos`;
  } else {
    ageField.value = "";
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const birthDateValue = $("#birthDate").value;
  const calculatedAge = calculateAge(birthDateValue);

  profile = {
    fullName: $("#fullName").value,
    sex: $("#sex").value,
    birthDate: birthDateValue,
    age: calculatedAge !== "" ? calculatedAge : (profile?.age || ""),
    weight: $("#weight").value,
    height: $("#height").value,
    bmi: calculateImc($("#weight").value, $("#height").value)
  };

  try {
    await saveProfile(profile);
    updateProfileWarning();
    showAlert("Perfil salvo com sucesso.", "success");
    showSection("dashboard");
  } catch (error) {
    showAlert("Não foi possível salvar o perfil.", "danger");
    console.error(error);
  }
}

async function handleMeasurementSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;

  if (!profile) {
    showAlert("Cadastre seu perfil antes de registrar uma aferição.", "warning");
    showSection("perfil");
    return;
  }

  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const systolic = Number($("#systolic").value);
  const diastolic = Number($("#diastolic").value);
  const heartRate = Number($("#heartRate").value);

  if (diastolic >= systolic) {
    showAlert("A pressão diastólica deve ser menor que a sistólica.", "warning");
    return;
  }

  const data = {
    id: $("#measurementId").value || undefined,
    systolic,
    diastolic,
    heartRate,
    measuredAt: new Date($("#measuredAt").value).toISOString(),
    observation: $("#observation").value
  };

  try {
    await saveMeasurement(data);
    measurements = await getMeasurements();

    showAlert(
      data.id ? "Aferição atualizada." : "Aferição registrada.",
      "success"
    );

    resetMeasurementForm();
    renderDashboard();
    renderHistory();
    renderCharts(measurements);
    showSection("dashboard");
  } catch (error) {
    showAlert("Não foi possível salvar a aferição.", "danger");
    console.error(error);
  }
}

function resetMeasurementForm() {
  $("#measurementForm").reset();
  $("#measurementForm").classList.remove("was-validated");
  $("#measurementId").value = "";
  $("#measurementTitle").textContent = "Registrar aferição";
  $("#measurementClassification").innerHTML = "";
  setCurrentDateTime();
}

async function editMeasurement(id) {
  const item = await getMeasurement(id);
  if (!item) return;

  $("#measurementId").value = item.id;
  $("#systolic").value = item.systolic;
  $("#diastolic").value = item.diastolic;
  $("#heartRate").value = item.heartRate;
  $("#observation").value = item.observation || "";

  const date = new Date(item.measuredAt);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  $("#measuredAt").value = date.toISOString().slice(0, 16);
  $("#measurementTitle").textContent = "Editar aferição";

  updateClassificationPreview();
  showSection("medicoes");
}

async function removeMeasurement(id) {
  const confirmed = confirm(
    "Tem certeza que deseja excluir esta aferição? Esta ação não pode ser desfeita."
  );

  if (!confirmed) return;

  try {
    await deleteMeasurement(id);
    measurements = await getMeasurements();

    renderDashboard();
    renderHistory();
    renderCharts(measurements);
    showAlert("Aferição excluída.", "success");
  } catch (error) {
    showAlert("Não foi possível excluir a aferição.", "danger");
    console.error(error);
  }
}

function setCurrentDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  $("#measuredAt").value = date.toISOString().slice(0, 16);
}

function updateProfileWarning() {
  $("#profileWarning").classList.toggle("d-none", Boolean(profile));
}

function calculateImc(weight, height) {
  const weightValue = Number(weight);
  const heightValue = Number(height);

  if (!Number.isFinite(weightValue) || !Number.isFinite(heightValue) || heightValue <= 0) {
    return null;
  }

  return Number((weightValue / (heightValue * heightValue)).toFixed(1));
}

function classifyImc(bmi) {
  if (bmi < 18.5) return "Abaixo do peso";
  if (bmi < 25) return "Peso adequado";
  if (bmi < 30) return "Sobrepeso";
  if (bmi < 35) return "Obesidade grau 1";
  if (bmi < 40) return "Obesidade grau 2";
  return "Obesidade grau 3";
}

function updateImcPreview() {
  const imcResult = $("#imcResult");
  const bmi = calculateImc($("#weight")?.value, $("#height")?.value);

  if (!bmi) {
    imcResult.classList.add("d-none");
    imcResult.innerHTML = "";
    return;
  }

  imcResult.classList.remove("d-none");
  imcResult.innerHTML = `
    <strong>IMC:</strong> ${bmi.toFixed(1)}
    <span class="ms-2 badge text-bg-secondary">${classifyImc(bmi)}</span>
  `;
}

function classifyPressure(systolic, diastolic) {
  if (systolic >= 180 || diastolic >= 110) {
    return {
      label: "Hipertensão estágio 3",
      className: "class-stage3",
      icon: "exclamation-octagon",
      warning: true
    };
  }

  if (systolic >= 160 || diastolic >= 100) {
    return {
      label: "Hipertensão estágio 2",
      className: "class-stage2",
      icon: "exclamation-triangle",
      warning: false
    };
  }

  if (systolic >= 140 || diastolic >= 90) {
    return {
      label: "Hipertensão estágio 1",
      className: "class-stage1",
      icon: "exclamation-circle",
      warning: false
    };
  }

  if (systolic >= 120 || diastolic >= 80) {
    return {
      label: "Pré-hipertensão",
      className: "class-prehypertension",
      icon: "arrow-up-circle",
      warning: false
    };
  }

  return {
    label: "PA normal",
    className: "class-normal",
    icon: "check-circle",
    warning: false
  };
}

function updateClassificationPreview() {
  const systolic = Number($("#systolic").value);
  const diastolic = Number($("#diastolic").value);

  if (!systolic || !diastolic) {
    $("#measurementClassification").innerHTML = "";
    return;
  }

  const classification = classifyPressure(systolic, diastolic);

  $("#measurementClassification").innerHTML = `
    <div class="alert ${classification.warning ? "alert-danger" : "alert-light"}">
      <i class="bi bi-${classification.icon}"></i>
      Classificação estimada:
      <strong>${classification.label}</strong>
      ${
        classification.warning
          ? "<br><small>Repita a aferição após repouso. Se persistir ou houver sintomas, procure atendimento imediatamente.</small>"
          : ""
      }
    </div>
  `;
}

function renderDashboard() {
  const stats = calculateStats(measurements);

  $("#totalRecords").textContent = stats.total;
  $("#avgSystolic").textContent = stats.total ? stats.avgSystolic : "—";
  $("#avgDiastolic").textContent = stats.total ? stats.avgDiastolic : "—";
  $("#avgHeartRate").textContent = stats.total ? stats.avgHeartRate : "—";

  const latest = [...measurements]
    .sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))
    .slice(0, 5);

  $("#latestRecords").innerHTML = buildTable(latest, false);
  bindTableActions();
}

function renderHistory() {
  const filtered = getFilteredMeasurements("history");
  $("#historyTable").innerHTML = buildTable(filtered, true);
  bindTableActions();
}

function buildTable(items, showActions = true) {
  if (!items.length) {
    return `
      <div class="text-center text-muted py-4">
        <i class="bi bi-clipboard-x fs-1"></i>
        <p class="mt-2 mb-0">Nenhuma medição encontrada.</p>
      </div>
    `;
  }

  return `
    <table class="table table-hover align-middle">
      <thead>
        <tr>
          <th>Data e hora</th>
          <th>Pressão</th>
          <th>FC</th>
          <th>Classificação</th>
          <th>Observações</th>
          ${showActions ? "<th>Ações</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${items.map(item => {
          const classification = classifyPressure(item.systolic, item.diastolic);

          return `
            <tr>
              <td>${formatDate(item.measuredAt)}</td>
              <td>
                <strong>${item.systolic}/${item.diastolic}</strong>
                <small class="text-muted"> mmHg</small>
              </td>
              <td>${item.heartRate} BPM</td>
              <td>
                <span class="badge badge-classification ${classification.className}">
                  ${classification.label}
                </span>
              </td>
              <td>${escapeHtml(item.observation || "—")}</td>
              ${
                showActions
                  ? `
                    <td class="text-nowrap">
                      <button class="btn btn-sm btn-outline-primary edit-btn"
                        data-id="${item.id}" title="Editar">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-danger delete-btn"
                        data-id="${item.id}" title="Excluir">
                        <i class="bi bi-trash"></i>
                      </button>
                    </td>
                  `
                  : ""
              }
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function bindTableActions() {
  document.querySelectorAll(".edit-btn").forEach(button => {
    button.addEventListener("click", () => editMeasurement(button.dataset.id));
  });

  document.querySelectorAll(".delete-btn").forEach(button => {
    button.addEventListener("click", () => removeMeasurement(button.dataset.id));
  });
}

function getFilteredMeasurements(type) {
  const prefix = type === "chart" ? "chart" : "filter";

  const start = $(`#${prefix}Start`).value;
  const end = $(`#${prefix}End`).value;

  return measurements.filter(item => {
    const date = new Date(item.measuredAt);

    if (start) {
      const startDate = new Date(`${start}T00:00:00`);
      if (date < startDate) return false;
    }

    if (end) {
      const endDate = new Date(`${end}T23:59:59`);
      if (date > endDate) return false;
    }

    return true;
  }).sort((a, b) => {
    const direction = $("#sortOrder")?.value === "asc" ? 1 : -1;
    return direction * (new Date(a.measuredAt) - new Date(b.measuredAt));
  });
}

function calculateStats(items) {
  const average = field =>
    items.length
      ? (items.reduce((sum, item) => sum + Number(item[field]), 0) / items.length).toFixed(1)
      : 0;

  return {
    total: items.length,
    avgSystolic: average("systolic"),
    avgDiastolic: average("diastolic"),
    avgHeartRate: average("heartRate")
  };
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const backup = await readJsonFile(file);

    if (
      !backup ||
      !Array.isArray(backup.measurements) ||
      typeof backup.profile !== "object"
    ) {
      throw new Error("Formato de backup inválido.");
    }

    const confirmed = confirm(
      "A importação substituirá os dados atuais. Deseja continuar?"
    );

    if (!confirmed) return;

    if (backup.profile) {
      await saveProfile(backup.profile);
    }

    await replaceAllMeasurements(backup.measurements);
    await loadData();

    showAlert("Backup importado com sucesso.", "success");
  } catch (error) {
    showAlert(error.message || "Falha ao importar o backup.", "danger");
  } finally {
    event.target.value = "";
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showAlert(message, type = "info") {
  const container = $("#alertContainer");

  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;

  window.setTimeout(() => {
    container.querySelector(".alert")?.remove();
  }, 5000);
}
