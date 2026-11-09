import { eslintCompatPlugin } from '@oxlint/plugins';

import { blankLineAfterBlockRule } from './rules/blank-line-after-block.ts';

const stylePlugin = eslintCompatPlugin({
  meta: { name: 'style' },
  rules: {
    'blank-line-after-block': blankLineAfterBlockRule,
  },
});

export default stylePlugin;
