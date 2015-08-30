/**
 * HipChat plugin for the uptime project - https://github.com/fzaninotto/uptime
 *
 * This index.js files goes to a directory `plugins/hipchat` in your installation of uptime.
 *
 * Notifies all events (up, down, paused, restarted) to HipChat
 *
 * This plugin has a dependency on `hipchatter`.
 * Add this to the "dependencies" object in your `package.json` file :
 *
 *   "hipchatter":    "0.2.0"
 *
 * To enable the plugin, add the following line to the plugins section of your config file
 * plugins:
 *  - ./plugins/hipchat
 *
 * Example configuration
 *
 *
 *   hipchat:
 *     roomId: 1  # HipChat API Room ID or name (see Hipchatter docs)
 *     token: your-hipchat-room-notification-token
 *     uptimeDashboardURL: https://your-uptime-installation.example.com
 *
 *     event:
 *       up:        true
 *       down:      true
 *       paused:    false
 *       restarted: false
 */

var https       = require('https');
var url        = require('url');
var util       = require('util');
var config     = require('config');
var CheckEvent = require('../../models/checkEvent');
var moment = require('moment');



exports.initWebApp = function() {

  CheckEvent.on('afterInsert', function(checkEvent) {
    checkEvent.findCheck(function(err, check) {
      if (err) return console.error(err);
      if(!check.notifiers) return;
      if(!check.owner.notificationSettings.slack) return;
      if(!check.notifiers.slack) return;
      if(check.notifiers.slack.channels.length == 0) return;

      var channels = check.notifiers.slack.channels.split(',');
      var status = checkEvent.message;
      var msg = '<'+ config.displayUrl +'/check/' + check._id  + '?type=hour&date='+ new Date().getTime() + '|'+ check.name +'>';
      var color = '#439FE0';

      if(status == "up"){
        if(checkEvent.downtime){
          msg += ' is now up after '+ moment.duration(checkEvent.downtime).humanize() +' of downtime';
        } else {
          msg += ' is now up';
        }
        color = 'good'
      }

      if(status == "down"){
        msg += ' went down';
        color = 'danger'
      }

      if(status == "paused" || status == "restarted"){
        msg += ' was '+ status
      }

      for(var i=0; i < channels.length; i++){
        var payload = {};
        payload.token       = check.owner.notificationSettings.slack.apiKey;
        payload.channel     = channels[i].replace('#','%23');
        payload.username    = 'WebSpy';
        payload.text        = '';
        payload.icon_emoji  = ':fire';
        payload.attachments = [
          {
            "fallback": msg,

            "color": color,

            /*"pretext": "Optional text that appears above the attachment block",*/

            /*"author_name": "Bobby Tables",
            "author_link": "http://flickr.com/bobby/",
            "author_icon": "http://flickr.com/icons/bobby.jpg",*/

            "title": check.name,
            "title_link": config.displayUrl +'/check/' + check._id  + '?type=hour&date='+ new Date().getTime(),

            "text": msg,

            "fields": [
              {
                "title": "Priority",
                "value": "High",
                "short": false
              }, {
                "title": "Details",
                "value": (checkEvent.details) ? checkEvent.details : 'No details',
                "short": false
              }
            ]
            /*"image_url": "http://lorempixel.com/128/128",
            "thumb_url": "http://lorempixel.com/64/64"*/
          }
        ];
        payload.icon_url = 'http://lorempixel.com/48/48';
        payload.pretty = 1;
        var href = 'https://slack.com/api/chat.postMessage?token='+payload.token+'&attachments='+ encodeURIComponent(JSON.stringify(payload.attachments)) +'&icon_url='+ payload.icon_url +'&channel='+ payload.channel +'&text='+ encodeURIComponent(payload.text)+'&username='+ payload.username +'&pretty='+ payload.pretty;
        callback = function(response) {
          var str = '';
          response.on('data', function (chunk) {
            str += chunk;
          });

          response.on('end', function () {
            var d = JSON.parse(str);
            console.log('Slack notification successful send to channel '+ d.channel +'.');
          });
        };


        https.get(href,callback);
      }
    });
  });
  console.log('Enabled slack.com webhook plugin');
};  // end exports.initWebApp = function()