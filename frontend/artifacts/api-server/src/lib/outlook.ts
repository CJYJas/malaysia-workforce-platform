import outlookSnapshot from "../data/outlook-snapshot.json";

export async function getSignalReport(refresh?: boolean) {
  const now = new Date().toISOString();
  const report = JSON.parse(JSON.stringify(outlookSnapshot));

  if (refresh) {
    report.checked_at = now;
  }

  // Ensure each signal has sdgs
  report.signals = report.signals.map((signal: any) => {
    return {
      ...signal,
      sdgs: signal.sdgs || [8, 9],
    };
  });

  return report;
}
