import type { DummyRule, OxlintConfig, OxlintOverride } from 'oxlint';

export type RulesWithJsPlugins = NonNullable<OxlintConfig['rules']> &
  Record<string, DummyRule | undefined>;

export type OverrideWithJsPlugins = Omit<OxlintOverride, 'rules'> & {
  rules?: RulesWithJsPlugins;
};

export type LocalOxlintConfig = Omit<OxlintConfig, 'rules' | 'overrides'> & {
  rules?: RulesWithJsPlugins;
  overrides?: OverrideWithJsPlugins[];
};
