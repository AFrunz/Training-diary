const moduleNameMapper = {
  // пакет отдаёт ESM с расширением .mjs, которое пресет не трансформирует:
  // в тестах берём его же сборку CommonJS
  '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  '^@domain/(.*)$': '<rootDir>/src/domain/$1',
  '^@app/(.*)$': '<rootDir>/src/app/$1',
  '^@ui/(.*)$': '<rootDir>/src/ui/$1',
}

/**
 * Два проекта: логика гоняется в Node через ts-jest и не тянет React Native,
 * интерфейс — через jest-expo. Благодаря этому 328 тестов логики идут за секунды
 * и не зависят от версии React (ARCHITECTURE.md §6).
 */
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'логика',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/domain', '<rootDir>/src/app', '<rootDir>/src/infra'],
      moduleNameMapper,
      clearMocks: true,
    },
    {
      displayName: 'интерфейс',
      preset: 'jest-expo',
      roots: ['<rootDir>/src/ui'],
      moduleNameMapper,
      clearMocks: true,
      // lucide-react-native и шрифты поставляются в ESM: пресет их не трансформирует
      transformIgnorePatterns: [
        'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native))',
      ],
    },
  ],
}
