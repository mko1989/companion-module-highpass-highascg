import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default (async () => {
  const baseConfig = await generateEslintConfig({})
  return [
    ...baseConfig.slice(0, -1),
    {
      files: ['**/*.js', '**/*.mjs'],
      languageOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
      },
    },
    baseConfig[baseConfig.length - 1],
  ]
})()
