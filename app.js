#!/usr/bin/env node

var express    = require('express'      )
  , http       = require('http'         )
  , stylus     = require('stylus'       )
  , nib        = require('nib'          )
  , mongoose   = require('mongoose'     )
  , fs         = require('fs'           )
  ;

var Schema     = mongoose.Schema
  , Negotiator = require('negotiator')
  ;

/* 
 * Preprocessing
 */

// Stylus -> CSS
fs.readdir(__dirname + '/styles', function(error, filenames) {
  filenames.forEach(function(filename) {
    var fileExtensionDelimiterIndex = filename.lastIndexOf('.');
    if (fileExtensionDelimiterIndex > 0) {
      var fileBasename = filename.substr(0, fileExtensionDelimiterIndex),
        fileExtension = filename.substr(fileExtensionDelimiterIndex + 1);
    }
    else {
      var fileBasename = filename,
        fileExtension = null;
    }

    if (fileExtension === 'styl') {
      var filePath = __dirname + '/styles/' + filename;
      fs.readFile(filePath, 'utf8', function(error, stylusContent) {
        stylus(stylusContent)
          .set('filename', filePath)
          .use(nib())
          .render(function(error, cssContent) {
            fs.writeFile(__dirname + '/static/css/' + fileBasename + '.css', cssContent);
          })
          ;
      });
    }
  });
});

/*
 * Database
 */

mongoose.connect('mongodb://localhost/typecorder');
var Recording = mongoose.model('Recording', new Schema({
  title: String,
  data: [{ time: Number, patch: String }]
}));

/*
 * Express app
 */

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

/*
 * Express app - middleware
 */

app.use(express.logger());                                   // Log requests
app.use(express.compress());                                 // Set up all responses to be compressed
app.use(mediaType);                                          // Custom request member: mediaType
app.use(express.json());                                     // Read JSON POST bodies into request.body

app.use(app.router);                                         // First try to match routes

app.use('/static', express.static(__dirname + '/static'));   // Hit up static

app.use(function(request, response, next) {                  // Finally throw an error
  if (request.mediaType === 'text/html') {
    response.status(404);
    response.render('error', {
      error: '404 No such route: ' + request.path
    });
  }
  else if (request.mediaType === 'application/json') {
    response.status(404);
    response.json({
      'error': '404 No such route: ' + request.path
    });
  }
  else {
    response.status(406);
    response.end();
  }
});

/*
 * Express app - routes
 */

app.get('/:key?.:format?', function(request, response, next) {
  if (request.mediaType === 'text/html') {
    response.render('index');
  }
  else if (request.mediaType === 'application/json') {
    var objectId = keyToObjectId(request.param('key'));
    if (objectId) {
      Recording.findById(objectId, function(error, recording) {
        if (error) {
          response.status(500);
          response.json({
            error: error
          });
        }
        else if (!recording) {
          response.status(404);
          response.json({
            error: 'No recording has this ID'
          });
        }
        else {
          response.status(200);
          response.json({
            result: {
              recording: recording
            }
          });
        }
      });
    }
    else {
      response.status(404);
      response.json({
        'error': 'No recording has this ID'
      });
    }
  }
  else {
    next();
  }
});

app.post('/', function(request, response, next) {
  if (request.mediaType === 'application/json') {
    new Recording(request.body).save(function(error, recording) {
      if (error) {
        response.status(500);
        response.json({
          error: error
        });
      }
      else {
        response.status(200);
        response.json({
          result: {
            id: objectIdToKey(recording._id.toString())
          }
        });
      }
    });
  }
  else {
    next();
  }
});

/*
 * Custom middleware
 */

function mediaType(request, response, next) {
  request.mediaType = new Negotiator(request).mediaType(['text/html', 'application/json']);
  next();
}

/*
 * Helpers
 */

function objectIdToKey(objectId) {
  if (objectId.length != 24) {
    return false;
  }
  try {
    return new Buffer(objectId, 'hex').toString('base64').replace('+', '-').replace('/', '_');
  }
  catch (e) {
    return false;
  }
}

function keyToObjectId(key) {
  if (key.length != 16) {
    return false;
  }
  try {
    return new Buffer(key.replace('-', '+').replace('_', '/'), 'base64').toString('hex');
  }
  catch (e) {
    return false;
  }
}

/*
 * HTTP server
 */

var server = http.createServer(app).listen(process.env.PORT);
