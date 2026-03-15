// NEXUS ASIA - Report Generator Module

const ReportGenerator = (() => {
  function formatCurrency(amount) {
    if (amount >= 10000000000) return `₹${(amount / 10000000000).toFixed(2)}Bn`;
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    return `₹${amount.toLocaleString()}`;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function generateReportHTML(project, developer, loan, alerts, scoreResult) {
    const score = scoreResult || { totalScore: project.riskScore, alertLevel: project.alertLevel, components: {} };
    const alertColor = RiskEngine.getAlertColor(score.alertLevel);
    const statusBg = score.alertLevel === 'GREEN' ? '#003d1f' : score.alertLevel === 'AMBER' ? '#3d2900' : '#3d0010';
    const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const escrowRatio = ((project.escrowBalance / project.escrowRequired) * 100).toFixed(1);
    const salesPct = ((project.unitsSold / project.totalUnits) * 100).toFixed(1);
    const constructionVariance = project.constructionProgress - project.scheduledProgress;

    const liveAlerts = alerts || RiskEngine.detectAlerts(project, developer, loan);
    const redAlerts = liveAlerts.filter(a => a.level === 'RED');
    const amberAlerts = liveAlerts.filter(a => a.level === 'AMBER');

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'IBM Plex Sans',sans-serif; background:#fff; color:#1a1a2e; font-size:10pt; }
  .report-header { background:#0a0a18; color:#fff; padding:24px 32px; display:flex; justify-content:space-between; align-items:flex-start; }
  .report-logo { font-family:'IBM Plex Mono',monospace; font-size:16pt; color:#00ffcc; letter-spacing:0.1em; }
  .report-meta { text-align:right; font-size:8pt; color:#8888aa; }
  .risk-badge { display:inline-block; padding:6px 16px; border-radius:4px; font-weight:700; font-size:10pt; background:${statusBg}; color:${alertColor}; border:1px solid ${alertColor}; letter-spacing:0.08em; }
  .section { padding:20px 32px; border-bottom:1px solid #e8e8f0; }
  .section h2 { font-size:9pt; text-transform:uppercase; letter-spacing:0.12em; color:#888; margin-bottom:14px; font-weight:600; }
  .section h1 { font-size:16pt; color:#1a1a2e; margin-bottom:4px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
  .grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .metric-box { background:#f8f8fc; border:1px solid #e0e0ee; border-radius:6px; padding:14px; }
  .metric-box .label { font-size:7.5pt; text-transform:uppercase; letter-spacing:0.1em; color:#888; margin-bottom:6px; }
  .metric-box .value { font-family:'IBM Plex Mono',monospace; font-size:14pt; font-weight:600; color:#1a1a2e; }
  .metric-box .sub { font-size:7.5pt; color:#888; margin-top:3px; }
  .metric-box.red .value { color:#cc1133; }
  .metric-box.amber .value { color:#cc7700; }
  .metric-box.green .value { color:#006633; }
  .alert-box { padding:10px 14px; border-radius:4px; margin-bottom:8px; border-left:3px solid; }
  .alert-box.red { background:#fff0f3; border-color:#cc1133; }
  .alert-box.amber { background:#fffbf0; border-color:#cc7700; }
  .alert-box .alert-type { font-size:7.5pt; text-transform:uppercase; font-weight:700; margin-bottom:3px; }
  .alert-box.red .alert-type { color:#cc1133; }
  .alert-box.amber .alert-type { color:#cc7700; }
  .alert-box .alert-msg { font-size:9pt; color:#333; }
  .progress-bar-bg { background:#e0e0ee; border-radius:3px; height:8px; overflow:hidden; margin-top:6px; }
  .progress-bar-fill { height:8px; border-radius:3px; }
  .score-circle { width:100px; height:100px; margin:0 auto; position:relative; }
  table { width:100%; border-collapse:collapse; font-size:9pt; }
  th { background:#f0f0f8; text-align:left; padding:8px 10px; font-size:7.5pt; text-transform:uppercase; letter-spacing:0.08em; color:#555; }
  td { padding:8px 10px; border-bottom:1px solid #f0f0f8; }
  .footer { background:#0a0a18; color:#888; padding:16px 32px; font-size:7.5pt; font-family:'IBM Plex Mono',monospace; }
  .score-row { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
  .score-label { font-size:8.5pt; width:180px; color:#333; }
  .score-bar-bg { flex:1; background:#e0e0ee; border-radius:3px; height:7px; }
  .score-bar-fill { height:7px; border-radius:3px; }
  .score-val { font-family:'IBM Plex Mono',monospace; font-size:8.5pt; width:35px; text-align:right; font-weight:600; }
  .big-score { font-family:'IBM Plex Mono',monospace; font-size:48pt; font-weight:700; line-height:1; }
  .page-break { page-break-before:always; }
</style>
</head>
<body>

<div class="report-header">
  <div>
    <div class="report-logo">◈ NEXUS ASIA</div>
    <div style="color:#8888aa;font-size:9pt;margin-top:4px;">Real Estate Credit Intelligence Terminal</div>
    <div style="margin-top:16px;color:#fff;font-size:13pt;font-weight:600;">${project.name}</div>
    <div style="color:#8888aa;font-size:9pt;margin-top:3px;">${project.city}, ${project.state} · ${project.type} · ${project.totalUnits} Units</div>
  </div>
  <div class="report-meta">
    <div class="risk-badge">${score.alertLevel} · ${score.totalScore}/100</div>
    <div style="margin-top:10px;">Project ID: ${project.id}</div>
    <div>Loan: ${loan ? loan.id : 'N/A'} · ${loan ? loan.lender : 'N/A'}</div>
    <div style="margin-top:4px;">Report Generated: ${now}</div>
    <div>Lender Monitoring Report — CONFIDENTIAL</div>
  </div>
</div>

<div class="section">
  <h2>Executive Summary</h2>
  <div class="grid-4">
    <div class="metric-box ${score.alertLevel === 'GREEN' ? 'green' : score.alertLevel === 'AMBER' ? 'amber' : 'red'}">
      <div class="label">Risk Score</div>
      <div class="value">${score.totalScore}/100</div>
      <div class="sub">${score.alertLevel} Status</div>
    </div>
    <div class="metric-box ${project.dscr >= 1.3 ? 'green' : project.dscr >= 1.0 ? 'amber' : 'red'}">
      <div class="label">DSCR</div>
      <div class="value">${project.dscr.toFixed(2)}x</div>
      <div class="sub">Min Covenant: 1.00x</div>
    </div>
    <div class="metric-box ${project.ltv <= 65 ? 'green' : project.ltv <= 80 ? 'amber' : 'red'}">
      <div class="label">LTV Ratio</div>
      <div class="value">${project.ltv}%</div>
      <div class="sub">LTC: ${project.ltc}%</div>
    </div>
    <div class="metric-box ${project.costOverrun <= 5 ? 'green' : project.costOverrun <= 15 ? 'amber' : 'red'}">
      <div class="label">Cost Overrun</div>
      <div class="value">${project.costOverrun.toFixed(1)}%</div>
      <div class="sub">Max Permitted: 20%</div>
    </div>
  </div>
  <div style="margin-top:14px;color:#444;font-size:9.5pt;line-height:1.6;">${project.description}. This project is financed by ${loan ? loan.lender : 'an institutional lender'} with a sanctioned limit of ${loan ? formatCurrency(loan.sanctionedAmount) : 'N/A'} at ${loan ? loan.interestRate : 'N/A'}% p.a. Developer: ${developer ? developer.name : 'Unknown'} (Risk Tier: ${developer ? developer.tier : 'N/A'}).</div>
</div>

<div class="section">
  <div class="grid-2">
    <div>
      <h2>Loan Structure</h2>
      <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>Loan ID</td><td style="font-family:'IBM Plex Mono',monospace">${loan ? loan.id : 'N/A'}</td></tr>
        <tr><td>Lender</td><td>${loan ? loan.lender : 'N/A'}</td></tr>
        <tr><td>Loan Type</td><td>${loan ? loan.loanType : 'N/A'}</td></tr>
        <tr><td>Sanctioned Amount</td><td style="font-family:'IBM Plex Mono',monospace">${loan ? formatCurrency(loan.sanctionedAmount) : 'N/A'}</td></tr>
        <tr><td>Disbursed Amount</td><td style="font-family:'IBM Plex Mono',monospace">${loan ? formatCurrency(loan.disbursedAmount) : 'N/A'}</td></tr>
        <tr><td>Outstanding Balance</td><td style="font-family:'IBM Plex Mono',monospace"><b>${loan ? formatCurrency(loan.outstandingAmount) : 'N/A'}</b></td></tr>
        <tr><td>Interest Rate</td><td>${loan ? loan.interestRate + '% p.a.' : 'N/A'}</td></tr>
        <tr><td>Loan Tenure</td><td>${loan ? loan.tenure + ' months' : 'N/A'}</td></tr>
        <tr><td>Start Date</td><td>${loan ? formatDate(loan.startDate) : 'N/A'}</td></tr>
        <tr><td>End Date</td><td>${loan ? formatDate(loan.endDate) : 'N/A'}</td></tr>
        <tr><td>Loan Status</td><td><span style="font-weight:700;color:${loan && loan.status === 'ACTIVE' ? '#006633' : loan && loan.status === 'NPA' ? '#cc1133' : '#cc7700'}">${loan ? loan.status : 'N/A'}</span></td></tr>
      </table>
    </div>
    <div>
      <h2>Project Overview</h2>
      <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>Project ID</td><td style="font-family:'IBM Plex Mono',monospace">${project.id}</td></tr>
        <tr><td>Developer</td><td>${developer ? developer.name : 'N/A'}</td></tr>
        <tr><td>Location</td><td>${project.city}, ${project.state}</td></tr>
        <tr><td>Project Type</td><td>${project.type}</td></tr>
        <tr><td>Total Units</td><td style="font-family:'IBM Plex Mono',monospace">${project.totalUnits.toLocaleString()}</td></tr>
        <tr><td>Units Sold</td><td style="font-family:'IBM Plex Mono',monospace">${project.unitsSold.toLocaleString()} (${salesPct}%)</td></tr>
        <tr><td>Launch Date</td><td>${formatDate(project.launchDate)}</td></tr>
        <tr><td>Target Completion</td><td>${formatDate(project.completionDate)}</td></tr>
        <tr><td>Construction Progress</td><td style="font-weight:700">${project.constructionProgress}% (Scheduled: ${project.scheduledProgress}%)</td></tr>
        <tr><td>Sales Velocity</td><td>${project.salesVelocity} units/month (Target: ${project.salesTarget})</td></tr>
        <tr><td>Escrow Coverage</td><td style="color:${parseFloat(escrowRatio) >= 100 ? '#006633' : parseFloat(escrowRatio) >= 80 ? '#cc7700' : '#cc1133'}">${escrowRatio}%</td></tr>
      </table>
    </div>
  </div>
</div>

<div class="section">
  <h2>Risk Score Breakdown</h2>
  <div class="grid-2">
    <div>
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;">
        <div>
          <div class="big-score" style="color:${alertColor}">${score.totalScore}</div>
          <div style="font-size:9pt;color:#888;margin-top:4px;">OUT OF 100</div>
        </div>
        <div>
          <div class="risk-badge">${score.alertLevel}</div>
          <div style="margin-top:8px;font-size:8.5pt;color:#555">${redAlerts.length} RED · ${amberAlerts.length} AMBER Alert${amberAlerts.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
    <div>
      ${Object.entries(score.components || {}).map(([key, val]) => {
        const labels = { financialHealth: 'Financial Health (20%)', constructionProgress: 'Construction Progress (15%)', salesVelocity: 'Sales Velocity (15%)', cashFlowAdequacy: 'Cash Flow Adequacy (15%)', sponsorRisk: 'Sponsor Risk (10%)', marketConditions: 'Market Conditions (10%)', capitalStackStability: 'Capital Stack (10%)', regulatoryRisk: 'Regulatory Risk (5%)' };
        const color = val >= 70 ? '#006633' : val >= 45 ? '#cc7700' : '#cc1133';
        return `<div class="score-row">
          <div class="score-label">${labels[key] || key}</div>
          <div class="score-bar-bg"><div class="score-bar-fill" style="width:${val}%;background:${color}"></div></div>
          <div class="score-val" style="color:${color}">${Math.round(val)}</div>
        </div>`;
      }).join('')}
    </div>
  </div>
</div>

${liveAlerts.length > 0 ? `
<div class="section">
  <h2>Active Alerts (${liveAlerts.length} Total — ${redAlerts.length} Critical)</h2>
  ${liveAlerts.map(a => `
    <div class="alert-box ${a.level.toLowerCase()}">
      <div class="alert-type">${a.level} ALERT · ${a.category}</div>
      <div class="alert-msg">${a.message}</div>
    </div>
  `).join('')}
</div>` : '<div class="section"><h2>Active Alerts</h2><p style="color:#888;font-size:9pt;">No active alerts. Project monitoring status: Normal.</p></div>'}

<div class="section">
  <h2>Construction & Sales Progress</h2>
  <div class="grid-2">
    <div>
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:9pt;">Actual Progress</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-weight:600">${project.constructionProgress}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${project.constructionProgress}%;background:${constructionVariance >= 0 ? '#00aa55' : constructionVariance >= -10 ? '#ffaa00' : '#ff3355'}"></div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:9pt;">Scheduled Progress</span>
          <span style="font-family:'IBM Plex Mono',monospace">${project.scheduledProgress}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${project.scheduledProgress}%;background:#aaaacc"></div>
        </div>
      </div>
      <div style="margin-top:10px;font-size:8.5pt;color:${constructionVariance >= 0 ? '#006633' : '#cc1133'};">
        Variance: ${constructionVariance >= 0 ? '+' : ''}${constructionVariance.toFixed(1)}% vs schedule
      </div>
    </div>
    <div>
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:9pt;">Units Sold</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-weight:600">${project.unitsSold} / ${project.totalUnits} (${salesPct}%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${salesPct}%;background:#0099ff"></div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:9pt;">Monthly Velocity vs Target</span>
          <span style="font-family:'IBM Plex Mono',monospace">${project.salesVelocity} / ${project.salesTarget} units</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${Math.min(100, (project.salesVelocity/project.salesTarget)*100)}%;background:${project.salesVelocity >= project.salesTarget ? '#00aa55' : '#ffaa00'}"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="section">
  <h2>Developer / Sponsor Profile</h2>
  <div class="grid-4">
    <div class="metric-box">
      <div class="label">Developer</div>
      <div class="value" style="font-size:11pt">${developer ? developer.name : 'N/A'}</div>
      <div class="sub">HQ: ${developer ? developer.hq : 'N/A'}</div>
    </div>
    <div class="metric-box ${developer && developer.tier === 'AAA' ? 'green' : developer && (developer.tier === 'C' || developer.tier === 'D') ? 'red' : 'amber'}">
      <div class="label">Risk Tier</div>
      <div class="value">${developer ? developer.tier : 'N/A'}</div>
      <div class="sub">Score: ${developer ? developer.riskScore : 'N/A'}/100</div>
    </div>
    <div class="metric-box ${developer && developer.pastDefaults === 0 ? 'green' : 'red'}">
      <div class="label">Past Defaults</div>
      <div class="value">${developer ? developer.pastDefaults : 'N/A'}</div>
      <div class="sub">Delays: ${developer ? developer.pastDelays : 'N/A'}</div>
    </div>
    <div class="metric-box">
      <div class="label">Portfolio Exposure</div>
      <div class="value" style="font-size:10pt">${developer ? formatCurrency(developer.portfolioExposure) : 'N/A'}</div>
      <div class="sub">Active: ${developer ? developer.activeProjects : 'N/A'} projects</div>
    </div>
  </div>
</div>

<div class="footer">
  <div style="display:flex;justify-content:space-between;">
    <div>◈ NEXUS ASIA — Real Estate Credit Intelligence Terminal · CONFIDENTIAL LENDER REPORT</div>
    <div>Report ID: NX-${project.id}-${Date.now()} · Generated: ${now}</div>
  </div>
  <div style="margin-top:6px;color:#555;">This report is generated for institutional lender use only. All data is indicative and subject to field verification. Not for distribution.</div>
</div>

</body>
</html>`;
  }

  function generateCSV(project, developer, loan, alerts, scoreResult) {
    const score = scoreResult || { totalScore: project.riskScore, alertLevel: project.alertLevel, components: {} };
    const liveAlerts = alerts || RiskEngine.detectAlerts(project, developer, loan);

    const rows = [
      ['NEXUS ASIA - Lender Report', '', '', ''],
      ['Generated', new Date().toISOString(), '', ''],
      ['', '', '', ''],
      ['PROJECT OVERVIEW', '', '', ''],
      ['Project ID', project.id, 'Project Name', project.name],
      ['Developer', developer ? developer.name : 'N/A', 'City', project.city],
      ['State', project.state, 'Project Type', project.type],
      ['Total Units', project.totalUnits, 'Units Sold', project.unitsSold],
      ['Launch Date', project.launchDate, 'Completion Date', project.completionDate],
      ['', '', '', ''],
      ['RISK METRICS', '', '', ''],
      ['Risk Score', score.totalScore, 'Alert Level', score.alertLevel],
      ['DSCR', project.dscr, 'LTV', project.ltv + '%'],
      ['LTC', project.ltc + '%', 'Cost Overrun', project.costOverrun + '%'],
      ['Construction Progress', project.constructionProgress + '%', 'Scheduled Progress', project.scheduledProgress + '%'],
      ['Sales Velocity', project.salesVelocity + ' units/mo', 'Sales Target', project.salesTarget + ' units/mo'],
      ['Escrow Balance', project.escrowBalance, 'Escrow Required', project.escrowRequired],
      ['', '', '', ''],
      ['LOAN DETAILS', '', '', ''],
      ['Loan ID', loan ? loan.id : 'N/A', 'Lender', loan ? loan.lender : 'N/A'],
      ['Sanctioned Amount', loan ? loan.sanctionedAmount : 'N/A', 'Disbursed Amount', loan ? loan.disbursedAmount : 'N/A'],
      ['Outstanding Amount', loan ? loan.outstandingAmount : 'N/A', 'Interest Rate', loan ? loan.interestRate + '%' : 'N/A'],
      ['Loan Status', loan ? loan.status : 'N/A', 'Tenure', loan ? loan.tenure + ' months' : 'N/A'],
      ['', '', '', ''],
      ['ACTIVE ALERTS', '', '', ''],
      ['Level', 'Category', 'Message', ''],
      ...liveAlerts.map(a => [a.level, a.category, a.message, ''])
    ];

    return rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  function downloadPDF(project, developer, loan, alerts, scoreResult) {
    const html = generateReportHTML(project, developer, loan, alerts, scoreResult);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => {
        setTimeout(() => { win.print(); }, 500);
      };
    }
  }

  function downloadCSV(project, developer, loan, alerts, scoreResult) {
    const csv = generateCSV(project, developer, loan, alerts, scoreResult);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `NEXUS_${project.id}_${project.name.replace(/\s+/g, '_')}_Report.csv`;
    a.click();
  }

  return { generateReportHTML, generateCSV, downloadPDF, downloadCSV };
})();
