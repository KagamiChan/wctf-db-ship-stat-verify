module.exports = {
  'extends': [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
  ],
  'plugins': [
    'import'
  ],
  'parser': 'babel-eslint',
  'rules': {
    'comma-dangle': ['error', 'always-multiline'],
    'semi': ['error', 'never'],
    'no-console': ['warn', {'allow': ['warn', 'error']}],
  }
}
