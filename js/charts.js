// NEXUS ASIA - Charts Module

const NexusCharts = (() => {
  const PALETTE = {
    green: '#00ff88',
    amber: '#ffaa00',
    red: '#ff3355',
    blue: '#00aaff',
    purple: '#aa55ff',
    cyan: '#00ffcc',
    grid: 'rgba(255,255,255,0.04)',
    text: '#8888aa'
  };

  Chart.defaults.color = PALETTE.text;
  Chart.defaults.borderColor = PALETTE.grid;
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size = 11;

  const chartRegistry = {};

  function destroyChart(id) {
    if (chartRegistry[id]) { chartRegistry[id].destroy(); delete chartRegistry[id]; }
  }

  function registerChart(id, chart) {
    destroyChart(id);
    chartRegistry[id] = chart;
    return chart;
  }

  function renderRiskDonut(canvasId, data) {
    // data = { green: N, amber: N, red: N }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    return registerChart(canvasId, new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Green', 'Amber', 'Red'],
        datasets: [{
          data: [data.green, data.amber, data.red],
          backgroundColor: [PALETTE.green, PALETTE.amber, PALETTE.red],
          borderColor: '#0a0a18',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} projects` } }
        }
      }
    }));
  }

  function renderCityExposure(canvasId, cityData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const sorted = [...cityData].sort((a, b) => b.exposure - a.exposure).slice(0, 8);
    return registerChart(canvasId, new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.city),
        datasets: [{
          label: 'Loan Exposure (Cr)',
          data: sorted.map(d => +(d.exposure / 10000000).toFixed(1)),
          backgroundColor: sorted.map((d, i) => {
            const colors = [PALETTE.cyan, PALETTE.blue, PALETTE.purple, PALETTE.green, PALETTE.amber, '#ff8844', '#ff55aa', '#44ffcc'];
            return colors[i % colors.length] + 'cc';
          }),
          borderColor: 'transparent',
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: PALETTE.grid }, ticks: { callback: v => `₹${v}Cr` } },
          y: { grid: { display: false } }
        }
      }
    }));
  }

  function renderDeveloperExposure(canvasId, devData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const sorted = [...devData].sort((a, b) => b.exposure - a.exposure).slice(0, 8);
    return registerChart(canvasId, new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.name.split(' ')[0]),
        datasets: [{
          label: 'Exposure (Bn)',
          data: sorted.map(d => +(d.exposure / 1000000000).toFixed(2)),
          backgroundColor: sorted.map(d => {
            if (d.riskScore >= 75) return PALETTE.green + 'bb';
            if (d.riskScore >= 50) return PALETTE.amber + 'bb';
            return PALETTE.red + 'bb';
          }),
          borderColor: 'transparent',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: PALETTE.grid }, ticks: { callback: v => `₹${v}Bn` } }
        }
      }
    }));
  }

  function renderScoreGauge(canvasId, score) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const color = score >= 70 ? PALETTE.green : score >= 45 ? PALETTE.amber : PALETTE.red;
    return registerChart(canvasId, new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [score, 100 - score],
          backgroundColor: [color, 'rgba(255,255,255,0.04)'],
          borderColor: ['transparent', 'transparent'],
          borderWidth: 0,
          circumference: 270,
          rotation: 225
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '78%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    }));
  }

  function renderConstructionChart(canvasId, constructionData) {
    // constructionData = array of { month, actual, scheduled }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    return registerChart(canvasId, new Chart(ctx, {
      type: 'line',
      data: {
        labels: constructionData.map(d => d.month),
        datasets: [
          {
            label: 'Actual Progress',
            data: constructionData.map(d => d.actual),
            borderColor: PALETTE.green,
            backgroundColor: PALETTE.green + '20',
            tension: 0.3,
            fill: true,
            pointRadius: 3
          },
          {
            label: 'Scheduled',
            data: constructionData.map(d => d.scheduled),
            borderColor: PALETTE.text,
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { color: PALETTE.grid } },
          y: { grid: { color: PALETTE.grid }, ticks: { callback: v => v + '%' }, min: 0, max: 100 }
        }
      }
    }));
  }

  function renderSalesChart(canvasId, salesData) {
    // salesData = array of { month, actual, target }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    return registerChart(canvasId, new Chart(ctx, {
      type: 'bar',
      data: {
        labels: salesData.map(d => d.month),
        datasets: [
          {
            label: 'Actual Sales',
            data: salesData.map(d => d.actual),
            backgroundColor: PALETTE.blue + 'cc',
            borderRadius: 3
          },
          {
            label: 'Target',
            data: salesData.map(d => d.target),
            backgroundColor: 'transparent',
            borderColor: PALETTE.amber,
            borderWidth: 1.5,
            type: 'line',
            tension: 0,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: PALETTE.grid } }
        }
      }
    }));
  }

  function renderMarketPriceChart(canvasId, marketData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const sorted = [...marketData].sort((a, b) => b.avgPrice - a.avgPrice);
    return registerChart(canvasId, new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.city),
        datasets: [{
          label: 'Avg Price (₹/sqft)',
          data: sorted.map(d => d.avgPrice),
          backgroundColor: PALETTE.cyan + '99',
          borderRadius: 4
        }, {
          label: 'QoQ Change %',
          data: sorted.map(d => d.priceChange),
          type: 'line',
          yAxisID: 'y2',
          borderColor: PALETTE.amber,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: PALETTE.amber
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: PALETTE.grid }, ticks: { callback: v => '₹' + v.toLocaleString() } },
          y2: { position: 'right', grid: { display: false }, ticks: { callback: v => v + '%' } }
        }
      }
    }));
  }

  function renderAbsorptionChart(canvasId, marketData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    return registerChart(canvasId, new Chart(ctx, {
      type: 'radar',
      data: {
        labels: marketData.map(d => d.city),
        datasets: [{
          label: 'Absorption Rate',
          data: marketData.map(d => d.absorption),
          borderColor: PALETTE.green,
          backgroundColor: PALETTE.green + '20',
          pointBackgroundColor: PALETTE.green
        }, {
          label: 'Demand Index',
          data: marketData.map(d => d.demandIndex),
          borderColor: PALETTE.blue,
          backgroundColor: PALETTE.blue + '15',
          pointBackgroundColor: PALETTE.blue
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          r: {
            grid: { color: PALETTE.grid },
            ticks: { backdropColor: 'transparent' },
            pointLabels: { font: { size: 10 } },
            min: 0,
            max: 100
          }
        }
      }
    }));
  }

  function renderScoreHistory(canvasId, history) {
    // history = array of { month, score }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    return registerChart(canvasId, new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map(d => d.month),
        datasets: [{
          label: 'Risk Score',
          data: history.map(d => d.score),
          borderColor: PALETTE.cyan,
          backgroundColor: PALETTE.cyan + '15',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: history.map(d => d.score >= 70 ? PALETTE.green : d.score >= 45 ? PALETTE.amber : PALETTE.red)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: PALETTE.grid } },
          y: { grid: { color: PALETTE.grid }, min: 0, max: 100 }
        }
      }
    }));
  }

  function renderRiskComponentsBar(canvasId, components) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const labels = {
      financialHealth: 'Financial Health',
      constructionProgress: 'Construction',
      salesVelocity: 'Sales Velocity',
      cashFlowAdequacy: 'Cash Flow',
      sponsorRisk: 'Sponsor Risk',
      marketConditions: 'Market',
      capitalStackStability: 'Capital Stack',
      regulatoryRisk: 'Regulatory'
    };
    const keys = Object.keys(components);
    const values = keys.map(k => Math.round(components[k]));
    return registerChart(canvasId, new Chart(ctx, {
      type: 'bar',
      data: {
        labels: keys.map(k => labels[k] || k),
        datasets: [{
          label: 'Component Score',
          data: values,
          backgroundColor: values.map(v => v >= 70 ? PALETTE.green + 'cc' : v >= 45 ? PALETTE.amber + 'cc' : PALETTE.red + 'cc'),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: PALETTE.grid }, min: 0, max: 100 }
        }
      }
    }));
  }

  // Generate mock history data for a project
  function generateMockHistory(currentScore) {
    const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    return months.map((month, i) => {
      const noise = (Math.random() - 0.5) * 12;
      const trend = (i - 2.5) * 1.5;
      return { month, score: Math.max(5, Math.min(98, currentScore + noise + trend - 4)) };
    });
  }

  function generateMockConstruction(actual, scheduled) {
    const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    return months.map((month, i) => {
      const t = i / (months.length - 1);
      return {
        month,
        actual: Math.max(0, Math.min(100, actual * t + (Math.random() - 0.5) * 3)),
        scheduled: Math.max(0, Math.min(100, scheduled * t))
      };
    });
  }

  function generateMockSales(velocity, target) {
    const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    return months.map(month => ({
      month,
      actual: Math.max(0, Math.round(velocity + (Math.random() - 0.5) * velocity * 0.3)),
      target
    }));
  }

  return {
    renderRiskDonut, renderCityExposure, renderDeveloperExposure, renderScoreGauge,
    renderConstructionChart, renderSalesChart, renderMarketPriceChart, renderAbsorptionChart,
    renderScoreHistory, renderRiskComponentsBar,
    generateMockHistory, generateMockConstruction, generateMockSales,
    destroyChart, PALETTE
  };
})();
