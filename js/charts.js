let pressureChart;
let heartRateChart;

function formatShortDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: {
        position: "bottom"
      }
    },
    scales: {
      y: {
        beginAtZero: false
      }
    }
  };
}

export function renderCharts(measurements) {
  const sorted = [...measurements].sort(
    (a, b) => new Date(a.measuredAt) - new Date(b.measuredAt)
  );

  const labels = sorted.map(item => formatShortDate(item.measuredAt));

  pressureChart?.destroy();
  heartRateChart?.destroy();

  pressureChart = new Chart(document.getElementById("pressureChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Sistólica",
          data: sorted.map(item => item.systolic),
          borderColor: "#dc3545",
          backgroundColor: "rgba(220,53,69,.15)",
          tension: 0.25
        },
        {
          label: "Diastólica",
          data: sorted.map(item => item.diastolic),
          borderColor: "#0d6efd",
          backgroundColor: "rgba(13,110,253,.15)",
          tension: 0.25
        }
      ]
    },
    options: chartOptions()
  });

  heartRateChart = new Chart(document.getElementById("heartRateChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Frequência cardíaca",
          data: sorted.map(item => item.heartRate),
          borderColor: "#198754",
          backgroundColor: "rgba(25,135,84,.15)",
          tension: 0.25,
          fill: true
        }
      ]
    },
    options: chartOptions()
  });
}
