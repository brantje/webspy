/**
 * Webhooks plugin
 *
 * Notifies all events (up, down, paused, restarted) by sending a
 * HTTP POST request to the given URL. The request will have a
 * JSON payload of data from the event
 *
 * To enable the plugin, call init() from plugins/index.js
 *   exports.init = function() {
 *     require('./webhooks').init();
 *   }
 *
 */

var http       = require('http');
var https      = require('https');
var url        = require('url');
var util       = require('util');
var config     = require('config');
var CheckEvent = require('../../models/checkEvent');

exports.initWebApp = function() {
  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      var payload = {};
      if (err) return console.error(err);
      if(!check.notifiers) return;
      if(!check.notifiers.webhooks) return;
      if(!check.notifiers.webhooks[checkEvent.message]) return;

      var hrefs = check.notifiers.webhooks[checkEvent.message];
      payload.name      = check.name;
      payload.url       = check.url;
      payload.details   = checkEvent.details;
      payload.message   = checkEvent.message;
      payload.dashboard = config.displayUrl + '/dashboard/checks/' + check._id + '?type=hour&date=' + checkEvent.timestamp.valueOf();
      payload.tags      = check.tags;
      payload.timestamp = checkEvent.timestamp;
      payload.downtime = checkEvent.downtime || 0;

      hrefs.forEach(function(href) {
        var options = url.parse(href);
        var connection = options.protocol.indexOf('https') > -1 ? https : http;
        options.method = 'POST';
        options.headers = {
          'Content-Type' : 'application/json'
        };

        var req = connection.request(options, function(res) {

        });

        req.on('error', function(e) {
          console.log('Problem with webhook request: ' + e.message);
        });

        req.on('finish', function(e) {
          console.log('Webhook called: '+ href);
        });

        req.write(JSON.stringify(payload));
        req.end();
      });

    });
  });
  console.log('Enabled webhooks plugin');
};  // end exports.initWebApp = function()