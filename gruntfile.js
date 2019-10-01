/* global module */

module.exports = function (grunt)
{
	// load plugins
	grunt.loadNpmTasks('grunt-contrib-stylus');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-eslint');
	grunt.loadNpmTasks('grunt-zip');

	grunt.initConfig(
		{
			// pkg: grunt.file.readJSON('package.json'),

			eslint:
			{
				options: { configFile: '.eslintrc' },
				development: [ 'src/*.js' ]
			},

			stylus: {
				options: {
				},
				build: {
					options: {
						compress: false,
						linenos: false
					},
					files: [{
						expand: true,
						src: [ 'src/*.styl' ],
						dest: '.',
						ext: '.css'
					}]
				}
			},

			watch:
			{
				options: { atBegin: true, spawn: false },
				javascript:
				{
					files: [ 'src/*.js' ],
					tasks: [ 'eslint' ]
				},
				stylesheet:
				{
					files: [ 'src/*.styl' ],
					tasks: [ 'stylus' ]
				},
				other:
				{
					files: [ 'src/*' ],
					tasks: [ 'zip:chromium', 'zip:mozilla' ]
				}
			},

			zip: {
				chromium: {
					src: [ 'src/*' ],
					dest: 'dist/chromium.zip',
					compression: 'DEFLATE',
					router: function (filepath) {
						if (filepath.match(/-mozilla/)) return null;
						filepath = filepath.replace(/src\//, '');
						filepath = filepath.replace(/-chromium/, '');
						return filepath;
					}
				},
				mozilla: {
					src: [ 'src/*' ],
					dest: 'dist/mozilla.zip',
					compression: 'DEFLATE',
					router: function (filepath) {
						if (filepath.match(/-chromium/)) return null;
						filepath = filepath.replace(/src\//, '');
						filepath = filepath.replace(/-mozilla/, '');
						return filepath;
					}
				}
			}
		});

		// register at least this one task
		grunt.registerTask('default', [ 'watch' ]);
};
