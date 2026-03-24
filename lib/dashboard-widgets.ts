export type WidgetConfig = {
  widgetId: string;
  enabled: boolean;
  position: number;
  config?: Record<string, unknown>;
};

export type WidgetDefinition = {
  widgetId: string;
  name: string;
  description: string;
};

export const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  {
    widgetId: "active_members",
    name: "Active member count",
    description: "Count with trend arrow vs last month",
  },
  {
    widgetId: "growth_chart",
    name: "Member growth",
    description: "Line chart of active members over time",
  },
  {
    widgetId: "revenue_summary",
    name: "Revenue summary",
    description: "Bar chart of monthly revenue",
  },
  {
    widgetId: "revenue_forecast",
    name: "Revenue forecast",
    description: "Projected revenue based on active plans",
  },
  {
    widgetId: "churn_rate",
    name: "Churn rate",
    description: "Cancellation percentage",
  },
  {
    widgetId: "overdue_accounts",
    name: "Overdue accounts",
    description: "Table of PAST_DUE and SUSPENDED members",
  },
  {
    widgetId: "expiring_plans",
    name: "Expiring plans",
    description: "Members whose plans end within N days",
  },
  {
    widgetId: "recent_activity",
    name: "Recent activity",
    description: "Feed of latest signups, payments, changes",
  },
  {
    widgetId: "key_status",
    name: "Key status summary",
    description: "Active/inactive/lost key counts",
  },
  {
    widgetId: "waiver_compliance",
    name: "Waiver compliance",
    description: "Members missing required waivers",
  },
  {
    widgetId: "equipment_status",
    name: "Equipment status",
    description: "Machines needing maintenance or out of order",
  },
  {
    widgetId: "certification_summary",
    name: "Certifications",
    description: "Recent certifications granted",
  },
];

export const FALLBACK_DEFAULT_IDS = [
  "active_members",
  "revenue_summary",
  "overdue_accounts",
  "expiring_plans",
  "recent_activity",
  "growth_chart",
];

export function buildDefaultWidgets(defaultIds: string[]): WidgetConfig[] {
  return AVAILABLE_WIDGETS.map((w, index) => ({
    widgetId: w.widgetId,
    enabled: defaultIds.includes(w.widgetId),
    position: defaultIds.includes(w.widgetId)
      ? defaultIds.indexOf(w.widgetId)
      : 100 + index,
  })).sort((a, b) => a.position - b.position);
}
