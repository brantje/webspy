/**
 * Module dependencies.
 */

var util  = require('util');
var https = require('https');
var http  = require('http');
var url   = require('url');
var fs    = require('fs');
var ejs   = require('ejs');
var BaseHttpPoller = require('../http/baseHttpPoller');

// The http module lacks proxy support. Let's monkey-patch it.
require('../../proxy');

/**
 * HTTPS Poller, to check web pages served via SSL
 *
 * @param {Mixed} Poller Target (e.g. URL)
 * @param {Number} Poller timeout in milliseconds. Without response before this duration, the poller stops and executes the error callback.
 * @param {Function} Error/success callback
 * @api   public
 */
function HttpsPoller(target, timeout, callback) {
  HttpsPoller.super_.call(this, target, timeout, callback);
}

util.inherits(HttpsPoller, BaseHttpPoller);

HttpsPoller.type = 'https+oauth';

HttpsPoller.validateTarget = function(target) {
  return url.parse(target).protocol == 'https:';
};

/**
 * Launch the actual polling
 *
 * @api   public
 */
HttpsPoller.prototype.poll = function(secure) {
  HttpsPoller.super_.prototype.poll.call(this);

  credentials = this.target.credentials
  endpoint = this.target.endpoint

  requestOAuthToken = function(onSuccess, onError) {
    var req = https.request(endpoint, function(res) {
      res.setEncoding('utf8');
   
      if(res.statusCode == 200) {
        body="";
        res.on('data', function (chunk) {
          body+=chunk;
        });
        
        res.on('end', function () {
          try {
            onSuccess(JSON.parse(body));
          } catch(err) {
            onError({name: "InvalidResponseData", message: "oauth authentication failed, invalid data in response"});
          }
        });
      } else {
        req.abort();
        onError({name: "InvalidResponseStatus", message: "oauth authentication failed, invalid status ("+res.statusCode+") in response"});
      }
    });
    req.setTimeout(10000, function() {
      req.abort();
    });

    req.on('error', function(err) {
      onError("oauth authentication failed");
    });

    req.end(JSON.stringify(credentials), "utf-8");
  };

  self = this;
  requestOAuthToken(function(auth) { 
    secure = typeof secure !== 'undefined' ? secure : true;
    try {
      parsedUrl = url.parse(self.target);
      var options = {
        hostname: parsedUrl.host,
        path: parsedUrl.pathname,
        method: 'GET',
        headers: {
          "Authorization" : "Bearer " + auth.accessToken
        }
      };

      if (secure) {
        self.request = https.request(options, self.onResponseCallback.bind(self));
      } else {
        self.request = http.request(options, self.onResponseCallback.bind(self));
      }
      self.request.on('error', self.onErrorCallback.bind(self));
      self.request.end();
    } catch(err) {

      return self.onErrorCallback(err);
    }   
  }, function(err) {
    return self.onErrorCallback(err);
  });
};

// see inherited function BaseHttpPoller.prototype.onResponseCallback
// see inherited function BaseHttpPoller.prototype.onErrorCallback

HttpsPoller.prototype.handleRedirectResponse = function(res) {
  this.debug(this.getTime() + "ms - Got redirect response to " + this.target.href);
  var target = url.parse(res.headers.location);
  if (!target.protocol) {
    // relative location header. This is incorrect but tolerated
    this.target = url.parse('http://' + this.target.hostname + res.headers.location);
    this.poll(false);
    return;
  }
  switch (target.protocol) {
    case 'https:':
      this.target = target;
      this.poll(true);
      break;
    case 'http:':
      this.target = target;
      this.poll(false);
      break;
    default:
      this.request.abort();
      this.onErrorCallback({ name: "WrongRedirectUrl", message: "Received redirection from https: to unsupported protocol " + target.protocol});
  }
  return;
};

module.exports = HttpsPoller;
