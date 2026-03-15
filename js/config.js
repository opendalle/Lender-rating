// NEXUS ASIA — Configuration
// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Replace these two values with your Supabase project credentials.
//         Find them at: https://app.supabase.com → Your Project → Settings → API
//
// STEP 2: Save this file and push to GitHub.
//
// DO NOT share this file publicly if you're using real fund data.
// For production: move keys to Supabase Edge Function env vars.
// ─────────────────────────────────────────────────────────────────────────────

window.__NEXUS_SUPABASE_URL  = 'https://rdtvffhfmgzwmqvgvpcb.supabase.co';
window.__NEXUS_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdHZmZmhmbWd6d21xdmd2cGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjQ1ODEsImV4cCI6MjA4OTE0MDU4MX0.vdT4TUhrKtzx1aPzM73GaqqDEmyTdjyXv62IFE4sypA';

// ─────────────────────────────────────────────────────────────────────────────
// FUND CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
window.__NEXUS_CONFIG = {
  fundName:     'NEXUS ASIA Credit Fund',
  fundCurrency: 'INR',
  timezone:     'Asia/Kolkata',

  // Risk thresholds (edit to match your fund's loan agreements)
  thresholds: {
    dscr_min:            1.25,   // Minimum DSCR covenant
    dscr_red:            1.00,   // DSCR below this = RED alert
    ltv_max:             75,     // Maximum LTV %
    ltv_amber:           70,     // LTV above this = AMBER
    ltc_max:             80,     // Maximum LTC %
    cost_overrun_amber:  10,     // Cost overrun % for AMBER
    cost_overrun_red:    20,     // Cost overrun % for RED
    construction_delay_amber: 45, // Days delay for AMBER
    construction_delay_red:   90, // Days delay for RED
    sales_drop_amber:    25,     // Sales velocity drop % for AMBER
    sales_drop_red:      40,     // Sales velocity drop % for RED
    escrow_amber:        85,     // Escrow coverage % for AMBER
    escrow_red:          50      // Escrow coverage % for RED
  },

  // Report footer
  reportDisclaimer: 'This report is generated for institutional lender use only. All data is indicative and subject to field verification. Not for distribution beyond intended recipients.',
  reportPreparedBy: 'NEXUS ASIA Credit Intelligence Terminal'
};
