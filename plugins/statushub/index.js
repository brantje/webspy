/**
 * StatusHub plugin for the uptime project - https://github.com/fzaninotto/uptime
 * *
 * This index.js files goes to a directory `plugins/statushub` in your installation of uptime.
 *
 * Notifies all events (up, down, paused, restarted) to StatusHub.
 *
 * To enable the plugin, add the following line to the plugins section of your config file
 * plugins:
 *  - ./plugins/statushub
 *
 * Example configuration:
 *
 *   statushub:
 *     endpoint: https://statushub.io/api/status_pages
 *     subdomains: ["yoursubdomain"]
 *     apiKey: 588ff11a49722aef041f74005d657647
 *
 * StatusHub API usage samples
 *
 * To get an id of a service of you status page call: https://statushub.io/api/status_pages/yaas?api_key=your_api_key
 *
 * Create Incident and change status: https://statushub.io/api/status_pages/yaas/services/SERVICE_ID/incidents
 *               api key must be passed as a parameter and in the body: {"api_key":"API_KEY", "incident": { "title": "title", "update" :{"body": "message", "incident_type":"investigating"}}, "service_status": {"status_name": "down"} }
 *
 * Just Status Change up/down: https://statushub.io/api/status_pages/yaas/services/SERVICE_ID/service_statuses
 *              api key must be passed as a parameter and in the body: {"api_key":"API_KEY", "service_status": {"status_name": "down"} }
 */
var CheckEvent = require('../../models/checkEvent');
var spore = require('spore');
var fs         = require('fs');
var ejs        = require('ejs');

exports.initWebApp = function(options) {
  var config = options.config.statushub;
  var status = spore.createClient({
    "base_url" : config.endpoint,
    "methods" : {
      "availability" : {
        "path" : "/" + config.subdomains[0] + "/services/:serviceId/service_statuses?api_key="+config.apiKey,
        "method" : "POST",
        "headers" : {"Content-Type" : "application/json"}
      }
    }
  });
  if (config.apiKey) {
    CheckEvent.on('afterInsert', function (checkEvent) {
      checkEvent.findCheck(function (err, check) {
        incidentDescriptionHandler = {
          down: function (check, checkEvent) {
            return {
              service_status: {status_name: "down"}
            }
          },
          up: function (check, checkEvent) {
            return {
              service_status: {status_name: "up"}
            }
          },
        }
        if (incidentDescriptionHandler[checkEvent.message]) {
          status.availability({
              serviceId: check.statusHubId
            }, JSON.stringify(incidentDescriptionHandler[checkEvent.message](check, checkEvent))
            , function (err, result) {
              if (result.status == "200") {
                console.log('StatusHub: service status changed');
              } else {
                console.error('StatusHub: error changing service status. \nResponse: ' + JSON.stringify(result));
              }
            });
        }
      });
    });
  }
  console.log('Enabled StatusHub notifications');
};