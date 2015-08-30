/**
 *  Pushbullet plugin for the uptime project - https://github.com/fzaninotto/uptime
 * Thanks to DMathieu for the Campfire plugin which I basically hacked up to make this
 * work:  https://gist.github.com/dmathieu/5592418
 *
 * This index.js files goes to a directory `plugins/Pushbullet` in your installation of uptime.
 *
 * Notifies all events (up, down, paused, restarted) to pushbullet
 *
 * This plugin has a dependency on `pushover-notifications`.
 * Add this to the "dependencies" object in your `package.json` file :
 *
 *   "pushover-notifications":    "0.1.5"
 *
 *
 * To enable the plugin, add the following line to the plugins section of your config file
 * plugins:
 *  - ./plugins/pushbullet
 *
 * Example configuration
 */
var config = require('config');
var CheckEvent = require('../../models/checkEvent');
var Account = require('../../models/user/accountManager');
var PushBullet = require('pushbullet');
var moment = require('moment');

exports.initWebApp = function () {

  CheckEvent.on('afterInsert', function (checkEvent) {
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
      if(!check.owner.notificationSettings.pushbullet.apiKey){
        return;
      }
      var pusher = new PushBullet(check.owner.notificationSettings.pushbullet.apiKey);
      var message;
      var baseUrl = (config.displayUrl !='') ? config.displayUrl : config.url;
      if (checkEvent.message === 'up') {
        message = check.name + ' went back up after ' + moment.duration(checkEvent.downtime).humanize() + ' of downtime';
      } else {
        message = "The application " + check.name + " just went to status " + checkEvent.message
      }
      var deviceParams = {};
      pusher.link(deviceParams, message, baseUrl+'/dashboard/checks/'+ check._id +'?type=hour&date='+ checkEvent.timestamp.valueOf(), function (error, response) {
        if(error) console.log('Pusbbullet error: ', error);
        if(response) console.log('Pusbbullet notification successful send. ');
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