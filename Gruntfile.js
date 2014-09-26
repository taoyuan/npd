'use strict';

module.exports = function (grunt) {
    // Show elapsed time at the end
    require('time-grunt')(grunt);

    // load all grunt tasks matching the `grunt-*` pattern
    require('load-grunt-tasks')(grunt);

    // Project configuration.
    grunt.initConfig({
        mochaTest: {
            options: {
                reporter: 'spec',
                ui: 'bdd'
            },
            test: {
                src: ['test/**/*.test.js']
            }
        },
        jshint: {
            options: {
                jshintrc: '.jshintrc',
                reporter: require('jshint-stylish'),
                ignores: 'test/fixtures/**'
            },
            gruntfile: {
                src: 'Gruntfile.js'
            },
            lib: {
                src: ['lib/**/*.js']
            },
            test: {
                src: ['test/**/*.js']
            }
        },
        exec: {
            fixtures: {
                command: 'node test/packages.js'
            },
            'fixtures-force': {
                command: 'node test/packages.js --force'
            },
//            cover: {
//                command: 'STRICT_REQUIRE=1 node node_modules/istanbul/lib/cli.js cover --dir ./test/reports node_modules/mocha/bin/_mocha -- -R dot test/test.js'
//            },
//            coveralls: {
//                command: 'node node_modules/.bin/coveralls < test/reports/lcov.info'
//            }
        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            lib: {
                files: '<%= jshint.lib.src %>',
                tasks: ['jshint:lib', 'mochaTest']
            },
            test: {
                files: '<%= jshint.test.src %>',
                tasks: ['jshint:test', 'mochaTest']
            }
        }
    });

    grunt.registerTask('test', ['jshint', 'exec:fixtures', 'mochaTest']);

    // Default task.
    grunt.registerTask('default', [
//        'jshint',
        'test'
    ]);

};
