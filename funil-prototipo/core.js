(() => {
  'use strict';

  const VERSION = '0.1.0';
  const STORAGE_KEY = 'helpFunilPrototypeV1';

  const STAGES = Object.freeze([
    'lead',
    'contato',
    'qualificado',
    'proposta',
    'negociacao',
    'ganho',
    'perdido'
  ]);

  const ACTIVE_STAGES = Object.freeze(STAGES.filter(s => !['ganho','perdido'].includes(s)));

  const STAGE_LABELS = Object.freeze({
    lead: 'Lead',
    contato: 'Contato',
    qualificado: 'Qualificado',
    proposta: 'Proposta',
    negociacao: 'Negociação',
    ganho: 'Ganho',
    perdido: 'Perdido'
  });

  const INTERACTION_TYPES = Object.freeze([
    'whatsapp',
    'ligacao',
    'email',
    'reuniao',
    'visita',
    'anotacao'
  ]);

  const ROLES = Object.freeze(['vendedor','gestor','admin']);

  function uid(prefix='id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function normalizeText(v) {
    return String(v || '').trim();
  }

  function normalizePhone(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function normalizeEmail(v) {
    return String(v || '').trim().toLowerCase();
  }

  function assert(cond, message, code='VALIDATION_ERROR') {
    if (!cond) {
      const e = new Error(message);
      e.code = code;
      throw e;
    }
  }

  class MemoryStore {
    constructor(seed) {
      this.state = seed ? clone(seed) : createEmptyState();
    }
    load() { return clone(this.state); }
    save(next) { this.state = clone(next); return this.load(); }
    clear() { this.state = createEmptyState(); }
  }

  class LocalStorageStore {
    constructor(key=STORAGE_KEY) { this.key = key; }
    load() {
      try {
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : createEmptyState();
      } catch {
        return createEmptyState();
      }
    }
    save(next) {
      localStorage.setItem(this.key, JSON.stringify(next));
      return clone(next);
    }
    clear() { localStorage.removeItem(this.key); }
  }

  function createEmptyState() {
    return {
      version: VERSION,
      users: [],
      opportunities: [],
      interactions: [],
      activities: [],
      goals: [],
      leadSources: ['Indicação','Instagram','Site','WhatsApp','Prospecção ativa','Outro'],
      lossReasons: ['Preço','Sem retorno','Sem necessidade agora','Concorrente','Sem orçamento','Prazo','Outro'],
      settings: {
        requireNextActionOnActive: true,
        requireLossReason: true
      }
    };
  }

  class FunilEngine {
    constructor(store = new MemoryStore()) {
      this.store = store;
      this.state = store.load();
      this._ensureShape();
    }

    _ensureShape() {
      const base = createEmptyState();
      this.state = {...base, ...this.state};
      ['users','opportunities','interactions','activities','goals','leadSources','lossReasons'].forEach(k => {
        if (!Array.isArray(this.state[k])) this.state[k] = clone(base[k]);
      });
      this.state.settings = {...base.settings, ...(this.state.settings || {})};
      this._persist();
    }

    _persist() {
      this.state.version = VERSION;
      this.store.save(this.state);
    }

    reset() {
      this.store.clear();
      this.state = createEmptyState();
      this._persist();
      return this.snapshot();
    }

    snapshot() { return clone(this.state); }

    addUser(input) {
      const name = normalizeText(input?.name);
      const role = normalizeText(input?.role);
      assert(name, 'Nome do usuário é obrigatório.');
      assert(ROLES.includes(role), 'Perfil inválido.');
      const user = {
        id: input?.id || uid('usr'),
        name,
        role,
        active: input?.active !== false,
        createdAt: nowIso()
      };
      assert(!this.state.users.some(u => u.id === user.id), 'ID de usuário já existe.');
      this.state.users.push(user);
      this._persist();
      return clone(user);
    }

    getUser(id) {
      return clone(this.state.users.find(u => u.id === id) || null);
    }

    _requireUser(id) {
      const user = this.state.users.find(u => u.id === id && u.active);
      assert(user, 'Usuário ativo não encontrado.', 'AUTH_ERROR');
      return user;
    }

    _canView(user, opp) {
      return user.role === 'admin' || user.role === 'gestor' || opp.ownerId === user.id;
    }

    _canEdit(user, opp) {
      return user.role === 'admin' || user.role === 'gestor' || opp.ownerId === user.id;
    }

    _audit({opportunityId=null,userId,action,from=null,to=null,meta={}}) {
      const event = {
        id: uid('act'),
        opportunityId,
        userId,
        action,
        from,
        to,
        meta: clone(meta),
        createdAt: nowIso()
      };
      this.state.activities.push(event);
      return event;
    }

    createOpportunity(input, actorId) {
      const actor = this._requireUser(actorId);
      const ownerId = input?.ownerId || actor.id;
      const owner = this._requireUser(ownerId);
      assert(['vendedor','gestor','admin'].includes(owner.role), 'Responsável inválido.');

      if (actor.role === 'vendedor') {
        assert(ownerId === actor.id, 'Vendedor só pode criar oportunidade para si próprio.', 'PERMISSION_DENIED');
      }

      const stage = input?.stage || 'lead';
      assert(STAGES.includes(stage), 'Etapa inválida.');

      const opp = {
        id: input?.id || uid('opp'),
        company: normalizeText(input?.company),
        contactName: normalizeText(input?.contactName),
        phone: normalizePhone(input?.phone),
        email: normalizeEmail(input?.email),
        value: Number(input?.value || 0),
        source: normalizeText(input?.source || 'Outro'),
        ownerId,
        stage,
        nextAction: input?.nextAction ? normalizeNextAction(input.nextAction) : null,
        notes: normalizeText(input?.notes),
        lossReason: null,
        lostAt: null,
        wonAt: null,
        createdBy: actor.id,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };

      assert(opp.company || opp.contactName, 'Informe empresa ou nome do contato.');
      assert(Number.isFinite(opp.value) && opp.value >= 0, 'Valor inválido.');

      if (ACTIVE_STAGES.includes(stage) && this.state.settings.requireNextActionOnActive) {
        assert(opp.nextAction?.date, 'Oportunidade ativa precisa de próxima ação.');
      }

      if (stage === 'perdido') {
        assert(false, 'Crie como ativa e use marcar como perdido para registrar o motivo.');
      }

      if (stage === 'ganho') opp.wonAt = nowIso();

      this.state.opportunities.push(opp);
      this._audit({opportunityId: opp.id, userId: actor.id, action: 'opportunity.created', to: stage});
      this._persist();
      return clone(opp);
    }

    listOpportunities(actorId, filters={}) {
      const actor = this._requireUser(actorId);
      return this.state.opportunities
        .filter(o => this._canView(actor, o))
        .filter(o => !filters.stage || o.stage === filters.stage)
        .filter(o => !filters.ownerId || o.ownerId === filters.ownerId)
        .filter(o => {
          if (!filters.q) return true;
          const q = normalizeText(filters.q).toLowerCase();
          return [o.company,o.contactName,o.phone,o.email,o.source].join(' ').toLowerCase().includes(q);
        })
        .map(clone);
    }

    getOpportunity(id, actorId) {
      const actor = this._requireUser(actorId);
      const opp = this.state.opportunities.find(o => o.id === id);
      assert(opp, 'Oportunidade não encontrada.');
      assert(this._canView(actor, opp), 'Sem permissão para visualizar esta oportunidade.', 'PERMISSION_DENIED');
      return clone(opp);
    }

    updateOpportunity(id, patch, actorId) {
      const actor = this._requireUser(actorId);
      const opp = this.state.opportunities.find(o => o.id === id);
      assert(opp, 'Oportunidade não encontrada.');
      assert(this._canEdit(actor, opp), 'Sem permissão para editar esta oportunidade.', 'PERMISSION_DENIED');

      if (patch.ownerId && patch.ownerId !== opp.ownerId) {
        assert(actor.role !== 'vendedor', 'Vendedor não pode redistribuir oportunidade.', 'PERMISSION_DENIED');
        this._requireUser(patch.ownerId);
        const old = opp.ownerId;
        opp.ownerId = patch.ownerId;
        this._audit({opportunityId:id,userId:actor.id,action:'opportunity.owner_changed',from:old,to:patch.ownerId});
      }

      if (patch.company !== undefined) opp.company = normalizeText(patch.company);
      if (patch.contactName !== undefined) opp.contactName = normalizeText(patch.contactName);
      if (patch.phone !== undefined) opp.phone = normalizePhone(patch.phone);
      if (patch.email !== undefined) opp.email = normalizeEmail(patch.email);
      if (patch.value !== undefined) {
        const v = Number(patch.value);
        assert(Number.isFinite(v) && v >= 0, 'Valor inválido.');
        opp.value = v;
      }
      if (patch.source !== undefined) opp.source = normalizeText(patch.source);
      if (patch.notes !== undefined) opp.notes = normalizeText(patch.notes);
      if (patch.nextAction !== undefined) opp.nextAction = patch.nextAction ? normalizeNextAction(patch.nextAction) : null;

      assert(opp.company || opp.contactName, 'Informe empresa ou nome do contato.');
      if (ACTIVE_STAGES.includes(opp.stage) && this.state.settings.requireNextActionOnActive) {
        assert(opp.nextAction?.date, 'Oportunidade ativa precisa de próxima ação.');
      }

      opp.updatedAt = nowIso();
      this._audit({opportunityId:id,userId:actor.id,action:'opportunity.updated'});
      this._persist();
      return clone(opp);
    }

    setNextAction(id, nextAction, actorId) {
      const actor = this._requireUser(actorId);
      const opp = this.state.opportunities.find(o => o.id === id);
      assert(opp, 'Oportunidade não encontrada.');
      assert(this._canEdit(actor, opp), 'Sem permissão.', 'PERMISSION_DENIED');
      assert(ACTIVE_STAGES.includes(opp.stage), 'Oportunidade encerrada não recebe próxima ação.');
      const normalized = normalizeNextAction(nextAction);
      assert(normalized.date, 'Data da próxima ação é obrigatória.');
      opp.nextAction = normalized;
      opp.updatedAt = nowIso();
      this._audit({opportunityId:id,userId:actor.id,action:'opportunity.next_action_set',meta:normalized});
      this._persist();
      return clone(opp);
    }

    moveStage(id, nextStage, actorId, options={}) {
      const actor = this._requireUser(actorId);
      const opp = this.state.opportunities.find(o => o.id === id);
      assert(opp, 'Oportunidade não encontrada.');
      assert(this._canEdit(actor, opp), 'Sem permissão.', 'PERMISSION_DENIED');
      assert(STAGES.includes(nextStage), 'Etapa inválida.');
      assert(!['ganho','perdido'].includes(opp.stage), 'Oportunidade já encerrada.');

      if (nextStage === 'perdido') {
        return this.markLost(id, options.lossReason, actorId, options.notes);
      }

      const old = opp.stage;
      opp.stage = nextStage;
      opp.lossReason = null;
      opp.lostAt = null;

      if (nextStage === 'ganho') {
        opp.wonAt = nowIso();
        opp.nextAction = null;
      } else {
        opp.wonAt = null;
        if (this.state.settings.requireNextActionOnActive) {
          const next = options.nextAction ? normalizeNextAction(options.nextAction) : opp.nextAction;
          assert(next?.date, 'Defina a próxima ação antes de manter a oportunidade ativa.');
          opp.nextAction = next;
        }
      }

      opp.updatedAt = nowIso();
      this._audit({opportunityId:id,userId:actor.id,action:'opportunity.stage_changed',from:old,to:nextStage});
      this._persist();
      return clone(opp);
    }

    markLost(id, reason, actorId, notes='') {
      const actor = this._requireUser(actorId);
      const opp = this.state.opportunities.find(o => o.id === id);
      assert(opp, 'Oportunidade não encontrada.');
      assert(this._canEdit(actor, opp), 'Sem permissão.', 'PERMISSION_DENIED');
      assert(!['ganho','perdido'].includes(opp.stage), 'Oportunidade já encerrada.');
      const lossReason = normalizeText(reason);
      if (this.state.settings.requireLossReason) assert(lossReason, 'Motivo de perda é obrigatório.');

      const old = opp.stage;
      opp.stage = 'perdido';
      opp.lossReason = lossReason;
      opp.lostAt = nowIso();
      opp.wonAt = null;
      opp.nextAction = null;
      opp.updatedAt = nowIso();
      this._audit({
        opportunityId:id,userId:actor.id,action:'opportunity.lost',from:old,to:'perdido',
        meta:{reason:lossReason,notes:normalizeText(notes)}
      });
      this._persist();
      return clone(opp);
    }

    reopenOpportunity(id, actorId, stage='contato', nextAction=null) {
      const actor = this._requireUser(actorId);
      assert(actor.role === 'gestor' || actor.role === 'admin', 'Somente gestor ou ADM pode reabrir.', 'PERMISSION_DENIED');
      const opp = this.state.opportunities.find(o => o.id === id);
      assert(opp, 'Oportunidade não encontrada.');
      assert(['ganho','perdido'].includes(opp.stage), 'Só oportunidades encerradas podem ser reabertas.');
      assert(ACTIVE_STAGES.includes(stage), 'Etapa de reabertura inválida.');
      const normalized = normalizeNextAction(nextAction);
      assert(normalized.date, 'Próxima ação é obrigatória ao reabrir.');

      const old = opp.stage;
      opp.stage = stage;
      opp.nextAction = normalized;
      opp.lossReason = null;
      opp.lostAt = null;
      opp.wonAt = null;
      opp.updatedAt = nowIso();
      this._audit({opportunityId:id,userId:actor.id,action:'opportunity.reopened',from:old,to:stage});
      this._persist();
      return clone(opp);
    }

    addInteraction(opportunityId, input, actorId) {
      const actor = this._requireUser(actorId);
      const opp = this.state.opportunities.find(o => o.id === opportunityId);
      assert(opp, 'Oportunidade não encontrada.');
      assert(this._canEdit(actor, opp), 'Sem permissão.', 'PERMISSION_DENIED');

      const type = normalizeText(input?.type);
      assert(INTERACTION_TYPES.includes(type), 'Tipo de interação inválido.');
      const description = normalizeText(input?.description);
      assert(description, 'Descrição da interação é obrigatória.');

      const item = {
        id: uid('int'),
        opportunityId,
        userId: actor.id,
        type,
        description,
        createdAt: input?.createdAt || nowIso()
      };
      this.state.interactions.push(item);
      opp.updatedAt = nowIso();

      if (input?.nextAction) {
        const next = normalizeNextAction(input.nextAction);
        assert(next.date, 'Data da próxima ação é obrigatória.');
        opp.nextAction = next;
      }

      this._audit({opportunityId,userId:actor.id,action:'interaction.created',meta:{interactionId:item.id,type}});
      this._persist();
      return clone(item);
    }

    listInteractions(opportunityId, actorId) {
      this.getOpportunity(opportunityId, actorId);
      return this.state.interactions
        .filter(i => i.opportunityId === opportunityId)
        .sort((a,b) => a.createdAt.localeCompare(b.createdAt))
        .map(clone);
    }

    getHistory(opportunityId, actorId) {
      this.getOpportunity(opportunityId, actorId);
      return this.state.activities
        .filter(a => a.opportunityId === opportunityId)
        .sort((a,b) => a.createdAt.localeCompare(b.createdAt))
        .map(clone);
    }

    setGoal(input, actorId) {
      const actor = this._requireUser(actorId);
      assert(actor.role === 'gestor' || actor.role === 'admin', 'Somente gestão pode definir metas.', 'PERMISSION_DENIED');
      const user = this._requireUser(input?.userId);
      const competence = normalizeText(input?.competence);
      const amount = Number(input?.amount || 0);
      assert(/^\d{4}-\d{2}$/.test(competence), 'Competência deve ser YYYY-MM.');
      assert(Number.isFinite(amount) && amount >= 0, 'Meta inválida.');
      let goal = this.state.goals.find(g => g.userId === user.id && g.competence === competence);
      if (!goal) {
        goal = {id:uid('goal'),userId:user.id,competence,amount,createdAt:nowIso(),updatedAt:nowIso()};
        this.state.goals.push(goal);
      } else {
        goal.amount = amount;
        goal.updatedAt = nowIso();
      }
      this._persist();
      return clone(goal);
    }

    metrics(actorId, opts={}) {
      const actor = this._requireUser(actorId);
      const now = opts.now ? new Date(opts.now) : new Date();
      const start = opts.start ? new Date(opts.start) : null;
      const end = opts.end ? new Date(opts.end) : null;
      const visible = this.state.opportunities.filter(o => this._canView(actor,o));
      const interactions = this.state.interactions.filter(i => {
        const opp = visible.find(o => o.id === i.opportunityId);
        if (!opp) return false;
        const d = new Date(i.createdAt);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });

      const todayKey = dateKey(now);
      const monthKey = now.toISOString().slice(0,7);
      const interactionsToday = interactions.filter(i => dateKey(new Date(i.createdAt)) === todayKey).length;
      const createdToday = visible.filter(o => dateKey(new Date(o.createdAt)) === todayKey).length;
      const wonMonth = visible.filter(o => o.stage === 'ganho' && o.wonAt?.slice(0,7) === monthKey);
      const active = visible.filter(o => ACTIVE_STAGES.includes(o.stage));
      const qualified = visible.filter(o => ['qualificado','proposta','negociacao','ganho'].includes(o.stage));
      const proposals = visible.filter(o => ['proposta','negociacao','ganho'].includes(o.stage));
      const negotiations = visible.filter(o => o.stage === 'negociacao');
      const lost = visible.filter(o => o.stage === 'perdido');
      const closed = visible.filter(o => ['ganho','perdido'].includes(o.stage));

      return {
        interactionsToday,
        newLeadsToday: createdToday,
        activeOpportunities: active.length,
        qualified: qualified.length,
        proposals: proposals.length,
        negotiations: negotiations.length,
        wonThisMonth: wonMonth.length,
        revenueWonThisMonth: sum(wonMonth.map(o => o.value)),
        pipelineValue: sum(active.map(o => o.value)),
        conversionRate: closed.length ? round((visible.filter(o=>o.stage==='ganho').length / closed.length) * 100, 1) : 0,
        byStage: Object.fromEntries(STAGES.map(stage => {
          const rows = visible.filter(o => o.stage === stage);
          return [stage, {count:rows.length,value:sum(rows.map(o=>o.value))}];
        })),
        lossReasons: aggregateLossReasons(lost),
        bySeller: this._sellerMetrics(visible, interactions)
      };
    }

    _sellerMetrics(visibleOpps, interactions) {
      return this.state.users
        .filter(u => u.active && ['vendedor','gestor','admin'].includes(u.role))
        .map(u => {
          const opps = visibleOpps.filter(o => o.ownerId === u.id);
          const ints = interactions.filter(i => i.userId === u.id);
          const won = opps.filter(o => o.stage === 'ganho');
          return {
            userId:u.id,
            name:u.name,
            interactions:ints.length,
            opportunities:opps.length,
            won:won.length,
            revenue:sum(won.map(o=>o.value))
          };
        });
    }

    crmSummary(actorId, opts={}) {
      const m = this.metrics(actorId, opts);
      return {
        source: 'funil-vendas',
        generatedAt: nowIso(),
        interactionsToday: m.interactionsToday,
        newLeadsToday: m.newLeadsToday,
        qualified: m.qualified,
        proposals: m.proposals,
        negotiations: m.negotiations,
        salesThisMonth: m.wonThisMonth,
        pipelineValue: m.pipelineValue,
        revenueWonThisMonth: m.revenueWonThisMonth,
        conversionRate: m.conversionRate
      };
    }

    clientHandoff(opportunityId, actorId, crmClients=[]) {
      const actor = this._requireUser(actorId);
      const opp = this.state.opportunities.find(o => o.id === opportunityId);
      assert(opp, 'Oportunidade não encontrada.');
      assert(this._canView(actor, opp), 'Sem permissão.', 'PERMISSION_DENIED');
      assert(opp.stage === 'ganho', 'Somente oportunidade ganha pode ser enviada ao CRM.');

      const phone = normalizePhone(opp.phone);
      const email = normalizeEmail(opp.email);
      const company = normalizeText(opp.company).toLowerCase();

      const match = crmClients.find(c => {
        const samePhone = phone && normalizePhone(c.phone) === phone;
        const sameEmail = email && normalizeEmail(c.email) === email;
        const sameCompany = company && normalizeText(c.company || c.name).toLowerCase() === company;
        return samePhone || sameEmail || sameCompany;
      });

      return {
        opportunityId,
        status: match ? 'match_found' : 'create_suggested',
        existingClient: match ? clone(match) : null,
        suggestedClient: match ? null : {
          company: opp.company,
          contactName: opp.contactName,
          phone: opp.phone,
          email: opp.email,
          origin: 'Funil de Vendas',
          sourceOpportunityId: opp.id
        }
      };
    }

    validateIntegrity() {
      const issues = [];
      const userIds = new Set(this.state.users.map(u=>u.id));
      const oppIds = new Set(this.state.opportunities.map(o=>o.id));
      for (const o of this.state.opportunities) {
        if (!userIds.has(o.ownerId)) issues.push({type:'missing_owner',opportunityId:o.id});
        if (ACTIVE_STAGES.includes(o.stage) && this.state.settings.requireNextActionOnActive && !o.nextAction?.date) {
          issues.push({type:'active_without_next_action',opportunityId:o.id});
        }
        if (o.stage === 'perdido' && this.state.settings.requireLossReason && !o.lossReason) {
          issues.push({type:'lost_without_reason',opportunityId:o.id});
        }
      }
      for (const i of this.state.interactions) {
        if (!oppIds.has(i.opportunityId)) issues.push({type:'orphan_interaction',interactionId:i.id});
        if (!userIds.has(i.userId)) issues.push({type:'interaction_missing_user',interactionId:i.id});
      }
      return issues;
    }
  }

  function normalizeNextAction(input) {
    if (!input) return null;
    return {
      type: normalizeText(input.type || 'follow-up'),
      date: normalizeText(input.date),
      time: normalizeText(input.time),
      notes: normalizeText(input.notes)
    };
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function sum(arr) { return round(arr.reduce((a,b)=>a+Number(b||0),0),2); }
  function round(n,p=2) { const f=10**p; return Math.round((n+Number.EPSILON)*f)/f; }

  function aggregateLossReasons(rows) {
    const map = {};
    rows.forEach(o => { const k=o.lossReason || 'Não informado'; map[k]=(map[k]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count}));
  }

  window.HelpFunil = {
    VERSION,
    STAGES,
    ACTIVE_STAGES,
    STAGE_LABELS,
    INTERACTION_TYPES,
    ROLES,
    MemoryStore,
    LocalStorageStore,
    FunilEngine,
    createEmptyState
  };
})();