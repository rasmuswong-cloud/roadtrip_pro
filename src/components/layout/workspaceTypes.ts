export type AppView = 'overview' | 'explore' | 'route' | 'budget' | 'days' | 'tools';

export type AppTab = {
  key: AppView;
  label: string;
};
