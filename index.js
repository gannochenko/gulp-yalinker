"use strict";

let fs = require('fs');
let util = require('util');
let stream = require('stream');
let glob = require('glob');
let os = require('os');

let _ = require('lodash');
let gulpUtil = require('gulp-util');

module.exports = {
  makeStream: function(options){
    return new YALStream(options);
  }
};

class YALStream extends stream.Transform
{
  constructor(options)
  {
    super({
      objectMode: true // gulp uses objects in stream, so we have to turn objectMode on
    });

    this.enabled = true;
    this.options = _.extend({
      files: [],
      fileTemplate: '{{src}}?{{mtime}}',
      areaStart: '<!--START-->',
      areaEnd: '<!--END-->',
      publicFolder: ''
    }, options || {});

    this.checkOptions();
  }

  checkOptions()
  {
    if(!_.isArray(this.options.files) || !this.options.files.length)
    {
      gulpUtil.log('No input files, this task will be skipped.');
      this.enabled = false;
    }
    this.options.files = this.parseFiles(this.options.files);

    this.options.areaStart = this.options.areaStart.toString();
    this.options.areaEnd = this.options.areaEnd.toString();
    if(!this.options.areaStart.length)
    {
      gulpUtil.log('Illegal areaStart delimiter specified files, this task will be skipped.');
      this.enabled = false;
    }
    if(!this.options.areaEnd.length)
    {
      gulpUtil.log('Illegal areaEnd delimiter specified files, this task will be skipped.');
      this.enabled = false;
    }

    this.options.fileTemplate = this.options.fileTemplate.toString();
    this.options.publicFolder = this.options.publicFolder.toString();
  }

  parseFiles(files)
  {
    files = _.flattenDeep(files);
    files = files.map(function(file){
      file = file.toString().trim();
      let not = false;
      if(file[0] === '!')
      {
        not = true;
        file = file.substr(1);
      }

      return {
        pattern: file,
        not: not
      };
    });

    return files;
  }

  getAssetFiles(patternSet)
  {
    let pResolve = null;
    let pReject = null;
    let p = new Promise(function(resolve, reject){
      pResolve = resolve;
      pReject = reject;
    });

    if(!this.files)
    {
      this.files = [];

      patternSet.forEach(function(item){
        let found = glob.sync(item.pattern, {});
        if(found && found.length)
        {
          this.files = _[item.not ? 'difference' : 'union'](this.files, found);
        }
      }.bind(this));

      this.files = this.files.map((item) => {
        return {
          file: item,
          stat: null
        };
      });

      // now get mtime of each file
      let statPromises = [];
      this.files.forEach((item, i) => {

        (function(items, i, statPromises){

          statPromises.push(new Promise(function(resolve, reject){

            fs.stat(items[i].file, function(err, stat){
              if(err)
              {
                reject(err);
              }
              else
              {
                items[i].stat = stat;
                resolve(stat);
              }
            });

          }));

        })(this.files, i, statPromises);
      });

      // get stats of all files
      Promise.all(statPromises).then(function(){
        pResolve(this.files);
      }.bind(this));
    }
    else
    {
      pResolve(this.files);
    }

    return p;
  }

  processInputFile(file)
  {
    let pResolve = null;
    let pReject = null;
    let p = new Promise(function(resolve, reject){
      pResolve = resolve;
      pReject = reject;
    });

    let doJob = false;

    if(this.enabled && file.contents instanceof Buffer)
    {
      // convert file contents buffer into string
      let contents = file.contents.toString();

      let start = contents.indexOf(this.options.areaStart);
      let end = contents.indexOf(this.options.areaEnd);

      if(start >= 0 && end >= 0 && start < end)
      {
        doJob = true;
        this.getAssetFiles(this.options.files).then(function(files){

          if(files.length)
          {
            let html = [];
            files.forEach(function(item){

              html.push(this.options.fileTemplate
                .replace('{{src}}', item.file.replace(this.options.publicFolder, '/'))
                .replace('{{mtime}}', (new Date(item.stat.mtime)).getTime())
              );

            }.bind(this));

            let padding = this.getStartPadding(contents, start);
            let newContent = contents.substr(0, start + this.options.areaStart.length) + os.EOL + padding +
              html.join(os.EOL + padding) +
              os.EOL + padding +
              contents.substr(end);

            file.contents = new Buffer(newContent);
            pResolve(file);
          }

        }.bind(this));
      }
    }

    if(!doJob)
    {
      pResolve(file);
    }

    return p;
  }

  getStartPadding(contents, i)
  {
    if(i == 0)
    {
      return '';
    }

    let char = null;
    let padding = '';
    for(let k = i - 1; k >= 0; k--)
    {
      char = contents.charCodeAt(k);
      if(char == 0x0A || char == 0x0D)
      {
        break;
      }

      padding = String.fromCharCode(char == 0x09 ? 0x09 : 0x20) + padding;
    }

    return padding;
  }

  _transform(chunk, enc, cb)
  {
    if(chunk.isBuffer())
    {
      this.processInputFile(chunk).then(function(chunk){

        this.push(chunk);
        cb();

      }.bind(this));
    }
    else
    {
      this.emit('error', new gulpUtil.PluginError('gulp-yalinker', 'Bad input file'));

      if(!chunk.isNull())
      {
        return cb();
      }
    }
  }
}
