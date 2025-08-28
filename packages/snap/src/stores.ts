export type TabType = 'kyc' | 'social' | 'all';

export const activeTabStore: { value: TabType } = {
  value: 'all',
};
