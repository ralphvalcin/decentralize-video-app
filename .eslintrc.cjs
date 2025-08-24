module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended'
  ],
  plugins: ['react', 'react-hooks', 'import'],
  ignorePatterns: [
    'dist',
    'build', 
    'node_modules',
    '**/.!*',  // Ignore temporary files with .! pattern
    '*.tmp',
    '*.temp',
    'src/components/.!*',  // More specific for these temp files
    '.!*'  // Additional pattern for temp files
  ],
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  globals: {
    process: 'readonly',
    Buffer: 'readonly',
    clients: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'no-unused-vars': ['error', { 
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'react-hooks/exhaustive-deps': 'warn',
    'react/prop-types': 'off',
    'import/no-unresolved': 'error'
  }
};
