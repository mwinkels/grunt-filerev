'use strict';
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var eachAsync = require('each-async');

module.exports = function (grunt) {
  function makeHash(filepath, algorithm, fileEncoding, encoding) {
    var hash = crypto.createHash(algorithm);
  	if (grunt.file.isDir(filepath)) {
	  	grunt.file.recurse(filepath, function (abspath) {
		  	grunt.log.verbose.write('Hashing ' + abspath + '...');
			  hash.update(grunt.file.read(abspath), fileEncoding);
	  	});
	  } else {
	  	grunt.log.verbose.write('Hashing ' + filepath + '...');
	  	hash.update(grunt.file.read(filepath), fileEncoding);
	  }
    return hash.digest(encoding);
  }
  grunt.registerMultiTask('filerev', 'File revisioning based on content hashing', function () {
    var options = this.options({
      encoding: 'utf8',
      algorithm: 'md5',
      length: 8
    });
    var target = this.target;
    var filerev = grunt.filerev || {summary: {}};

    eachAsync(this.files, function (el, i, next) {
      var move = true;
      
      // If dest is furnished it should indicate a directory
      if (el.dest) {
        // When globbing is used, el.dest contains basename, we remove it
        if(el.orig.expand) {
          el.dest = path.dirname(el.dest);
        }

        try {
          var stat = fs.lstatSync(el.dest);
          if (stat && !stat.isDirectory()) {
            grunt.fail.fatal('Destination for target %s is not a directory', target);
          }
        } catch (err) {
          grunt.log.writeln('Destination dir ' + el.dest + ' does not exists for target ' + target + ': creating');
          grunt.file.mkdir(el.dest);
        }
        // We need to copy file as we now have a dest different from the src
        move = false;
      }

      el.src.forEach(function (file) {
        var dirname;
        var hash = makeHash(file, options.algorithm, options.encoding, 'hex');
        var suffix = hash.slice(0, options.length);
        var ext = path.extname(file);
        var elements = ext ? [path.basename(file, ext), suffix, ext.slice(1)] : [path.basename(file), suffix];
		    var newName = elements.join('.');
		    var resultPath;

        if (move) {
          dirname = path.dirname(file);
          resultPath = path.resolve(dirname, newName);
          fs.renameSync(file, resultPath);
        } else {
          dirname = el.dest;
          resultPath = path.resolve(dirname, newName);
          grunt.file.copy(file, resultPath);
        }

        filerev.summary[path.normalize(file)] = path.join(dirname, newName);
        grunt.log.writeln(chalk.green('✔ ') + file + chalk.gray(' changed to ') + newName);
      });
      next();
    }, this.async());

    grunt.filerev = filerev;
  });
};
