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

var config     = require('config');
var CheckEvent = require('../../models/checkEvent');
var Hipchatter = require('hipchatter');
var moment = require('moment');



exports.initWebApp = function() {

  CheckEvent.on('afterInsert', function(checkEvent) {
    /* Example checkEvent: {
     "__v":0,
     "check": "54863f2cf7236e1074121f7b",
     "message": "restarted",
     "_id": "54c2fc0cad3c3f7b6cc28f1d",
     "tags": ["quux","baz","foo: bar"],
     "timestamp": "2015-01-24T01:57:32.918Z"
     } */
    checkEvent.findCheck(function(err, check) {
      if (err) {
        console.log('HipChat Plugin Error: ' + err);
      }

      if(!check.owner.notificationSettings.hipchat){
        return;
      }
      if(!check.notifiers) return;

      if(!check.notifiers.hipchat){
        return;
      }
      if(check.notifiers.hipchat.channels.length === 0) return;

      var roomIds = check.notifiers.hipchat.channels.split(',');
      var token = check.owner.notificationSettings.hipchat.apiKey;
      var uptimeDashboardURL = (config.displayUrl !='') ? config.displayUrl : config.url;
      var hipchatter = new Hipchatter(token);

    /*  if (!config.event[checkEvent.message]) {
        console.log('Event ' + checkEvent.message + ' is not enabled in the event section of HipChat config. Will not notify.');
        return;
      } else {

        console.log('Event ' + checkEvent.message + 'caught. Will notify!');
      }*/
      var status = checkEvent.message;
      var msg = '<a href="'+ uptimeDashboardURL +'/check/' + check._id  + '?type=hour&date='+ new Date().getTime() + '">'+ check.name +'</a>';
      var color = 'yellow';
      if(status == "up"){
        if(checkEvent.downtime){
          msg += ' is now up after '+ moment.duration(checkEvent.downtime).humanize() +' of downtime';
        } else {
          msg += ' is now up';
        }
        color = 'green'
      }

      if(status == "down"){
         msg += ' went down';
        color = 'red'
      }

      if(status == "paused" || status == "restarted"){
        msg += ' was '+ status
      }

      var payload = {
        'token': token,
        'color': color,
        'message': msg,
        'notify': true,
        'message_format': 'html'
      };

      for(var i=0; i < roomIds.length; i++){
        var roomId = roomIds[i];
        hipchatter.notify(roomId, payload, function(err) {
              if (err == null) console.log('HipChat notification to room '+ roomId +' successful send.');
              if(err) console.log('HipChat Error: ',err)
            }
        );
      }
    });  // end checkEvent.findCheck(function(err, check) block
  });  // end CheckEvent.on('afterInsert', function(checkEvent) block

  console.log('Enabled HipChat notifications');

};  // end exports.initWebApp = function()