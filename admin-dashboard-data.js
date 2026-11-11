function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function summarizeAdminWorkspace(projects = [], leads = []) {
  const projectList = Array.isArray(projects) ? projects : [...(projects.values?.() || [])];
  const leadList = Array.isArray(leads) ? leads : [];

  const totalRevenue = projectList.reduce((sum, project) => sum + toNumber(project.contractAmount), 0);
  const totalCollected = projectList.reduce((sum, project) => sum + toNumber(project.amountPaid), 0);
  const activeProjects = projectList.filter((project) => String(project.workStatus || '').trim().toLowerCase() === 'in progress').length;
  const completedProjects = projectList.filter((project) => String(project.workStatus || '').trim().toLowerCase() === 'completed').length;
  const planningProjects = projectList.filter((project) => String(project.workStatus || '').trim().toLowerCase() === 'planning').length;
  const onHoldProjects = projectList.filter((project) => String(project.workStatus || '').trim().toLowerCase() === 'on hold').length;
  const customerIds = new Set(
    projectList
      .map((project) => String(project.customerId || '').trim())
      .filter(Boolean),
  );
  const averageProgress = projectList.length
    ? Number((projectList.reduce((sum, project) => sum + toNumber(project.progressPercent), 0) / projectList.length).toFixed(2))
    : 0;
  const wonLeads = leadList.filter((lead) => String(lead.leadStatus || '').trim().toLowerCase() === 'won').length;
  const pipelineLeads = leadList.filter((lead) => {
    const status = String(lead.leadStatus || '').trim().toLowerCase();
    return status !== 'won' && status !== 'closed';
  }).length;

  return {
    totalProjects: projectList.length,
    activeProjects,
    completedProjects,
    planningProjects,
    onHoldProjects,
    customerCount: customerIds.size,
    totalRevenue,
    totalCollected,
    outstanding: Math.max(totalRevenue - totalCollected, 0),
    averageProgress,
    wonLeads,
    pipelineLeads,
    leadCount: leadList.length,
  };
}

export function getCustomerRows(projects = []) {
  const projectList = Array.isArray(projects) ? projects : [...(projects.values?.() || [])];
  const grouped = new Map();

  for (const project of projectList) {
    const customerId = String(project.customerId || '').trim() || 'Unassigned';
    const entry = grouped.get(customerId) || {
      customerId,
      projectCount: 0,
      totalRevenue: 0,
      totalCollected: 0,
      latestProgress: 0,
    };

    entry.projectCount += 1;
    entry.totalRevenue += toNumber(project.contractAmount);
    entry.totalCollected += toNumber(project.amountPaid);
    entry.latestProgress = Math.max(entry.latestProgress, toNumber(project.progressPercent));
    grouped.set(customerId, entry);
  }

  return [...grouped.values()].map((entry) => ({
    ...entry,
    outstanding: Math.max(entry.totalRevenue - entry.totalCollected, 0),
  })).sort((left, right) => right.totalRevenue - left.totalRevenue);
}

export function getStatusBreakdown(projects = []) {
  const projectList = Array.isArray(projects) ? projects : [...(projects.values?.() || [])];
  const statuses = ['Planning', 'In Progress', 'On Hold', 'Completed'];

  return statuses.map((status) => ({
    label: status,
    count: projectList.filter((project) => String(project.workStatus || '').trim() === status).length,
  }));
}
