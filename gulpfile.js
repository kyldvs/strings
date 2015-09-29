
var gulp = require('gulp');

require('kad-boilerplate')(gulp, {
  paths: {
    dest: 'lib',
    src: [
      'src/**/*.js',
      '!src/**/__tests__/**/*.js',
      '!src/**/__mocks__/**/*.js',
    ],
  },
});
