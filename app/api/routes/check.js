/**
 * Module dependencies.
 */

var Check = require('../../../models/check');
var Ping = require('../../../models/ping');
var CheckEvent = require('../../../models/checkEvent');
var CheckHourlyStat = require('../../../models/checkHourlyStat');
var CheckDailyStat = require('../../../models/checkDailyStat');
var CheckMonthlyStat = require('../../../models/checkMonthlyStat');
var Account = require('../../../models/user/accountManager');

/**
 * Check Routes
 */
module.exports = function (app) {

  var isUser = function (req, res, next) {
    Account.isUserAuthed(req, function (user) {
      req.user = user;
      app.locals.user = user;
      req.session.user = user;
      next();
    }, function () {
      res.status(401)     // HTTP status 404: NotFound
          .send('Unauthorized');
      console.log('Something is using an authed route', req.route.path);
    });
  };


  app.get('/checks', isUser, function (req, res, next) {
    var query = {owner: req.user._id};
    if (req.query.tag) {
      query.tags = req.query.tag;
    }
    Check
        .find(query)
        .sort({isUp: 1, lastChanged: -1})
        .exec(function (err, checks) {
          if (err) return next(err);
          res.json(checks);
        });
  });

  app.get('/checks/needingPoll', function (req, res, next) {
    /**
     * @TODO; Get the checks to poll per monitor
     * Monitor name is in the req.head.
     *
     */
    Check
        .needingPoll()
        .select({qos: 0}).populate('owner', 'apiKeys')
        .exec(function (err, checks) {
          if (err) return next(err);
          res.json(checks);
        });
  });


  // check route middleware
  var loadCheck = function (req, res, next) {
    Check
        .find({_id: req.params.id})
        .select({qos: 0})
        .findOne(function (err, check) {
          if (err) return next(err);
          if (!check) return res.json(404, {error: 'failed to load check ' + req.params.id});
          req.check = check;
          next();
        });
  };


  app.get('/checks/:id', isUser, loadCheck, function (req, res, next) {
    res.json(req.check);
  });

  app.get('/checks/:id/pause', isUser, loadCheck, function (req, res, next) {
    req.check.togglePause();
    req.check.save(function (err) {
      if (err){
        return next(new Error('failed to toggle pause on check' + req.params.id));
      }
      res.json(req.check);
      new CheckEvent({
        timestamp: new Date(),
        check: req.check,
        tags: req.check.tags,
        owner: req.check.owner,
        message: req.check.isPaused ? 'paused' : 'restarted'
      }).save();
    });
  });

  app.put('/check/:id/test', function (req, res, next) {
    Check.update({_id: req.params.id}, {lastTested: new Date()}, function (err, numberAffected) {
      if (err) return next(err);
      res.json({numberAffected: numberAffected});
    });
  });

  app.get('/checks/:id/stat/:period/:timestamp', isUser, loadCheck, function (req, res, next) {
    req.check.getSingleStatForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function (err, stat) {
      if (err) return next(err);
      stat = stat || []
      res.json(stat);
    });
  });

  app.get('/checks/:id/stats/:type', isUser, loadCheck, function (req, res, next) {
    req.check.getStatsForPeriod(req.params.type, req.query.begin, req.query.end, function (err, stats) {
      if (err) return next(err);
      res.json(stats);
    });
  });

  app.get('/checks/:id/events', isUser, function (req, res, next) {
    var query = {
      check: req.params.id,
      owner: req.user._id,
      timestamp: {$gte: req.query.begin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
    };
    if (req.query.end) {
      query.timestamp.$lte = req.query.end;
    }
    CheckEvent
        .find(query)
        .sort({timestamp: -1})
        .select({tags: 0})
        .limit(100)
        .exec(function (err, events) {
          if (err) return next(err);
          CheckEvent.aggregateEventsByDay(events, function (err, aggregatedEvents) {
            if (err) return next(err);
            res.json(aggregatedEvents);
          });
        });
  });

  app.put('/checks', isUser, function (req, res, next) {
    var check = new Check();

    try {
      var dirtyCheck = req.body;
      dirtyCheck.owner = req.user;
      check.populateFromDirtyCheck(dirtyCheck, app.get('pollerCollection'));
      app.emit('populateFromDirtyCheck', check, dirtyCheck, check.type);
    } catch (err) {
      return next(err);
    }
    check.owner = req.user._id;
    check.notifiers = req.param('notifiers') || req.body.notifiers;
    check.save(function (err) {
      if (err) return next(err);
      res.json(check)
    });
  });

  app.post('/checks/:id', function (req, res, next) {
    Check.findOne({_id: req.params.id}, function (err, check) {
      if (err) return next({status: 500, error: err});
      if (!check) return next({status: 404, error: 'failed to load check ' + req.params.id})

      try {
        check.populateFromDirtyCheck(req.body, app.get('pollerCollection'));
        app.emit('populateFromDirtyCheck', check, req.body, check.type);
      } catch (checkException) {
        return next(checkException);
      }
      check.notifiers = req.param('notifiers') || req.body.notifiers;
      check.save(function (saveError) {
        if (saveError) return next({status: 500, error: saveError});
        res.json(check);
      });
    });
  });

  app.delete('/checks/:id',isUser, function(req, res, next) {
    Check.findOne({ _id: req.params.id, owner: req.user._id }, function(err, check) {
      if (err) return next(err);
      if (!check) return next(new Error('failed to load check ' + req.params.id));
      check.remove(function(err2) {
        if (err2) return next(err2);
        res.json({ok: true});
      });
    });
  });

  app.post('/checks/:id/reset',isUser, function(req, res, next) {
    Check.findOne({_id: req.params.id}, function (err, check) {
      if (err) return next({status: 500, error: err});
      if (!check) return next({status: 404, errors: 'failed to load check ' + req.params.id})
      check.remove(function(err2){
        if (err2) return next(err2);
        var nwcheck = new Check();
        nwcheck.type = check.type;
        check.interval = check.interval / 1000;
        check.timeout = check.timeout / 1000;
        nwcheck.lastTested = check.lastTested;
        try {
          nwcheck.populateFromDirtyCheck(check, app.get('pollerCollection'));
          app.emit('populateFromDirtyCheck', nwcheck, check, nwcheck.type);
        } catch (err) {
          return next(err);
        }
        nwcheck.owner = req.user._id;
        nwcheck.notifiers = check.notifiers;
        nwcheck.save(function(saveError){
          if (saveError) return next({status: 500, error: saveError});
          res.json(check);
        });
      })
    });
  });

  app.get('/check/pollerPartials', isUser, function (req, res, next) {
    res.json(app.get('pollerCollection').getTypes())
  });

  app.get('/check/pollerPartial/:type', isUser, function (req, res, next) {
    var poller;
    try {
      poller = app.get('pollerCollection').getForType(req.params.type);
    } catch (err) {
      return next(err);
    }
    var pollerDetails = [];
    app.emit('checkEdit', req.params.type, new Check(), pollerDetails);
    res.send(pollerDetails.join(''));
  });
};
