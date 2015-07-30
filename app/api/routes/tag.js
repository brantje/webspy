/**
 * Module dependencies.
 */

var Tag           = require('../../../models/tag');
var TagHourlyStat = require('../../../models/tagHourlyStat');
var CheckEvent    = require('../../../models/checkEvent');
var Check         = require('../../../models/check');
var async         = require('async');
var Account = require('../../../models/user/accountManager');

/**
 * Check Routes
 */
module.exports = function(app) {
  var isUser = function(req,res,next) {
    Account.isUserAuthed(req,function(user){
      req.user = user;
      app.locals.user = user;
      req.session.user = user;
      next();
    }, function () {
      res.status(403)     // HTTP status 404: NotFound
        .send('Forbidden');
      console.log('Something is using an authed route',req.route.path);
    });
  };

  app.get('/tags', isUser, function(req, res) {
    Tag
    .find({owner: req.user._id})
    .sort({ name: 1 })
    .exec(function(err, tags) {
      if (err) return next(err);
      res.json(tags);
    });
  });

  // tag search for autocomplete
  app.get('/tags/search',isUser, function(req, res) {
    Tag
      .aggregate({ $match :   { name : { $regex: req.query.term, $options: 'i' } ,owner: req.user._id} },
      { $project : {_id : 0,
        label : '$name',
        value : '$name'}},
      { $sort :    { label : 1 }},
      function(err, tags) {
        if (err) return next(err);
        res.json(tags);
      });
  });

  // tag route middleware
  var loadTag = function(req, res, next) {
    Tag.findOne({ name: req.params.name }, function(err, tag) {
      if (err) return next(err);
      if (!tag) return res.json(404, { error: 'failed to load tag ' + req.params.name });
      req.tag = tag;
      next();
    });
  };
  
  app.get('/tags/:name',isUser , loadTag, function(req, res, next) {
    res.json(req.tag);
  });

  app.get('/tags/:name/checks', function(req, res, next) {
    Check.find({ tags: req.params.name} ).sort({ isUp: 1, lastChanged: -1 }).exec(function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    });
  });

  app.get('/tags/:name/checks/:period/:timestamp', isUser,  loadTag, function(req, res, next) {
    req.tag.getChecksForPeriod(req.params.period, new Date(parseInt(req.params.timestamp)), function(err, checks) {
      if (err) return next(err);
      res.json(checks);
    })
  });

  app.get('/tags/:name/stat/:period/:timestamp', isUser, loadTag, function(req, res, next) {

    req.tag.getSingleStatsForPeriod(req.user,req.params.period, new Date(parseInt(req.params.timestamp)), function(err, stat) {
      if(err) return next(err);
      res.json(stat);
    });
  });

  app.get('/tags/:name/stats/:type', isUser, loadTag, function(req, res, next) {
    req.tag.getStatsForPeriod(req.user, req.params.type, req.query.begin, req.query.end,  function(err, stats) {
      if(err) return next(err);
      res.json(stats);
    });
  });

  app.get('/tags/:name/events',isUser, loadTag,  function(req, res) {
    var query = {
      tags: req.tag.name,
      timestamp: { $gte: req.query.begin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      owner: req.user._id
    };
    if (req.query.end) {
      query.timestamp.$lte = req.query.end;
    }
    CheckEvent
    .find(query)
    .sort({ timestamp: -1 })
    .select({ tags: 0 })
    .limit(100)
    .exec(function(err, events) {
      if (err) return next(err);
      CheckEvent.aggregateEventsByDay(events, function(err, aggregatedEvents) {
        res.json(aggregatedEvents);
      });
    });
  });

};
