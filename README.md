# Yet Another Linker for Gulp!

## Installation

`npm install gulp-yalinker --save-dev`

## Usage

```javascript
let yaLinker = require('gulp-yalinker');

let assets = {
    js: [
        'js/dependencies/**/*.js'
    ],
    css: [
        'styles/*.css'
    ]
};

gulp.task('place-assets', function() {
    return gulp.src(['templates/*.html', 'templates/*.ejs'])
    // place js
    .pipe(yaLinker.makeStream({
        files: assets.js,
        fileTemplate: '<script src="{{src}}?{{mtime}}"></script>',
        areaStart: '<!--SCRIPTS-->',
        areaEnd: '<!--SCRIPTS_END-->',
        publicFolder: '.tmp/public/'
    }))
    // place css
    .pipe(yaLinker.makeStream({
        files: assets.css,
        fileTemplate: '<link rel="stylesheet" href="{{src}}?{{mtime}}">',
        areaStart: '<!--STYLES-->',
        areaEnd: '<!--STYLES_END-->',
        publicFolder: '.tmp/public/'
    }))
    .pipe(gulp.dest('templates/'));
});
```

Enjoy!