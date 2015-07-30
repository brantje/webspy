/**
 * Module dependencies.
 */

var util = require('util');
var url = require('url');
var net = require('net');
var BaseHttpPoller = require('../http/baseHttpPoller');

// The http module lacks proxy support. Let's monkey-patch it.
require('../../proxy');
/**
 * SMTP Poller, to check smtp servers
 *
 * @param {Mixed} Poller Target host:port
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function SmtpPoller(target, timeout, callback) {
  SmtpPoller.super_.call(this, target, timeout, callback);
}

util.inherits(SmtpPoller, BaseHttpPoller);

SmtpPoller.type = 'smtp';

SmtpPoller.validateTarget = function (target) {
  return url.parse(target).protocol == 'smtp:';
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
SmtpPoller.prototype.poll = function (secure) {
  SmtpPoller.super_.prototype.poll.call(this);
  var poller = this;
  try {
    var target = this.target;
    var res = {};
    var port = target.port || 25;
    var dT = 0;

    var socket = new net.Socket();
    socket.connect(port,target.hostname);
    socket.on('data',function(data){
      var dataAsString = data.toString('utf-8');
      var regExp = new RegExp(/([0-9]{0,3})\s/g);
      var match = regExp.exec(dataAsString);
      if(match[0]){
        var protStatus = match[0]*1;
        switch(protStatus){
          case 220:
            socket.write('HELO ' + target.hostname + '\r\n');
            break;
          case 250:
            socket.write('QUIT\r\n');
            break;
        }
      }
    });

    socket.setTimeout(poller.timeout,function(e){
      console.log('Timeout of ', poller.timeout/1000, 's reached');
      socket.destroy();
    });

    socket.on('end', function () {
      poller.timer.stop();
      poller.debug(poller.getTime() + "ms - Request Finished");
      poller.callback(undefined, poller.getTime(), res);
    });
    socket.on('error', function (e) {
      console.log('error',e)
      poller.timer.stop();
      poller.onErrorCallback(e);
    });
   /* var client = net.connect({
        port: port,
        host: target.hostname,
        timeout: poller.timeout
      },
      function () { //'connect' listener
      });
    client.on('data', function (data) {
      clearTimeout(dT);
      var dataAsString = data.toString('utf-8');
      var regExp = new RegExp(/([0-9]{0,3})\s/g);
      var match = regExp.exec(dataAsString);
      if(match[0]){
        var protStatus = match[0]*1;
        switch(protStatus){
          case 220:
            client.write('HELO ' + target.hostname + '\r\n');
            break;
          case 250:
            client.write('QUIT\r\n');
            break;
        }
      } else {

      }
    });
    client.on('end', function () {
      poller.timer.stop();
      poller.debug(poller.getTime() + "ms - Request Finished");
      poller.callback(undefined, poller.getTime(), res);
    });
    client.on('error', function (e) {
      poller.timer.stop();
      poller.onErrorCallback(e);
    });*/
  } catch (err) {
    err = err || 'Error connecting to STMP server';
    console.log('err', err);
    console.log(this);
    return poller.onErrorCallback(err);
  }
  //this.request.on('error', this.onErrorCallback.bind(this));
};

// see inherited function BaseHttpPoller.prototype.onResponseCallback
// see inherited function BaseHttpPoller.prototype.onErrorCallback


module.exports = SmtpPoller;