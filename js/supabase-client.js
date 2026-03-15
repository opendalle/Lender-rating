// NEXUS ASIA — Supabase Client + Auth Module
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values

const SUPABASE_URL  = window.__NEXUS_SUPABASE_URL  || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON = window.__NEXUS_SUPABASE_ANON || 'YOUR_ANON_KEY';

// ── Client ──────────────────────────────────────────────────────────────────
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

// ── Auth helpers ─────────────────────────────────────────────────────────────
const NexusAuth = {
  async signIn(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signOut() {
    await _sb.auth.signOut();
    window.location.href = 'login.html';
  },
  async getUser() {
    const { data: { user } } = await _sb.auth.getUser();
    return user;
  },
  async getSession() {
    const { data: { session } } = await _sb.auth.getSession();
    return session;
  },
  async requireAuth() {
    const session = await this.getSession();
    if (!session) { window.location.href = 'login.html'; return null; }
    return session;
  },
  async getUserRole(userId) {
    // Stored in user_metadata set at account creation
    const user = await this.getUser();
    return user?.user_metadata?.role || 'VIEWER';
  }
};

// ── Data API ─────────────────────────────────────────────────────────────────
const NexusDB = {
  // Projects
  async getProjects() {
    const { data, error } = await _sb.from('projects').select('*').order('risk_score', { ascending: true });
    if (error) { console.error('getProjects:', error); return []; }
    return data;
  },
  async getProject(id) {
    const { data, error } = await _sb.from('projects').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },
  async updateProject(id, fields) {
    const { error } = await _sb.from('projects').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await this.logAudit('projects', id, 'UPDATE', fields);
  },

  // Developers
  async getDevelopers() {
    const { data, error } = await _sb.from('developers').select('*').order('risk_score', { ascending: true });
    if (error) { console.error('getDevelopers:', error); return []; }
    return data;
  },

  // Loans
  async getLoans() {
    const { data, error } = await _sb.from('loans').select('*');
    if (error) { console.error('getLoans:', error); return []; }
    return data;
  },
  async getLoan(id) {
    const { data, error } = await _sb.from('loans').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  // Covenants
  async getCovenants(loanId) {
    const query = _sb.from('covenants').select('*');
    if (loanId) query.eq('loan_id', loanId);
    const { data, error } = await query.order('is_breached', { ascending: false });
    if (error) return [];
    return data;
  },
  async getAllBreachedCovenants() {
    const { data, error } = await _sb.from('covenants')
      .select('*, loans(project_id, lender), projects:loans(project_id(name, alert_level))')
      .eq('is_breached', true).eq('waiver_granted', false);
    if (error) return [];
    return data;
  },
  async updateCovenant(id, fields) {
    const { error } = await _sb.from('covenants').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  // Alerts
  async getAlerts(projectId) {
    const query = _sb.from('alerts').select('*').order('created_at', { ascending: false });
    if (projectId) query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) return [];
    return data;
  },
  async acknowledgeAlert(id, userId) {
    const { error } = await _sb.from('alerts').update({
      acknowledged: true, acknowledged_by: userId, acknowledged_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw error;
  },
  async insertAlert(projectId, type, category, message, triggerValue, thresholdValue) {
    const { error } = await _sb.from('alerts').insert({
      project_id: projectId, type, category, message,
      trigger_value: triggerValue, threshold_value: thresholdValue
    });
    if (error) console.error('insertAlert:', error);
  },

  // Risk Scores
  async getRiskScoreHistory(projectId, limit = 12) {
    const { data, error } = await _sb.from('risk_scores')
      .select('*').eq('project_id', projectId)
      .order('score_date', { ascending: false }).limit(limit);
    if (error) return [];
    return data.reverse();
  },
  async saveRiskScore(projectId, scoreResult) {
    const { error } = await _sb.from('risk_scores').insert({
      project_id: projectId, score_date: new Date().toISOString().split('T')[0],
      total_score: scoreResult.totalScore, alert_level: scoreResult.alertLevel,
      financial_health: scoreResult.components.financialHealth,
      construction_score: scoreResult.components.constructionProgress,
      sales_score: scoreResult.components.salesVelocity,
      cash_flow_score: scoreResult.components.cashFlowAdequacy,
      sponsor_score: scoreResult.components.sponsorRisk,
      market_score: scoreResult.components.marketConditions,
      capital_stack_score: scoreResult.components.capitalStackStability,
      regulatory_score: scoreResult.components.regulatoryRisk
    });
    if (error) console.error('saveRiskScore:', error);
  },

  // Construction updates
  async getConstructionUpdates(projectId, limit = 12) {
    const { data, error } = await _sb.from('construction_updates')
      .select('*').eq('project_id', projectId)
      .order('update_date', { ascending: false }).limit(limit);
    if (error) return [];
    return data.reverse();
  },
  async insertConstructionUpdate(update) {
    const { error } = await _sb.from('construction_updates').insert(update);
    if (error) throw error;
  },

  // Sales updates
  async getSalesUpdates(projectId, limit = 12) {
    const { data, error } = await _sb.from('sales_updates')
      .select('*').eq('project_id', projectId)
      .order('update_month', { ascending: false }).limit(limit);
    if (error) return [];
    return data.reverse();
  },
  async insertSalesUpdate(update) {
    const { error } = await _sb.from('sales_updates').insert(update);
    if (error) throw error;
  },

  // Financials
  async getFinancials(projectId, limit = 12) {
    const { data, error } = await _sb.from('financials')
      .select('*').eq('project_id', projectId)
      .order('period', { ascending: false }).limit(limit);
    if (error) return [];
    return data.reverse();
  },

  // Documents
  async getDocuments(projectId) {
    const { data, error } = await _sb.from('project_documents')
      .select('*').eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });
    if (error) return [];
    return data;
  },
  async uploadDocument(projectId, file, category, uploadedBy) {
    const path = `${projectId}/${Date.now()}_${file.name}`;
    const { error: storageErr } = await _sb.storage.from('project-docs').upload(path, file);
    if (storageErr) throw storageErr;
    const { data: { publicUrl } } = _sb.storage.from('project-docs').getPublicUrl(path);
    const { error: dbErr } = await _sb.from('project_documents').insert({
      project_id: projectId, name: file.name, category,
      file_url: publicUrl, file_size: file.size, uploaded_by: uploadedBy,
      file_type: file.name.split('.').pop().toUpperCase()
    });
    if (dbErr) throw dbErr;
    return publicUrl;
  },

  // Audit trail
  async getAuditLog(projectId, limit = 50) {
    const { data, error } = await _sb.from('audit_log')
      .select('*').eq('entity_id', projectId)
      .order('created_at', { ascending: false }).limit(limit);
    if (error) return [];
    return data;
  },
  async logAudit(table, entityId, action, changes) {
    const user = await NexusAuth.getUser();
    await _sb.from('audit_log').insert({
      table_name: table, entity_id: entityId, action,
      changes: JSON.stringify(changes), performed_by: user?.email || 'system'
    });
  },

  // Market data
  async getMarketData() {
    const { data, error } = await _sb.from('market_data').select('*').order('city');
    if (error) return [];
    return data;
  },

  // Portfolio snapshot
  async getPortfolioExposure(limit = 12) {
    const { data, error } = await _sb.from('portfolio_exposure')
      .select('*').order('snapshot_date', { ascending: false }).limit(limit);
    if (error) return [];
    return data.reverse();
  },

  // Repayment schedule
  async getRepaymentSchedule(loanId) {
    const { data, error } = await _sb.from('repayment_schedule')
      .select('*').eq('loan_id', loanId).order('due_date');
    if (error) return [];
    return data;
  },

  // Realtime subscription helpers
  subscribeToAlerts(callback) {
    return _sb.channel('alerts-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, callback)
      .subscribe();
  },
  subscribeToProjects(callback) {
    return _sb.channel('projects-feed')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects' }, callback)
      .subscribe();
  },

  // Seed (run once)
  async seedAll(data) {
    const tables = ['developers', 'projects', 'loans', 'alerts', 'market_data'];
    for (const t of tables) {
      if (data[t] && data[t].length) {
        const { error } = await _sb.from(t).upsert(data[t], { onConflict: 'id' });
        if (error) console.error(`Seed ${t}:`, error);
        else console.log(`✓ Seeded ${t}: ${data[t].length} rows`);
      }
    }
  }
};

// ── Offline fallback ─────────────────────────────────────────────────────────
// If Supabase keys are not configured, returns seed data transparently
const NexusData = {
  _live: false,
  _cache: {},

  async load() {
    try {
      const session = await NexusAuth.getSession();
      if (!session || SUPABASE_URL.includes('YOUR_PROJECT')) {
        console.warn('NEXUS: Using offline seed data (Supabase not configured)');
        this._live = false;
        this._cache = {
          projects: NEXUS_DATA.projects,
          developers: NEXUS_DATA.developers,
          loans: NEXUS_DATA.loans,
          alerts: NEXUS_DATA.alerts,
          marketData: NEXUS_DATA.marketData
        };
        return this._cache;
      }
      this._live = true;
      const [projects, developers, loans, alerts, marketData] = await Promise.all([
        NexusDB.getProjects(), NexusDB.getDevelopers(), NexusDB.getLoans(),
        NexusDB.getAlerts(), NexusDB.getMarketData()
      ]);
      this._cache = { projects, developers, loans, alerts, marketData };
      return this._cache;
    } catch(e) {
      console.error('NexusData.load:', e);
      this._cache = { projects: NEXUS_DATA.projects, developers: NEXUS_DATA.developers, loans: NEXUS_DATA.loans, alerts: NEXUS_DATA.alerts, marketData: NEXUS_DATA.marketData };
      return this._cache;
    }
  },

  get projects()   { return this._cache.projects   || NEXUS_DATA.projects; },
  get developers() { return this._cache.developers || NEXUS_DATA.developers; },
  get loans()      { return this._cache.loans       || NEXUS_DATA.loans; },
  get alerts()     { return this._cache.alerts      || NEXUS_DATA.alerts; },
  get marketData() { return this._cache.marketData  || NEXUS_DATA.marketData; },

  getDev(id)  { return this.developers.find(d => d.id === id); },
  getLoan(id) { return this.loans.find(l => l.id === id); },
  getProject(id) { return this.projects.find(p => p.id === id); }
};
