/*
 * Monitor remote server uptime.
 */
module.exports = function(cluster,workerProcess) {

  var mongoose = require('./bootstrap');
  var http = require('http');
  var https = require('https');
  var url = require('url');
  var express = require('express');
  var config = require('config');

  var fs = require('fs');
  var monitor = require('./lib/monitor');

  var CheckEvent = require('./models/checkEvent');
  var Account = require('./models/user/accountManager');
  var Ping = require('./models/ping');
  var PollerCollection = require('./lib/pollers/pollerCollection');
  var apiApp = require('./app/api/app');
  var dashboardApp = require('./app/dashboard/app');
  var rootApp = require('./app/root/app');
  var cookieParser = express.cookieParser('Z5V45V6B5U56B7J5N67J5VTH345GC4G5V4');
  var connect = require('connect');
  var spdy = require('spdy');
  require('events').EventEmitter.prototype._maxListeners = 1000;
// database
  var serverUrl = url.parse(config.url);
  var analyzer = require('./lib/analyzer');

  if(cluster) {
    console.log('Hello from worker ' + cluster.worker.process.pid);
  } else{
    var analyzer = require('./lib/analyzer');
    var a = analyzer.createAnalyzer(config.analyzer);
    a.start();
  }




// web front

  var app = module.exports = express();
  if (config.ssl && config.ssl.enabled === true) {
    if (typeof(config.ssl.certificate) === 'undefined') {
      throw new Error("Must specify certificate to enable SSL!");
    }
    if (typeof(config.ssl.key) === 'undefined') {
      throw new Error("Must specify key file to enable SSL!");
    }
    var options = {
      cert: fs.readFileSync(config.ssl.certificate),
      key: fs.readFileSync(config.ssl.key)
    };
    var server = spdy.createServer(options, app);
    if(config.ssl.redirectHTTP){
      var http = require('http');
      http.createServer(function (req, res) {
        res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        res.end();
      }).listen(80);
    }
  } else {
    var server = http.createServer(app);
  }


// CORS
  if (config.enableCORS) {
    app.use(function (req, res, next) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept,Authorization');

      next();
    });
  }
  app.all('*', function(req, res, next) {
    // add details of what is allowed in HTTP request headers to the response headers
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', false);
    res.header('Access-Control-Max-Age', '86400');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization');
    // the next() function continues execution and will move onto the requested URL/URI
    next();
  });
  app.options('*', function(req, res) {
    console.log('options')
    res.send(200);
  });

  var sessionStore = new connect.middleware.session.MemoryStore();
  var socketIo = require('socket.io');
  var io = socketIo.listen(server);

  var SessionSockets = require('session.socket.io')
    , sessionSockets = new SessionSockets(io, sessionStore, cookieParser);

  app.configure(function () {
    app.locals.cluster = cluster;
    app.use(function (req, res, next) {
      if(app.locals.cluster) {
        res.setHeader('x-cluster-node', 'node'+app.locals.cluster.worker.id+'.'+serverUrl.hostname);
      }
      next();
    });/*
   //app.use(express.cookieParser('Z5V45V6B5U56B7J5N67J5VTH345GC4G5V4'));
   /*app.use(express.cookieSession({
      key: 'uptime',
      secret: 'FZ5HEE5YHD3E566756234C45BY4DSFZ4',
      proxy: true,
      cookie: {maxAge: 24 * 60 * 60 * 1000}
    }));*/
    app.use(cookieParser);
    app.use(express.session({ store: sessionStore }));
    app.use(app.router);
    // the following middlewares are only necessary for the mounted 'dashboard' app,
    // but express needs it on the parent app (?) and it therefore pollutes the api
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.set('pollerCollection', new PollerCollection());
  });
// load plugins (may add their own routes and middlewares)
  config.plugins.forEach(function (pluginName) {
    var plugin = require(pluginName);
    if (typeof plugin.initWebApp !== 'function') return;
    if(cluster) {
      console.log('loading plugin %s on worker %d', pluginName, app.locals.cluster.worker.id || 0);
    }else {
      console.log('loading plugin %s on app', pluginName);
    }
    plugin.initWebApp({
      app: app,
      api: apiApp,       // mounted into app, but required for events
      dashboard: dashboardApp, // mounted into app, but required for events
      io: io,
      config: config,
      mongoose: mongoose
    });
  });

  app.emit('beforeFirstRoute', app, apiApp);

  app.configure('development', function () {
    if (config.verbose) mongoose.set('debug', true);
    app.use(express.static(__dirname + '/public'));
    app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
  });

  app.configure('production', function () {
    var oneYear = 31557600000;
    app.use(express.static(__dirname + '/public', {maxAge: oneYear}));
    app.use(express.errorHandler());
  });


// Routes
  app.emit('beforeApiRoutes', app, apiApp);
  app.use('/api', apiApp);

  app.emit('beforeDashboardRoutes', app, dashboardApp);
  app.use('/dashboard', dashboardApp);

  //app.get('/', rootApp);
  app.get('/', function(req, res, next){
    res.redirect('/dashboard');
  });


  app.get('/favicon.ico', function (req, res) {
    res.redirect(301, '/dashboard/favicon.ico');
  });

  app.emit('afterLastRoute', app);

// Sockets
  if (!module.parent) {

    io.configure('production', function () {
      io.enable('browser client etag');
      io.set('log level', 1);
    });

    io.configure('development', function () {
      if (!config.verbose) io.set('log level', 1);
    });


    sessionSockets.on('connection', function (err,socket,session) {
      socket.on('set check', function (check) {
        //socket.set('check', check);
        if(!session){
          return;
        }
        session.curCheck = check;
        session.save();
      });
      Ping.on('afterInsert', function (ping) {
        if(!session){
          return;
        }
        if (ping.check == session.curCheck) {
          socket.emit('ping', ping);
        }
      });
      CheckEvent.on('afterInsert', function (event) {
        socket.emit('CheckEvent', event.toJSON());
      });

    });
  } else {
    var RedisStore = require('socket.io/lib/stores/redis');
    var redis = require('socket.io/node_modules/redis');

    io.set('store', new RedisStore({
      redisPub: redis.createClient(),
      redisSub: redis.createClient(),
      redisClient: redis.createClient()
    }));

     io.configure('production', function () {
      io.enable('browser client etag');
      io.set('log level', 1);
    });

    io.configure('development', function () {
      if (!config.verbose) io.set('log level', 1);
    });

    Ping.on('afterInsert', function (ping) {
          //socket.emit('ping', ping);
          process.send({event: 'ping', data: ping});
    });

    CheckEvent.on('afterInsert', function (event) {
      //socket.emit('CheckEvent', event.toJSON());
      process.send({event: 'CheckEvent', data: event.toJSON()});
    });



    //sessionSockets.on('connection', function (err,socket,session) {
    io.sockets.on('connection', function (socket, session) {
      var list = {}, rc = socket.handshake.headers.cookie;
      cookieParser(socket.handshake, {}, function (parseErr) {
        if (!socket.handshake.cookies) {
          socket.disconnect();
          return;
        }
        socket.set('user-' + socket.id, socket.handshake.cookies.sessionHash.user);

        //console.log(JSON.parse(decodeURI(socket.handshake.headers.cookie)));
        socket.on('set check', function (check) {
          socket.set('check-' + socket.id, check);
        });
        process.on('message', function (event) {
          if (!socket.id) {
            return;
          }
          if (event.event === 'ping') {
            socket.get('check-' + socket.id, function (e, r) {
              //console.log('Current socket id:', r)
              if (r) {
                if (event.data.check === r) {
                  socket.emit(event.event, event.data);
                }
              }
            });
          } else {
            socket.get('user-' + socket.id, function (e, r) {
              if (!r) {
                return;
              }
              if (event.data.owner === r) {
                socket.emit(event.event, event.data);
              }
            })
          }
        });
      });
    });
  }
// old way to load plugins, kept for BC
  fs.exists('./plugins/index.js', function (exists) {
    if (exists) {
      var pluginIndex = require('./plugins');
      var initFunction = pluginIndex.init || pluginIndex.initWebApp;
      if (typeof initFunction === 'function') {
        initFunction({
          app: app,
          api: apiApp,       // mounted into app, but required for events
          dashboard: dashboardApp, // mounted into app, but required for events
          io: io,
          config: config,
          mongoose: mongoose
        });
      }
    }
  });

  module.exports = app;

  var monitorInstance;
  var port;
  if (config.server && config.server.port) {
    console.error('Warning: The server port setting is deprecated, please use the url setting instead');
    port = config.server.port;
  } else {
    port = serverUrl.port;
    if (port === null) {
      port = config.ssl && config.ssl.enabled ? 443 : 80;
    }
  }
  var port = process.env.PORT || port;
  var host = process.env.HOST || serverUrl.hostname;
  server.listen(port, function () {
    var prefix = (config.ssl.enabled) ? 'https://' : 'http://';
    host = prefix + host;
    console.log("Express server listening on host %s:%d, in %s mode", host, port, app.settings.env);
  });
  server.on('error', function (e) {
    if (monitorInstance) {
      monitorInstance.stop();
      process.exit(1);
    }
  });

if(module.parent){
  var domain = require('domain');
  var d = domain.create();
  d.on('error', function(er) {
    console.error('error', er.stack);

    // Note: we're in dangerous territory!
    // By definition, something unexpected occurred,
    // which we probably didn't want.
    // Anything can happen now!  Be very careful!

    try {
      // make sure we close down within 30 seconds
      var killtimer = setTimeout(function() {
        process.exit(1);
      }, 30000);
      // But don't keep the process open just for that!
      killtimer.unref();

      // stop taking new requests.
      server.close();

      // Let the master know we're dead.  This will trigger a
      // 'disconnect' in the cluster master, and then it will fork
      // a new worker.
      workerProcess.worker.disconnect();

      // try to send an error to the request that triggered the problem
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain');
      res.end('Oops, there was a problem!\n');
    } catch (er2) {
      // oh well, not much we can do at this point.
      console.error('Error sending 500!', er2.stack);
    }
  });
}

// monitor
  if (!module.parent && !cluster) {
    if (config.autoStartMonitor) {
      console.log('Starting monitor...');
      monitorInstance = require('./monitor')(false);
    } else {
      console.log('Starting without monitor!')
    }
  }
}
if(!module.parent){
  require('./app')();
}