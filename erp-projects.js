const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function makeProjectCode(documentId, date = new Date()) {
  const year = date.getFullYear();
  return `DC-${year}-${String(documentId).toUpperCase()}`;
}

export function readProjectMaster(formData) {
  const text = (key) => String(formData.get(key) || '').trim();
  return {
    projectType: text('projectType') || 'Residential',
    projectCategory: text('projectCategory'),
    projectManager: text('projectManager'),
    siteEngineer: text('siteEngineer'),
    contractor: text('contractor'),
    plotArea: numberOrNull(text('plotArea')),
    builtUpArea: numberOrNull(text('builtUpArea')),
    floors: numberOrNull(text('floors')),
    priority: text('priority') || 'Normal',
    startDate: text('startDate') || null,
    expectedCompletionDate: text('expectedCompletionDate') || null,
    actualCompletionDate: text('actualCompletionDate') || null,
    budget: numberOrNull(text('budget')),
    gpsLocation: text('gpsLocation'),
  };
}

export function filterProjects(projects, { status = '', clientId = '', search = '', startFrom = '', completeBy = '' } = {}) {
  const term = String(search).trim().toLocaleLowerCase();
  return projects.filter((project) =>
    (!status || project.workStatus === status)
    && (!clientId || project.customerId === clientId)
    && (!startFrom || (project.startDate && project.startDate >= startFrom))
    && (!completeBy || (project.expectedCompletionDate && project.expectedCompletionDate <= completeBy))
    && (!term || `${project.projectName || ''} ${project.projectCode || ''} ${project.id || ''}`.toLocaleLowerCase().includes(term)),
  );
}
