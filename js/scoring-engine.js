// NEXUS ASIA - Risk Scoring Engine
// Weighted scoring system: 0-100 scale

const RiskEngine = (() => {
  const WEIGHTS = {
    financialHealth: 0.20,
    constructionProgress: 0.15,
    salesVelocity: 0.15,
    cashFlowAdequacy: 0.15,
    sponsorRisk: 0.10,
    marketConditions: 0.10,
    capitalStackStability: 0.10,
    regulatoryRisk: 0.05
  };

  function scoreFinancialHealth(project, loan) {
    let score = 100;
    const dscr = project.dscr;
    const ltv = project.ltv;
    const ltc = project.ltc;
    const costOverrun = project.costOverrun;

    // DSCR scoring
    if (dscr >= 1.5) score -= 0;
    else if (dscr >= 1.3) score -= 10;
    else if (dscr >= 1.1) score -= 25;
    else if (dscr >= 1.0) score -= 45;
    else score -= 80;

    // LTV scoring
    if (ltv <= 55) score -= 0;
    else if (ltv <= 65) score -= 8;
    else if (ltv <= 75) score -= 20;
    else if (ltv <= 85) score -= 40;
    else score -= 70;

    // Cost overrun scoring
    if (costOverrun <= 3) score -= 0;
    else if (costOverrun <= 8) score -= 10;
    else if (costOverrun <= 15) score -= 25;
    else if (costOverrun <= 25) score -= 50;
    else score -= 80;

    return Math.max(0, Math.min(100, score));
  }

  function scoreConstructionProgress(project) {
    const actual = project.constructionProgress;
    const scheduled = project.scheduledProgress;
    const variance = actual - scheduled;
    const delayDays = Math.max(0, (scheduled - actual) / 100 * 365);

    let score = 100;

    if (variance >= 3) score = 100;
    else if (variance >= 0) score = 90;
    else if (variance >= -5) score = 75;
    else if (variance >= -10) score = 58;
    else if (variance >= -20) score = 38;
    else score = 15;

    // Absolute delay penalty
    if (delayDays > 90) score = Math.min(score, 25);
    else if (delayDays > 60) score = Math.min(score, 45);
    else if (delayDays > 45) score = Math.min(score, 60);

    return Math.max(0, Math.min(100, score));
  }

  function scoreSalesVelocity(project) {
    const actual = project.salesVelocity;
    const target = project.salesTarget;
    const ratio = actual / target;
    const soldPct = (project.unitsSold / project.totalUnits) * 100;

    let score = 100;

    if (ratio >= 1.1) score = 100;
    else if (ratio >= 1.0) score = 92;
    else if (ratio >= 0.85) score = 75;
    else if (ratio >= 0.70) score = 55;
    else if (ratio >= 0.55) score = 35;
    else score = 12;

    // Boost for high sold percentage
    if (soldPct >= 85) score = Math.min(100, score + 10);
    else if (soldPct >= 70) score = Math.min(100, score + 5);

    return Math.max(0, Math.min(100, score));
  }

  function scoreCashFlow(project) {
    const escrowBalance = project.escrowBalance;
    const escrowRequired = project.escrowRequired;
    const ratio = escrowBalance / escrowRequired;

    let score = 100;

    if (ratio >= 1.2) score = 100;
    else if (ratio >= 1.0) score = 85;
    else if (ratio >= 0.85) score = 65;
    else if (ratio >= 0.70) score = 42;
    else if (ratio >= 0.50) score = 22;
    else score = 5;

    // DSCR modifier
    if (project.dscr < 1.0) score = Math.min(score, 20);
    else if (project.dscr < 1.1) score = Math.min(score, 50);

    return Math.max(0, Math.min(100, score));
  }

  function scoreSponsorRisk(developer) {
    if (!developer) return 50;
    let score = 100;

    // Past defaults
    if (developer.pastDefaults === 0) score -= 0;
    else if (developer.pastDefaults === 1) score -= 25;
    else if (developer.pastDefaults === 2) score -= 50;
    else score -= 80;

    // Past delays ratio
    const delayRatio = developer.pastDelays / Math.max(developer.totalProjects, 1);
    if (delayRatio <= 0.05) score -= 0;
    else if (delayRatio <= 0.10) score -= 10;
    else if (delayRatio <= 0.20) score -= 25;
    else if (delayRatio <= 0.35) score -= 45;
    else score -= 65;

    // Tier rating
    const tierScores = { AAA: 0, AA: 5, A: 15, B: 30, C: 55, D: 80 };
    score -= (tierScores[developer.tier] || 40);

    return Math.max(0, Math.min(100, score));
  }

  function scoreMarketConditions(project, marketData) {
    const cityData = marketData ? marketData.find(m => m.city === project.city || m.city === project.state) : null;
    if (!cityData) return 65;

    let score = 100;

    // Absorption rate
    if (cityData.absorption >= 80) score -= 0;
    else if (cityData.absorption >= 65) score -= 10;
    else if (cityData.absorption >= 50) score -= 25;
    else score -= 45;

    // Price change (positive = good)
    if (cityData.priceChange >= 10) score += 5;
    else if (cityData.priceChange >= 5) score += 0;
    else if (cityData.priceChange >= 0) score -= 10;
    else score -= 25;

    // Demand index
    if (cityData.demandIndex >= 80) score -= 0;
    else if (cityData.demandIndex >= 65) score -= 8;
    else if (cityData.demandIndex >= 50) score -= 20;
    else score -= 38;

    return Math.max(0, Math.min(100, score));
  }

  function scoreCapitalStack(project, loan) {
    if (!loan) return 50;
    let score = 100;

    const ltc = project.ltc;
    if (ltc <= 55) score = 100;
    else if (ltc <= 65) score = 88;
    else if (ltc <= 72) score = 72;
    else if (ltc <= 80) score = 52;
    else if (ltc <= 90) score = 30;
    else score = 8;

    // Loan status modifier
    if (loan.status === 'ACTIVE') score = Math.min(score, 100);
    else if (loan.status === 'WATCH') score = Math.min(score, 65);
    else if (loan.status === 'NPA') score = Math.min(score, 15);

    return Math.max(0, Math.min(100, score));
  }

  function scoreRegulatoryRisk(project) {
    // Simplified scoring based on project type and location
    let score = 85;
    const highRiskStates = ['Uttar Pradesh', 'Maharashtra'];
    const highRiskTypes = ['Township', 'Mixed Use'];

    if (highRiskStates.includes(project.state)) score -= 10;
    if (highRiskTypes.includes(project.type)) score -= 8;
    if (project.riskScore < 40) score -= 20; // Already in distress

    return Math.max(0, Math.min(100, score));
  }

  function computeScore(project, developer, loan, marketData) {
    const components = {
      financialHealth: scoreFinancialHealth(project, loan),
      constructionProgress: scoreConstructionProgress(project),
      salesVelocity: scoreSalesVelocity(project),
      cashFlowAdequacy: scoreCashFlow(project),
      sponsorRisk: scoreSponsorRisk(developer),
      marketConditions: scoreMarketConditions(project, marketData),
      capitalStackStability: scoreCapitalStack(project, loan),
      regulatoryRisk: scoreRegulatoryRisk(project)
    };

    const totalScore = Object.entries(components).reduce((acc, [key, val]) => {
      return acc + (val * WEIGHTS[key]);
    }, 0);

    const alertLevel = totalScore >= 70 ? 'GREEN' : totalScore >= 45 ? 'AMBER' : 'RED';

    return {
      totalScore: Math.round(totalScore),
      alertLevel,
      components,
      weights: WEIGHTS
    };
  }

  function detectAlerts(project, developer, loan) {
    const alerts = [];

    // RED conditions
    const delayDays = Math.max(0, (project.scheduledProgress - project.constructionProgress) / 100 * 365);
    if (delayDays > 90) alerts.push({ level: 'RED', category: 'Construction Delay', message: `Construction delayed ${Math.round(delayDays)} days (${project.scheduledProgress - project.constructionProgress}% behind schedule)` });
    if (project.dscr < 1.0) alerts.push({ level: 'RED', category: 'DSCR Breach', message: `DSCR at ${project.dscr.toFixed(2)} — below minimum covenant of 1.0` });
    if (project.costOverrun > 20) alerts.push({ level: 'RED', category: 'Cost Overrun', message: `Cost overrun of ${project.costOverrun.toFixed(1)}% exceeds 20% threshold. LTC at ${project.ltc}%` });
    const salesDrop = (project.salesTarget - project.salesVelocity) / project.salesTarget * 100;
    if (salesDrop > 40) alerts.push({ level: 'RED', category: 'Sales Velocity Drop', message: `Sales velocity down ${salesDrop.toFixed(0)}% vs target (${project.salesVelocity} vs ${project.salesTarget} units/mo)` });
    const escrowRatio = project.escrowBalance / project.escrowRequired;
    if (escrowRatio < 0.5) alerts.push({ level: 'RED', category: 'Escrow Deficit', message: `Critical escrow deficit. Balance: ₹${(project.escrowBalance/10000000).toFixed(1)}Cr vs Required: ₹${(project.escrowRequired/10000000).toFixed(1)}Cr` });

    // AMBER conditions
    if (delayDays > 45 && delayDays <= 90) alerts.push({ level: 'AMBER', category: 'Construction Delay', message: `Construction delayed ${Math.round(delayDays)} days — approaching critical threshold` });
    if (salesDrop > 25 && salesDrop <= 40) alerts.push({ level: 'AMBER', category: 'Sales Slowdown', message: `Sales velocity down ${salesDrop.toFixed(0)}% vs target — monitor closely` });
    if (project.dscr >= 1.0 && project.dscr < 1.15) alerts.push({ level: 'AMBER', category: 'DSCR Pressure', message: `DSCR of ${project.dscr.toFixed(2)} approaching covenant threshold. Buffer: ${((project.dscr - 1.0) * 100).toFixed(0)}bps` });
    if (escrowRatio >= 0.5 && escrowRatio < 0.85) alerts.push({ level: 'AMBER', category: 'Escrow Watch', message: `Escrow coverage ratio at ${(escrowRatio * 100).toFixed(0)}% — building deficit risk` });
    if (developer && developer.pastDefaults > 0) alerts.push({ level: 'AMBER', category: 'Sponsor Risk', message: `Sponsor has ${developer.pastDefaults} historical default(s) — elevated monitoring required` });

    return alerts;
  }

  function getScoreColor(score) {
    if (score >= 75) return '#00ff88';
    if (score >= 50) return '#ffaa00';
    return '#ff3355';
  }

  function getAlertColor(level) {
    if (level === 'GREEN') return '#00ff88';
    if (level === 'AMBER') return '#ffaa00';
    return '#ff3355';
  }

  function getAlertBg(level) {
    if (level === 'GREEN') return 'rgba(0,255,136,0.08)';
    if (level === 'AMBER') return 'rgba(255,170,0,0.08)';
    return 'rgba(255,51,85,0.08)';
  }

  return { computeScore, detectAlerts, getScoreColor, getAlertColor, getAlertBg, WEIGHTS };
})();
