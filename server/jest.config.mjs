// Config Jest para o backend (ESM + ts-jest).
// O projeto usa "type": "nodeNext" (ESM com imports .js), por isso usamos o
// preset ESM do ts-jest + moduleNameMapper para resolver os imports ".js" -> ".ts".

/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],

  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],

  // Resolve imports ESM com extensão .js para os arquivos .ts reais
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  transform: {
    // ignoreCodes 151002: silencia o aviso de "hybrid module kind" (NodeNext);
    // inofensivo aqui e não altera a semântica dos módulos.
    "^.+\\.ts$": ["ts-jest", { useESM: true, diagnostics: { ignoreCodes: [151002] } }],
  },

  // Carrega .env.test ANTES de qualquer módulo (sobrescreve env do container)
  setupFiles: ["<rootDir>/src/__tests__/setup/load-env.ts"],

  // Garante schema do banco de teste antes de tudo
  globalSetup: "<rootDir>/src/__tests__/setup/global.setup.ts",
  globalTeardown: "<rootDir>/src/__tests__/setup/global.teardown.ts",

  // Limpeza entre arquivos + matchers extras
  setupFilesAfterEnv: [
    "<rootDir>/src/__tests__/setup/jest.setup.ts",
    "jest-extended/all",
  ],

  collectCoverageFrom: ["src/modules/**/*.service.ts", "!src/**/*.d.ts"],
  testTimeout: 30000,
};
