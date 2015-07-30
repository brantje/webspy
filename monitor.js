module.exports = function(cluster) {
  if(cluster) {
    console.log('Hello from monitor worker ' + cluster.worker.id);
  }
  var fs = require('fs');
  var config = require('config');
  var Monitor = require('./lib/monitor');

// start the monitor
  config.monitor.selfSigned = config.ssl && config.ssl.selfSigned ? true : false;
  monitor = Monitor.createMonitor(config.monitor);

// load plugins
  config.plugins.forEach(function (pluginName) {
    var plugin = require(pluginName);
    if (typeof plugin.initMonitor !== 'function') return;
    var pid = (cluster) ?  cluster.worker.process.pid : 0
    console.log('loading plugin %s on monitor %d', pluginName, pid);
    plugin.initMonitor({
      monitor: monitor,
      config: config
    });
  });

  monitor.start();
  module.exports = monitor;
};
if(!module.parent){
  require('./monitor')(false);
}
