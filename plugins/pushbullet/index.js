/**
 * Pushover plugin for the uptime project - https://github.com/fzaninotto/uptime
 * Thanks to DMathieu for the Campfire plugin which I basically hacked up to make this
 * work:  https://gist.github.com/dmathieu/5592418
 *
 * This index.js files goes to a directory `plugins/pushover` in your installation of uptime.
 *
 * Notifies all events (up, down, paused, restarted) to pushover
 *
 * This plugin has a dependency on `pushover-notifications`.
 * Add this to the "dependencies" object in your `package.json` file :
 *
 *   "pushover-notifications":    "0.1.5"
 *
 *
 * To enable the plugin, add the following line to the plugins section of your config file
 * plugins:
 *  - ./plugins/pushover
 *
 * Example configuration
 *
 *   pushover:
 *     token: 8973lkhjfdso8y3 # Authentication token from pushover for app
 *     user: 09r4ljfdso98r # This is the user token you want to send to
 *
 *     event:
 *       up:        true
 *       down:      true
 *       paused:    false
 *       restarted: false
 */
var config = require('config').pushbullet;
var CheckEvent = require('../../models/checkEvent');
var Account = require('../../models/user/accountManager');
var PushBullet = require('pushbullet');
var moment = require('moment');

exports.initWebApp = function () {

  CheckEvent.on('afterInsert', function (checkEvent) {
    /* if (!config.event[checkEvent.message])
     return;*/

    checkEvent.findCheck(function (err, check) {
      if (err) {
        return console.error(err);
      }
      if(!check.notifiers){
        return;
      }
      if (!check.notifiers.pushbullet) {
        return
      }
      if(!check.notifiers.pushbullet.apikey){
        return;
      }
      var pusher = new PushBullet(check.notifiers.pushbullet.apikey);
      var message;
      if (checkEvent.message === 'up') {
        message = check.name + ' went back up after ' + moment.duration(checkEvent.downtime).humanize() + ' of downtime';
      } else {
        message = "The application " + check.name + " just went to status " + checkEvent.message
      }
      var msg = {
        message: message,
        title: "Uptime Status",
        sound: 'magic', // optional
        priority: 1 // optional
      };
      var deviceParams = {};
      pusher.note(deviceParams, msg.title, msg.message, function (error, response) {
        // response is the JSON response from the API
      });
      /*var push     = new pushover({
       token: config.token
       });
       push.user    = config.user;

       push.send( msg, function( err, result ) {
       if ( err ) {
       throw err;
       }
       console.log( result );
       });*/


    });
  });
  console.log('Enabled Pushbullet notifications');
};