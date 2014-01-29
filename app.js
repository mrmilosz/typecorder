#!/usr/bin/env node

var express    = require('express'      )
  , http       = require('http'         )
  , stylus     = require('stylus'       )
  , nib        = require('nib'          )
  , optimist   = require('optimist'     )(process.argv.slice(2)) // Bug in optimist; can't use global instance
  , mongoose   = require('mongoose'     )
  ;

var Schema     = mongoose.Schema
  , Negotiator = require('negotiator')
  ;

optimist.usage('Run an instance of the web app.\nUsage: $0')
  .demand(  'p')
  .alias(   'p', 'port')
  .describe('p', 'The port on which to run the web app')

  .boolean( 'd')
  .alias(   'd', 'dev')
  .describe('d', 'Turn on developer mode (logging, no compression)')
  ;

var opts = optimist.argv;

/*
 * Database
 */

mongoose.connect('mongodb://localhost/typecorder');
var Recording = mongoose.model('Recording', new Schema({
  title: String,
  data: [{ time: Number, content: String }]
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

app.use(mediaType);                                          // Custom request method: mediaType

app.use(express.bodyParser());                               // Read POST bodies into request.body

app.use(app.router);                                         // First try to match routes
app.use(stylus.middleware({                                  // Compile styles; about to enter static
  src: __dirname + '/styles',
  dest: __dirname,
  compile: function(string, filePath) {
    return stylus(string)
      .set('filename', filePath)
      .use(nib())
      ;
  }
}));
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

app.get('/:key?', function(request, response, next) {
  if (request.mediaType === 'text/html') {
    response.render('index');
  }
  else if (request.mediaType === 'application/json') {
    recording: Recording.findById(request.param('key'), function(error, recording) {
      var payload = {};
      if (error) {
        response.status(500);
        payload['error'] = error;
      }
      else if (!recording) {
        response.status(404);
        payload['error'] = 'No recording has this ID';
      }
      else {
        response.status(200);
        payload['result'] = {
          recording: recording
        };
      }
      response.json(payload);
    });
  }
  else {
    next();
  }
});

app.post('/', function(request, response, next) {
  if (request.mediaType === 'application/json') {
    new Recording(request.body).save(function(error, recording) {
      var payload = {};
      if (error) {
        response.status(500);
        payload['error'] = error;
      }
      else {
        response.status(200);
        payload['result'] = {
          id: recording._id
        };
      }
      response.json(payload);
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
 * HTTP server
 */

var server = http.createServer(app).listen(opts.port);
