var url     = require('url'),
    http    = require('http'),
    https   = require('https'),
    fs      = require('fs'),
    qs      = require('querystring'),
    express = require('express'),
    app     = express();

var TRUNCATE_THRESHOLD = 10,
    REVEALED_CHARS = 3,
    REPLACEMENT = '***';

var CONFIG_PATH = '/config.json',
    LOCAL_CONFIG_PATH = '/local_config.json';

// Load config defaults from JSON file.
// Environment variables override defaults.
function loadConfig(local = false) {
  var path = local ? LOCAL_CONFIG_PATH : CONFIG_PATH;
  var config = JSON.parse(fs.readFileSync(__dirname + path, 'utf-8'));
  log('Configuration');
  for (var i in config) {
    var configItem = process.env[i.toUpperCase()] || config[i];
    if (typeof configItem === "string") {
      configItem = configItem.trim();
    }
    config[i] = configItem;
    if (i === 'oauth_client_id' || i === 'oauth_client_secret') {
      log(i + ':', config[i], true);
    } else {
      log(i + ':', config[i]);
    }
  }
  return config;
}

var config = loadConfig(false);
var local_config = loadConfig(true);

function authenticate(code, cb, local = false) {
  var curr_config = local ? local_config : config
  var data = qs.stringify({
    client_id: curr_config.oauth_client_id,
    client_secret: curr_config.oauth_client_secret,
    code: code
  });

  var reqOptions = {
    host: curr_config.oauth_host,
    port: curr_config.oauth_port,
    path: curr_config.oauth_path,
    method: curr_config.oauth_method,
    headers: { 'content-length': data.length }
  };

  var body = "";
  var req = https.request(reqOptions, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) { body += chunk; });
    res.on('end', function() {
      cb(null, qs.parse(body).access_token);
    });
  });

  req.write(data);
  req.end();
  req.on('error', function(e) { cb(e.message); });
}

/**
 * Handles logging to the console.
 * Logged values can be sanitized before they are logged
 *
 * @param {string} label - label for the log message
 * @param {Object||string} value - the actual log message, can be a string or a plain object
 * @param {boolean} sanitized - should the value be sanitized before logging?
 */
function log(label, value, sanitized) {
  value = value || '';
  if (sanitized){
    if (typeof(value) === 'string' && value.length > TRUNCATE_THRESHOLD){
      console.log(label, value.substring(REVEALED_CHARS, 0) + REPLACEMENT);
    } else {
      console.log(label, REPLACEMENT);
    }
  } else {
    console.log(label, value);
  }
}


// Convenience for allowing CORS on routes - GET only
app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});


app.get('/authenticate/:code', function(req, res) {
  log('authenticating code:', req.params.code, true);
  authenticate(req.params.code, function(err, token) {
    var result
    if ( err || !token ) {
      result = {"error": err || "bad_code"};
      log(result.error);
    } else {
      result = {"token": token};
      log("token", result.token, true);
    }
    res.json(result);
  }, false);
});

app.get('/authenticateLocal/:code', function(req, res) {
  log('authenticating code:', req.params.code, true);
  authenticate(req.params.code, function(err, token) {
    var result
    if ( err || !token ) {
      result = {"error": err || "bad_code"};
      log(result.error);
    } else {
      result = {"token": token};
      log("token", result.token, true);
    }
    res.json(result);
  }, true);
});

module.exports.config = config;
module.exports.app = app;
