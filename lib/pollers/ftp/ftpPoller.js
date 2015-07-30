/**
 * Module dependencies.
 */

var util = require('util');
var url  = require('url');
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
function FtpPoller(target, timeout, callback) {
  FtpPoller.super_.call(this, target, timeout, callback);
}

util.inherits(FtpPoller, BaseHttpPoller);

FtpPoller.type = 'ftp';

FtpPoller.validateTarget = function(target) {
  return url.parse(target).protocol == 'ftp:';
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
FtpPoller.prototype.poll = function(secure) {
  FtpPoller.super_.prototype.poll.call(this);
  var poller = this;
  var hasBeenConnected = false;
  try {
    var target = this.target;
    var res = {};
    var port = target.port || 21;
    var dT = 0;

    var socket = new net.Socket();
    socket.connect(port,target.hostname);
    socket.on('data',function(data){
      var dataAsString = data.toString('utf-8');
      var regExp = new RegExp(/([0-9]{0,3})\s/g);
      var match = regExp.exec(dataAsString);
      var protStatus = match[0]*1;
      switch(protStatus){
        case 220:
          socket.write('QUIT\r\n');
          break;
      }
    });

    socket.setTimeout(poller.timeout,function(e){
      socket.destroy();
    });

    socket.on('end', function () {
      poller.timer.stop();
      poller.debug(poller.getTime() + "ms - Request Finished");
      poller.callback(undefined, poller.getTime(), res);
    });
    socket.on('error', function (e) {
      poller.timer.stop();
      poller.onErrorCallback(e);
    });
  } catch(err) {
    err = err || 'Error connecting to FTP server';
    return poller.onErrorCallback(err);
  }
  //this.request.on('error', this.onErrorCallback.bind(this));
};

// see inherited function BaseHttpPoller.prototype.onResponseCallback
// see inherited function BaseHttpPoller.prototype.onErrorCallback


module.exports = FtpPoller;