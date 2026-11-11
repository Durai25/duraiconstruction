export function isAdminRecord(record = {}) {
  if (!record || typeof record !== 'object') {
    return false;
  }

  if (record.admin === true) {
    return true;
  }

  const roleValue = [record.role, record.access, record.level]
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .find((value) => value.length > 0);

  if (!roleValue) {
    return false;
  }

  const normalizedRole = roleValue.toLowerCase();
  return normalizedRole.includes('admin') || normalizedRole === 'administrator';
}
