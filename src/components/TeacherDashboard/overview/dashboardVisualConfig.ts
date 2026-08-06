export type DashboardTone = 'blue' | 'green' | 'violet' | 'orange' | 'rose' | 'cyan';

export const dashboardToneClasses: Record<DashboardTone, {
  surface: string;
  icon: string;
  text: string;
  border: string;
}> = {
  blue: {
    surface: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-700',
    text: 'text-blue-700',
    border: 'border-blue-100',
  },
  green: {
    surface: 'bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-700',
    border: 'border-emerald-100',
  },
  violet: {
    surface: 'bg-violet-50',
    icon: 'bg-violet-100 text-violet-700',
    text: 'text-violet-700',
    border: 'border-violet-100',
  },
  orange: {
    surface: 'bg-orange-50',
    icon: 'bg-orange-100 text-orange-700',
    text: 'text-orange-700',
    border: 'border-orange-100',
  },
  rose: {
    surface: 'bg-rose-50',
    icon: 'bg-rose-100 text-rose-700',
    text: 'text-rose-700',
    border: 'border-rose-100',
  },
  cyan: {
    surface: 'bg-cyan-50',
    icon: 'bg-cyan-100 text-cyan-700',
    text: 'text-cyan-700',
    border: 'border-cyan-100',
  },
};
