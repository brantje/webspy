/**
 * Module dependencies.
 */
var express    = require('express');
var Check      = require('../../models/check');
var CheckEvent = require('../../models/checkEvent');
var Account = require('../../models/user/accountManager');

var app = module.exports = express();

var debugErrorHandler = function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}

// middleware
app.configure(function(){
 /* app.use(function (req, res, next) {
    res.removeHeader("x-powered-by");
    next();
  });*/
  app.use(function (req, res, next) {
    if(app.locals.cluster) {
      res.setHeader('x-cluster-node', 'node'+app.locals.cluster.worker.id+'.'+serverUrl.hostname);

    }
    next();
  });
  app.use(app.router);
});

app.configure('development', debugErrorHandler);

app.configure('test', debugErrorHandler);

app.configure('production', function(){
  app.use(express.errorHandler());
});


// up count
var upCount;
var refreshUpCount = function(user, callback) {

};

Check.on('afterInsert', function() { upCount = undefined; });
Check.on('afterRemove', function() { upCount = undefined; });
CheckEvent.on('afterInsert', function() { upCount = undefined; });

var isUser = function(req,res,next) {
  Account.isUserAuthed(req,function(user){
    req.user = user;
    app.locals.user = user;
    next();
  }, function () {
    res.status(401)     // HTTP status 404: NotFound
      .send('Unauthorized');
  });
};

  app.get('/checks/count', isUser, function (req, res, next) {
    var count = {up: 0, down: 0, paused: 0, total: 0};

    Check
      .find({owner: req.user._id})
      .select({isUp: 1, isPaused: 1})
      .exec(function (err, checks) {
        if (err) return callback(err);
        checks.forEach(function (check) {
          //if(check.owner.toString() !=user._id.toString) return;
          count.total++;
          if (check.isPaused) {
            count.paused++;
          } else if (check.isUp) {
            count.up++;
          } else {
            count.down++;
          }
        });

        res.json(count);
      });
  });


// Routes

  require('./routes/check')(app);
  require('./routes/tag')(app);
  require('./routes/ping')(app);
  require('./routes/user')(app);

// route list
  app.get('/', function (req, res) {
    var routes = [];
    for (var verb in app.routes) {
      app.routes[verb].forEach(function (route) {
        routes.push({method: verb.toUpperCase(), path: app.route + route.path});
      });
    }
    res.json(routes);
  });

  if (!module.parent) {
    app.listen(3000);
    console.log('Express started on port 3000');
  }
