'use strict';

/**
 * Pushover plugin for the uptime project - https://github.com/fzaninotto/uptime
 *
 * Notifies all events (up, down, paused, restarted) to XM
 *
 * This plugin has a dependency on `mtfe-xm-client`.
 * Add this to the "dependencies" object in your `package.json` file :
 *
 * To enable the plugin, add the following line to the plugins section of your config file
 * plugins:
 *  - ./plugins/xmnotify
 *
 * Example configuration
 *
 *   xmnotify:
 *     appkey: 8973lkhjfdso8y3      # appkey from xm
 *     secret: 09r4ljfdso98r        # secret token from xm
 *     receivers:                   # list of receivers
 */

var config = require('config').xmnotify,
    debug = require('debug')('uptime-xmnotify'),
    XMClient = require('mtfe-xm-client').Client,
    CheckEvent = require('../../models/checkEvent');

var client = new XMClient(config.appkey, config.secret);

exports.initMonitor = function () {

    CheckEvent.on('afterInsert', function(checkEvent) {
        if (!config.event[checkEvent.message]) {
            return;
        }

        checkEvent.findCheck(function(err, check) {
            if (err) {
                return debug(err);
            }

            client.send({
                receivers: config.receivers,
                body: "The application " + check.name + " just went to status " + checkEvent.message,
            });

        });
    });

    debug('Enabled Pushover notifications');
};

