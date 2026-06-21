export function formatDateLabel(dateKey?: string | null, fallback = 'Datum saknas'): string {
  if (!dateKey || dateKey === 'unscheduled' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return fallback;
  }

  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export function formatTimeLabel(value?: string | null, fallback = 'Tid saknas'): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}
