function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function average(items, field) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + Number(item[field]), 0) / items.length;
}

function minValue(items, field) {
  return items.length ? Math.min(...items.map(item => Number(item[field]))) : 0;
}

function maxValue(items, field) {
  return items.length ? Math.max(...items.map(item => Number(item[field]))) : 0;
}

function resolveBmi(profile) {
  const directBmi = Number(profile?.bmi);
  if (Number.isFinite(directBmi) && directBmi > 0) {
    return directBmi.toFixed(1);
  }

  const weight = Number(profile?.weight);
  const height = Number(profile?.height);

  if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) {
    return "Não informado";
  }

  return (weight / (height * height)).toFixed(1);
}

function buildStatistics(measurements) {
  return {
    total: measurements.length,
    avgSystolic: average(measurements, "systolic").toFixed(1),
    avgDiastolic: average(measurements, "diastolic").toFixed(1),
    avgHeartRate: average(measurements, "heartRate").toFixed(1),
    minSystolic: minValue(measurements, "systolic"),
    maxSystolic: maxValue(measurements, "systolic"),
    minDiastolic: minValue(measurements, "diastolic"),
    maxDiastolic: maxValue(measurements, "diastolic"),
    minHeartRate: minValue(measurements, "heartRate"),
    maxHeartRate: maxValue(measurements, "heartRate")
  };
}

export function exportXlsx(profile, measurements) {
  const stats = buildStatistics(measurements);
  const bmi = resolveBmi(profile);

  const patient = [
    ["RELATÓRIO DE PRESSÃO ARTERIAL"],
    [],
    ["Paciente", profile?.fullName || "Não informado"],
    ["Sexo", profile?.sex || "Não informado"],
    ["Idade", profile?.age || "Não informado"],
    ["Peso (kg)", profile?.weight || "Não informado"],
    ["Altura (m)", profile?.height || "Não informado"],
    ["IMC", bmi],
    ["Data de emissão", formatDate(new Date())],
    [],
    ["ESTATÍSTICAS"],
    ["Total de registros", stats.total],
    ["Média sistólica", stats.avgSystolic],
    ["Média diastólica", stats.avgDiastolic],
    ["Média frequência cardíaca", stats.avgHeartRate],
    ["Menor sistólica", stats.minSystolic],
    ["Maior sistólica", stats.maxSystolic],
    ["Menor diastólica", stats.minDiastolic],
    ["Maior diastólica", stats.maxDiastolic],
    ["Menor frequência cardíaca", stats.minHeartRate],
    ["Maior frequência cardíaca", stats.maxHeartRate],
    [],
    ["MEDIÇÕES"],
    ["Data e hora", "Sistólica", "Diastólica", "Frequência cardíaca", "Observações"],
    ...measurements.map(item => [
      formatDate(item.measuredAt),
      item.systolic,
      item.diastolic,
      item.heartRate,
      item.observation || ""
    ])
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(patient);

  worksheet["!cols"] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 45 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
  XLSX.writeFile(workbook, "relatorio-pressao.xlsx");
}

export function exportPdf(profile, measurements) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const stats = buildStatistics(measurements);
  const bmi = resolveBmi(profile);

  pdf.setFontSize(18);
  pdf.text("Relatório de Pressão Arterial", 14, 18);

  pdf.setFontSize(10);
  pdf.text(`Emitido em: ${formatDate(new Date())}`, 14, 26);

  let y = 38;

  pdf.setFontSize(12);
  pdf.text("Dados do paciente", 14, y);

  pdf.setFontSize(10);
  y += 8;
  pdf.text(`Nome: ${profile?.fullName || "Não informado"}`, 14, y);
  y += 6;
  pdf.text(`Sexo: ${profile?.sex || "Não informado"}`, 14, y);
  y += 6;
  pdf.text(
    `Idade: ${profile?.age || "Não informado"} | Peso: ${profile?.weight || "Não informado"} kg | Altura: ${profile?.height || "Não informado"} m`,
    14,
    y
  );
  y += 6;
  pdf.text(`IMC: ${bmi}`, 14, y);

  y += 12;
  pdf.setFontSize(12);
  pdf.text("Estatísticas", 14, y);

  pdf.setFontSize(10);
  y += 7;
  pdf.text(
    `Registros: ${stats.total} | Médias: ${stats.avgSystolic}/${stats.avgDiastolic} mmHg | FC: ${stats.avgHeartRate} BPM`,
    14,
    y
  );

  y += 10;

  pdf.autoTable({
    startY: y,
    head: [["Data e hora", "Sistólica", "Diastólica", "FC", "Observações"]],
    body: measurements.map(item => [
      formatDate(item.measuredAt),
      item.systolic,
      item.diastolic,
      item.heartRate,
      item.observation || ""
    ]),
    styles: {
      fontSize: 8
    },
    headStyles: {
      fillColor: [13, 110, 253]
    }
  });

  pdf.save("relatorio-pressao.pdf");
}

export function exportJson(profile, measurements) {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    measurements
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "backup-minha-pressao.json";
  link.click();

  URL.revokeObjectURL(url);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch {
        reject(new Error("O arquivo JSON é inválido."));
      }
    };

    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsText(file);
  });
}