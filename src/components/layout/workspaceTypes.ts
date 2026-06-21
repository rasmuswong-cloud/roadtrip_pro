export type AppView = 'overview' | 'route' | 'budget' | 'days' | 'tools';

export type AppTab = {
  key: AppView;
  label: string;
};
