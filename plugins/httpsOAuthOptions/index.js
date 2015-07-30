/**
 * HTTP options plugin
 *
 * Add options to a HTTP/HTTPS poller on a per-check basis
 *
 * Installation
 * ------------
 * This plugin is enabled by default. To disable it, remove its entry 
 * from the `plugins` key of the configuration:
 *
 *   // in config/production.yaml
 *   plugins:
 *     # - ./plugins/httpOptions
 *
 * Usage
 * -----
 * Add the custom HTTP/HTTPS options in the 'HTTP Options' textarea displayed 
 * in the check Edit page, in YAML format. For instance:
 *
 * method: HEAD
 * headers:
 *   User-Agent: This Is Uptime Calling
 *   X-My-Custom-Header: FooBar
 *
 * See the Node documentation for a list of available options.
 *
 * When Uptime polls a HTTP or HTTPS check, the custom options override
 * the ClientRequest options.
 */
var fs   = require('fs');
var ejs  = require('ejs');
var yaml = require('js-yaml');
var express = require('express');

var template = fs.readFileSync(__dirname + '/views/_detailsEdit.ejs', 'utf8');

exports.initWebApp = function(options) {

  var dashboard = options.dashboard;

	dashboard.on('populateFromDirtyCheck', function(checkDocument, dirtyCheck, type) {
		if (type !== 'https+oauth') return;
    if (!dirtyCheck.httpsOAuth_options) return;
    var httpsOAuth_options = dirtyCheck.httpsOAuth_options;
    try {
      var options = yaml.safeLoad(dirtyCheck.httpsOAuth_options);
      checkDocument.setPollerParam('httpsOAuth_options', options);
    } catch (e) {
      if (e instanceof YAMLException) {
        throw new Error('Malformed YAML configuration ' + dirtyCheck.httpsOAuth_options);
      } else throw e;
    }
	});

  dashboard.on('checkEdit', function(type, check, partial) {
    if (type !== 'https+oauth') return;
    check.httpsOAuth_options = '';
    var options = check.getPollerParam('httpsOAuth_options');
    if (options) {
      try {
        options = yaml.safeDump(options);
      } catch (e) {
        if (e instanceof YAMLException) {
          throw new Error('Malformed HTTP options');
        } else throw e;
      }
      check.setPollerParam('httpsOAuth_options', options);
    }
    partial.push(ejs.render(template, { locals: { check: check } }));
  });

  options.app.use(express.static(__dirname + '/public'));

};

exports.initMonitor = function(options) {

  options.monitor.on('pollerCreated', function(poller, check, details) {
    if (check.type !== 'https+oauth') return;
    var options = check.pollerParams && check.pollerParams.httpsOAuth_options;
    if (!options) return;
    // add the custom options to the poller target
    for (var key in options) {
      poller.target[key] = options[key];
    }
    return;
  });
};
