// NEXUS ASIA — Risk Scoring Engine v2.0
// Actual credit formulas used by Indian CRE lenders / NBFCs / AIFs
// Replaces step-function lookups with derived financial ratios

const RiskEngine = (() => {

  const WEIGHTS = {
    financialHealth:      0.20,
    constructionProgress: 0.15,
    salesVelocity:        0.15,
    cashFlowAdequacy:     0.15,
    sponsorRisk:          0.10,
    marketConditions:     0.10,
    capitalStackStability:0.10,
    regulatoryRisk:       0.05
  };

  // ── Formula 1: Collection Efficiency Ratio ──────────────────────────────
  function collectionEfficiencyRatio(p) {
    const avgUnitPrice = p.avgUnitPrice || (p.gdv / p.totalUnits);
    const milestone    = (p.constructionProgress || 0) / 100;
    const expected     = (p.unitsSold || 0) * avgUnitPrice * milestone;
    if (expected <= 0) return null;
    return (p.actualCollections || 0) / expected;
  }

  // ── Formula 2: Months to Sell Out ───────────────────────────────────────
  function monthsToSellOut(p) {
    const unsold   = (p.totalUnits || 0) - (p.unitsSold || 0);
    const velocity = p.salesVelocity || 0;
    if (velocity <= 0) return Infinity;
    return unsold / velocity;
  }

  // ── Formula 3: Unsold Inventory Cover ──────────────────────────────────
  function unsoldInventoryCover(p, loan) {
    const avgUnitPrice   = p.avgUnitPrice || (p.gdv / p.totalUnits);
    const unsold         = (p.totalUnits || 0) - (p.unitsSold || 0);
    const inventoryValue = unsold * avgUnitPrice;
    const outstanding    = loan?.outstandingAmount || 1;
    return inventoryValue / outstanding;
  }

  // ── Formula 4: Cost-to-Complete Ratio ──────────────────────────────────
  function costToCompleteRatio(p, loan) {
    const remaining = p.costToComplete || 0;
    const undrawn   = loan ? (loan.sanctionedAmount - loan.disbursedAmount) : 0;
    if (undrawn <= 0) return remaining > 0 ? Infinity : 0;
    return remaining / undrawn;
  }

  // ── Formula 5: Escrow Velocity ──────────────────────────────────────────
  function escrowVelocity(p) {
    if (p.escrowPrev == null) return null;
    return (p.escrowBalance || 0) - (p.escrowPrev || 0);
  }

  // ── Formula 6: Liquidation-Adjusted Equity Cushion ──────────────────────
  function liquidationAdjustedEquityCushion(p, loan) {
    const HAIRCUT   = p.distressHaircut || 0.65;
    const gdv       = p.gdv || 0;
    const totalDebt = loan?.outstandingAmount || 0;
    const stressed  = gdv * HAIRCUT;
    if (stressed <= 0) return null;
    return (stressed - totalDebt) / stressed;
  }

  // ── Formula 7: Interest Coverage Ratio ─────────────────────────────────
  function interestCoverageRatio(p, loan) {
    const ebitda    = p.ebitda || 0;
    const rate      = (loan?.interestRate || 0) / 100;
    const principal = loan?.outstandingAmount || 0;
    const annualInt = principal * rate;
    if (annualInt <= 0) return null;
    return ebitda / annualInt;
  }

  // ── Formula 8: Expected Credit Loss (IND AS 109) ────────────────────────
  function expectedCreditLoss(p, loan, totalScore) {
    if (!loan) return null;
    const EAD = loan.outstandingAmount || 0;

    let PD;
    if      (totalScore >= 75) PD = 0.01;
    else if (totalScore >= 55) PD = 0.05;
    else if (totalScore >= 40) PD = 0.15;
    else if (totalScore >= 25) PD = 0.40;
    else                       PD = 0.80;

    const uic  = unsoldInventoryCover(p, loan);
    const laec = liquidationAdjustedEquityCushion(p, loan);
    const recoveryRate = Math.min(0.90, Math.max(0.10,
      ((uic  != null ? Math.min(uic,  2) / 2 : 0) * 0.50) +
      ((laec != null ? Math.min(Math.max(laec, 0), 1) : 0) * 0.50)
    ));
    const LGD = 1 - recoveryRate;

    return { ecl: PD * LGD * EAD, PD, LGD, EAD, recoveryRate };
  }

  // ── Component scorers ───────────────────────────────────────────────────

  function scoreFinancialHealth(project, loan) {
    let score = 100;
    const dscr = project.dscr || 0;

    if      (dscr >= 1.5)  score -= 0;
    else if (dscr >= 1.3)  score -= 10;
    else if (dscr >= 1.1)  score -= 25;
    else if (dscr >= 1.0)  score -= 40;
    else                   score -= 75;

    const icr = interestCoverageRatio(project, loan);
    if (icr !== null) {
      if      (icr >= 2.0) score -= 0;
      else if (icr >= 1.5) score -= 5;
      else if (icr >= 1.2) score -= 12;
      else if (icr >= 1.0) score -= 22;
      else                 score -= 40;
    }

    const ltv = project.ltv || 0;
    if      (ltv <= 55) score -= 0;
    else if (ltv <= 65) score -= 8;
    else if (ltv <= 75) score -= 18;
    else if (ltv <= 85) score -= 38;
    else                score -= 65;

    const overrun = project.costOverrun || 0;
    if      (overrun <= 3)  score -= 0;
    else if (overrun <= 8)  score -= 8;
    else if (overrun <= 15) score -= 20;
    else if (overrun <= 25) score -= 45;
    else                    score -= 75;

    const c2c = costToCompleteRatio(project, loan);
    if (isFinite(c2c) && c2c > 0) {
      if      (c2c <= 0.80) score -= 0;
      else if (c2c <= 0.95) score -= 8;
      else if (c2c <= 1.00) score -= 20;
      else if (c2c <= 1.15) score -= 40;
      else                  score -= 65;
    } else if (!isFinite(c2c) && (project.costToComplete || 0) > 0) {
      score -= 65;
    }

    return Math.max(0, Math.min(100, score));
  }

  function scoreConstructionProgress(project) {
    const actual    = project.constructionProgress || 0;
    const scheduled = project.scheduledProgress    || 0;
    const variance  = actual - scheduled;
    const delayDays = Math.max(0, (scheduled - actual) / 100 * 365);

    let score = 100;
    if      (variance >= 3)   score = 100;
    else if (variance >= 0)   score = 90;
    else if (variance >= -5)  score = 75;
    else if (variance >= -10) score = 58;
    else if (variance >= -20) score = 38;
    else                      score = 15;

    if      (delayDays > 90)  score = Math.min(score, 25);
    else if (delayDays > 60)  score = Math.min(score, 45);
    else if (delayDays > 45)  score = Math.min(score, 60);

    return Math.max(0, Math.min(100, score));
  }

  function scoreSalesVelocity(project, loan) {
    const actual  = project.salesVelocity || 0;
    const target  = project.salesTarget   || 1;
    const ratio   = actual / target;
    const soldPct = ((project.unitsSold || 0) / (project.totalUnits || 1)) * 100;

    let score = 100;
    if      (ratio >= 1.1)  score = 100;
    else if (ratio >= 1.0)  score = 92;
    else if (ratio >= 0.85) score = 75;
    else if (ratio >= 0.70) score = 55;
    else if (ratio >= 0.55) score = 35;
    else                    score = 12;

    if      (soldPct >= 85) score = Math.min(100, score + 10);
    else if (soldPct >= 70) score = Math.min(100, score + 5);

    const mts = monthsToSellOut(project);
    if (loan && isFinite(mts)) {
      const monthsLeft = Math.max(0, (new Date(loan.endDate) - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
      if (monthsLeft > 0) {
        const mtsRatio = mts / monthsLeft;
        if      (mtsRatio <= 0.50) score = Math.min(100, score + 5);
        else if (mtsRatio <= 0.80) score -= 0;
        else if (mtsRatio <= 1.00) score -= 10;
        else if (mtsRatio <= 1.30) score -= 25;
        else                       score -= 45;
      }
    }

    const uic = unsoldInventoryCover(project, loan);
    if (uic !== null) {
      if      (uic >= 2.0) score = Math.min(100, score + 5);
      else if (uic >= 1.2) score -= 0;
      else if (uic >= 1.0) score -= 10;
      else if (uic >= 0.7) score -= 25;
      else                 score -= 45;
    }

    return Math.max(0, Math.min(100, score));
  }

  function scoreCashFlow(project, loan) {
    const ratio = (project.escrowBalance || 0) / Math.max(project.escrowRequired || 1, 1);
    let score = 100;

    if      (ratio >= 1.2)  score = 100;
    else if (ratio >= 1.0)  score = 85;
    else if (ratio >= 0.85) score = 65;
    else if (ratio >= 0.70) score = 42;
    else if (ratio >= 0.50) score = 22;
    else                    score = 5;

    const ev = escrowVelocity(project);
    if (ev !== null) {
      const evRatio = ev / Math.max(project.escrowRequired || 1, 1);
      if      (evRatio >= 0.05)  score = Math.min(100, score + 8);
      else if (evRatio >= 0)     score -= 0;
      else if (evRatio >= -0.03) score -= 8;
      else if (evRatio >= -0.08) score -= 20;
      else                       score -= 35;
    }

    const cer = collectionEfficiencyRatio(project);
    if (cer !== null) {
      if      (cer >= 0.95) score = Math.min(100, score + 5);
      else if (cer >= 0.85) score -= 0;
      else if (cer >= 0.75) score -= 10;
      else if (cer >= 0.60) score -= 22;
      else                  score -= 40;
    }

    if (project.dscr < 1.0) {
      const icr = interestCoverageRatio(project, loan);
      score = Math.min(score, icr !== null && icr < 1.0 ? 12 : 20);
    } else if (project.dscr < 1.1) {
      score = Math.min(score, 50);
    }

    return Math.max(0, Math.min(100, score));
  }

  function scoreSponsorRisk(developer) {
    if (!developer) return 50;
    let score = 100;

    if      (developer.pastDefaults === 0) score -= 0;
    else if (developer.pastDefaults === 1) score -= 25;
    else if (developer.pastDefaults === 2) score -= 50;
    else                                   score -= 80;

    const delayRatio = developer.pastDelays / Math.max(developer.totalProjects, 1);
    if      (delayRatio <= 0.05) score -= 0;
    else if (delayRatio <= 0.10) score -= 10;
    else if (delayRatio <= 0.20) score -= 25;
    else if (delayRatio <= 0.35) score -= 45;
    else                         score -= 65;

    const tierScores = { AAA: 0, AA: 5, A: 15, B: 30, C: 55, D: 80 };
    score -= (tierScores[developer.tier] || 40);

    return Math.max(0, Math.min(100, score));
  }

  function scoreMarketConditions(project, marketData) {
    const cityData = marketData
      ? marketData.find(m => m.city === project.city || m.city === project.state)
      : null;
    if (!cityData) return 65;

    let score = 100;

    if      (cityData.absorption >= 80) score -= 0;
    else if (cityData.absorption >= 65) score -= 10;
    else if (cityData.absorption >= 50) score -= 25;
    else                                score -= 45;

    if      (cityData.priceChange >= 10) score += 5;
    else if (cityData.priceChange >= 5)  score -= 0;
    else if (cityData.priceChange >= 0)  score -= 10;
    else                                 score -= 25;

    if      (cityData.demandIndex >= 80) score -= 0;
    else if (cityData.demandIndex >= 65) score -= 8;
    else if (cityData.demandIndex >= 50) score -= 20;
    else                                 score -= 38;

    return Math.max(0, Math.min(100, score));
  }

  function scoreCapitalStack(project, loan) {
    if (!loan) return 50;

    const laec = liquidationAdjustedEquityCushion(project, loan);
    let score = 100;

    if (laec !== null) {
      if      (laec >= 0.30) score = 100;
      else if (laec >= 0.20) score = 85;
      else if (laec >= 0.10) score = 65;
      else if (laec >= 0.05) score = 42;
      else if (laec >= 0.00) score = 22;
      else                   score = 5;
    } else {
      const ltc = project.ltc || 80;
      if      (ltc <= 55) score = 100;
      else if (ltc <= 65) score = 88;
      else if (ltc <= 72) score = 72;
      else if (ltc <= 80) score = 52;
      else if (ltc <= 90) score = 30;
      else                score = 8;
    }

    if      (loan.status === 'ACTIVE') score = Math.min(score, 100);
    else if (loan.status === 'WATCH')  score = Math.min(score, 65);
    else if (loan.status === 'NPA')    score = Math.min(score, 15);

    return Math.max(0, Math.min(100, score));
  }

  function scoreRegulatoryRisk(project) {
    let score = 85;
    if (['Uttar Pradesh', 'Maharashtra'].includes(project.state)) score -= 10;
    if (['Township', 'Mixed Use'].includes(project.type))         score -= 8;
    if ((project.riskScore || 100) < 40)                          score -= 20;
    return Math.max(0, Math.min(100, score));
  }

  // ── Main ────────────────────────────────────────────────────────────────

  function computeScore(project, developer, loan, marketData) {
    const components = {
      financialHealth:      scoreFinancialHealth(project, loan),
      constructionProgress: scoreConstructionProgress(project),
      salesVelocity:        scoreSalesVelocity(project, loan),
      cashFlowAdequacy:     scoreCashFlow(project, loan),
      sponsorRisk:          scoreSponsorRisk(developer),
      marketConditions:     scoreMarketConditions(project, marketData),
      capitalStackStability:scoreCapitalStack(project, loan),
      regulatoryRisk:       scoreRegulatoryRisk(project)
    };

    const totalScore = Object.entries(components).reduce((acc, [key, val]) => {
      return acc + (val * WEIGHTS[key]);
    }, 0);

    const alertLevel = totalScore >= 70 ? 'GREEN' : totalScore >= 45 ? 'AMBER' : 'RED';
    const derivedRatios = computeDerivedRatios(project, loan, Math.round(totalScore));

    return { totalScore: Math.round(totalScore), alertLevel, components, weights: WEIGHTS, derivedRatios };
  }

  function computeDerivedRatios(project, loan, totalScore) {
    const cer  = collectionEfficiencyRatio(project);
    const mts  = monthsToSellOut(project);
    const uic  = unsoldInventoryCover(project, loan);
    const c2c  = costToCompleteRatio(project, loan);
    const ev   = escrowVelocity(project);
    const laec = liquidationAdjustedEquityCushion(project, loan);
    const icr  = interestCoverageRatio(project, loan);
    const ecl  = expectedCreditLoss(project, loan, totalScore || 50);

    let monthsLeft = null;
    if (loan?.endDate) {
      monthsLeft = Math.max(0, (new Date(loan.endDate) - new Date()) / (1000 * 60 * 60 * 24 * 30.44));
    }

    let mtsSignal = null;
    if (isFinite(mts) && monthsLeft !== null && monthsLeft > 0) {
      mtsSignal = mts <= monthsLeft ? 'WITHIN_TENURE'
        : mts <= monthsLeft * 1.3   ? 'BORDERLINE'
        : 'EXCEEDS_TENURE';
    }

    return {
      collectionEfficiency: {
        value: cer, label: 'Collection Efficiency', format: 'pct',
        status: cer == null ? 'N/A' : cer >= 0.95 ? 'GREEN' : cer >= 0.75 ? 'AMBER' : 'RED',
        description: 'Actual ÷ Expected Collections. < 0.75 = buyer defaults emerging.'
      },
      monthsToSellOut: {
        value: isFinite(mts) ? mts : null, label: 'Months to Sell Out', format: 'months',
        monthsLeft, signal: mtsSignal,
        status: mtsSignal === 'WITHIN_TENURE' ? 'GREEN' : mtsSignal === 'BORDERLINE' ? 'AMBER' : mtsSignal === 'EXCEEDS_TENURE' ? 'RED' : 'N/A',
        description: 'Unsold Units ÷ Monthly Velocity. Must be < months left on loan.'
      },
      unsoldInventoryCover: {
        value: uic, label: 'Unsold Inventory Cover', format: 'x',
        status: uic == null ? 'N/A' : uic >= 1.2 ? 'GREEN' : uic >= 1.0 ? 'AMBER' : 'RED',
        description: '(Unsold Units × Avg Price) ÷ Outstanding Loan. < 1.0× = uncovered.'
      },
      costToComplete: {
        value: isFinite(c2c) ? c2c : null, label: 'Cost-to-Complete Ratio', format: 'x',
        status: (!isFinite(c2c) && (project.costToComplete || 0) > 0) ? 'RED'
          : c2c == null ? 'N/A' : c2c <= 0.95 ? 'GREEN' : c2c <= 1.0 ? 'AMBER' : 'RED',
        description: 'Remaining Cost ÷ Undrawn Facility. > 1.0 = funding gap.'
      },
      escrowVelocity: {
        value: ev, label: 'Escrow Velocity', format: 'crore',
        status: ev == null ? 'N/A' : ev > 0 ? 'GREEN' : ev >= -(project.escrowRequired * 0.03 || 0) ? 'AMBER' : 'RED',
        description: 'Monthly ΔEscrow. Negative = collections decelerating.'
      },
      liquidationEquityCushion: {
        value: laec, label: 'Liq-Adj Equity Cushion', format: 'pct',
        haircut: project.distressHaircut || 0.65,
        status: laec == null ? 'N/A' : laec >= 0.20 ? 'GREEN' : laec >= 0.10 ? 'AMBER' : 'RED',
        description: '(GDV×0.65 − Debt) ÷ (GDV×0.65). Indian distress = 65p/₹.'
      },
      icr: {
        value: icr, label: 'Interest Coverage (ICR)', format: 'x',
        status: icr == null ? 'N/A' : icr >= 1.5 ? 'GREEN' : icr >= 1.0 ? 'AMBER' : 'RED',
        description: 'EBITDA ÷ Annual Interest. Bullet-repayment risk when ICR < DSCR.'
      },
      ecl: {
        value: ecl?.ecl || null, pd: ecl?.PD || null, lgd: ecl?.LGD || null, ead: ecl?.EAD || null,
        label: 'Expected Credit Loss (ECL)', format: 'crore',
        stage: ecl?.PD >= 0.40 ? 3 : ecl?.PD >= 0.05 ? 2 : 1,
        status: ecl == null ? 'N/A' : ecl.PD >= 0.40 ? 'RED' : ecl.PD >= 0.05 ? 'AMBER' : 'GREEN',
        description: 'PD × LGD × EAD per IND AS 109. Used for NBFC/AIF provisioning.'
      }
    };
  }

  function detectAlerts(project, developer, loan) {
    const alerts = [];

    const delayDays = Math.max(0, ((project.scheduledProgress || 0) - (project.constructionProgress || 0)) / 100 * 365);
    if      (delayDays > 90) alerts.push({ level: 'RED',   category: 'Construction Delay', message: `Construction delayed ${Math.round(delayDays)} days (${((project.scheduledProgress||0)-(project.constructionProgress||0)).toFixed(0)}% behind schedule)` });
    else if (delayDays > 45) alerts.push({ level: 'AMBER', category: 'Construction Delay', message: `Construction delayed ${Math.round(delayDays)} days — approaching critical threshold` });

    if      (project.dscr < 1.0)  alerts.push({ level: 'RED',   category: 'DSCR Breach',    message: `DSCR at ${project.dscr.toFixed(2)} — below minimum covenant of 1.0` });
    else if (project.dscr < 1.15) alerts.push({ level: 'AMBER', category: 'DSCR Pressure',   message: `DSCR of ${project.dscr.toFixed(2)} approaching covenant. Buffer: ${((project.dscr-1.0)*100).toFixed(0)}bps` });

    const icr = interestCoverageRatio(project, loan);
    if (icr !== null && icr < 1.0)               alerts.push({ level: 'RED',   category: 'ICR Breach',             message: `ICR at ${icr.toFixed(2)}× — interest not covered by operating cash flows` });
    else if (icr !== null && icr < 1.3 && project.dscr >= 1.0) alerts.push({ level: 'AMBER', category: 'ICR / DSCR Divergence', message: `ICR ${icr.toFixed(2)}× vs DSCR ${project.dscr.toFixed(2)} — bullet repayment risk` });

    const cer = collectionEfficiencyRatio(project);
    if (cer !== null && cer < 0.60) alerts.push({ level: 'RED',   category: 'Collection Efficiency', message: `CER at ${(cer*100).toFixed(0)}% — buyer defaults likely. DSCR deterioration in 3-6 months` });
    else if (cer !== null && cer < 0.75) alerts.push({ level: 'AMBER', category: 'Collection Efficiency', message: `CER at ${(cer*100).toFixed(0)}% — collections lagging construction milestones` });

    const mts = monthsToSellOut(project);
    if (loan?.endDate && isFinite(mts)) {
      const ml = Math.max(0, (new Date(loan.endDate) - new Date()) / (1000*60*60*24*30.44));
      if (ml > 0 && mts > ml * 1.3) alerts.push({ level: 'RED',   category: 'Structural Repayment Risk', message: `MTS ${mts.toFixed(0)} mo = ${(mts/ml*100).toFixed(0)}% of remaining tenure. Cannot repay from sales alone.` });
      else if (ml > 0 && mts > ml)   alerts.push({ level: 'AMBER', category: 'Sell-Out Tenure Pressure',  message: `MTS ${mts.toFixed(0)} months vs ${ml.toFixed(0)} months remaining on loan` });
    }

    const uic = unsoldInventoryCover(project, loan);
    if (uic !== null && uic < 1.0) alerts.push({ level: 'RED',   category: 'Inventory Coverage Breach',   message: `UIC at ${uic.toFixed(2)}× — future sales cannot repay outstanding loan` });
    else if (uic !== null && uic < 1.2) alerts.push({ level: 'AMBER', category: 'Inventory Coverage Pressure', message: `UIC at ${uic.toFixed(2)}× — dependent on collection from already-sold units` });

    const c2c = costToCompleteRatio(project, loan);
    if (!isFinite(c2c) && (project.costToComplete || 0) > 0) alerts.push({ level: 'RED', category: 'Funding Gap — No Undrawn',  message: `₹${((project.costToComplete||0)/10000000).toFixed(1)}Cr cost remains with zero undrawn facility` });
    else if (isFinite(c2c) && c2c > 1.0)  alerts.push({ level: 'RED',   category: 'Funding Gap',        message: `C2C ${c2c.toFixed(2)}× — requires top-up to complete construction` });
    else if (isFinite(c2c) && c2c > 0.95) alerts.push({ level: 'AMBER', category: 'Funding Tightness',   message: `C2C Ratio at ${c2c.toFixed(2)}× — undrawn barely covers remaining cost` });

    const ev = escrowVelocity(project);
    if (ev !== null && ev < -(project.escrowRequired||0)*0.08) alerts.push({ level: 'RED',   category: 'Escrow Velocity — Rapid Decline', message: `Escrow declining ₹${Math.abs(ev/10000000).toFixed(1)}Cr/month — deficit likely within 90 days` });
    else if (ev !== null && ev < 0)                             alerts.push({ level: 'AMBER', category: 'Escrow Velocity — Declining',     message: `Escrow fell ₹${Math.abs(ev/10000000).toFixed(1)}Cr last month — monitor collection momentum` });

    const escrowRatio = (project.escrowBalance||0) / Math.max(project.escrowRequired||1,1);
    if      (escrowRatio < 0.50) alerts.push({ level: 'RED',   category: 'Escrow Deficit', message: `Critical escrow deficit. ₹${((project.escrowBalance||0)/10000000).toFixed(1)}Cr vs ₹${((project.escrowRequired||0)/10000000).toFixed(1)}Cr required` });
    else if (escrowRatio < 0.85) alerts.push({ level: 'AMBER', category: 'Escrow Watch',   message: `Escrow coverage ${(escrowRatio*100).toFixed(0)}% — building deficit risk` });

    const laec = liquidationAdjustedEquityCushion(project, loan);
    if (laec !== null && laec < 0.05) alerts.push({ level: 'RED',   category: 'Equity Cushion — Distress Thin', message: `LAEC ${(laec*100).toFixed(1)}% at 65p/₹ haircut — effectively no buffer in forced sale` });
    else if (laec !== null && laec < 0.10) alerts.push({ level: 'AMBER', category: 'Equity Cushion — Thin',         message: `LAEC ${(laec*100).toFixed(1)}% — slim recovery buffer under distress conditions` });

    if ((project.costOverrun||0) > 20) alerts.push({ level: 'RED', category: 'Cost Overrun', message: `Overrun ${project.costOverrun.toFixed(1)}% exceeds 20% threshold. LTC at ${project.ltc}%` });

    const salesDrop = ((project.salesTarget-project.salesVelocity)/project.salesTarget)*100;
    if      (salesDrop > 40) alerts.push({ level: 'RED',   category: 'Sales Velocity Drop', message: `Sales velocity down ${salesDrop.toFixed(0)}% vs target (${project.salesVelocity} vs ${project.salesTarget} units/mo)` });
    else if (salesDrop > 25) alerts.push({ level: 'AMBER', category: 'Sales Slowdown',       message: `Sales velocity down ${salesDrop.toFixed(0)}% vs target — monitor closely` });

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

  function formatRatio(value, format) {
    if (value == null || !isFinite(value)) return '—';
    switch (format) {
      case 'pct':    return (value * 100).toFixed(1) + '%';
      case 'x':      return value.toFixed(2) + '×';
      case 'months': return value.toFixed(1) + ' mo';
      case 'crore':  return '₹' + (value / 10000000).toFixed(2) + 'Cr';
      default:       return value.toFixed(2);
    }
  }

  function eclStageLabel(stage) {
    if (stage === 1) return 'Stage 1 — Performing';
    if (stage === 2) return 'Stage 2 — Significant Credit Risk';
    return 'Stage 3 — Credit-Impaired';
  }

  return {
    computeScore,
    detectAlerts,
    computeDerivedRatios,
    formulas: {
      collectionEfficiencyRatio,
      monthsToSellOut,
      unsoldInventoryCover,
      costToCompleteRatio,
      escrowVelocity,
      liquidationAdjustedEquityCushion,
      interestCoverageRatio,
      expectedCreditLoss
    },
    getScoreColor,
    getAlertColor,
    getAlertBg,
    formatRatio,
    eclStageLabel,
    WEIGHTS
  };

})();
