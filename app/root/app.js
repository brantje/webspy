/**
 * Module dependencies.
 */
var express = require('express');
var async = require('async');
var partials = require('express-partials');
var flash = require('connect-flash');
var moment = require('moment');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');
var moduleInfo = require('../../package.json');

var Account = require('../../models/user/accountManager');
var app = module.exports = express();

// middleware

app.configure(function(){
  app.use(partials());
  app.use(flash());
  app.use(function locals(req, res, next) {
    res.locals.route = app.route;
    res.locals.addedCss = [];
    res.locals.renderCssTags = function (all) {
      if (all != undefined) {
        return all.map(function(css) {
          return '<link rel="stylesheet" href="' + app.route + '/css/' + css + '">';
        }).join('\n ');
      } else {
        return '';
      }
    };
    res.locals.moment = moment;
    next();
  });
  app.use(function (req, res, next) {
    if(app.locals.cluster) {
      res.setHeader('x-cluster-node', 'node'+app.locals.cluster.worker.id+'.'+serverUrl.hostname);
    }
    next();
  });
  app.use(express.cookieParser('Z5V45V6B5U56B7J5N67J5VTH345GC4G5V4'));
  /*app.use(express.cookieSession({
   key:    'uptime',
   secret: 'FZ5HEE5YHD3E566756234C45BY4DSFZ4',
   proxy:  true,
   cookie: { maxAge: 60 * 60 * 1000 }
   }));*/
  app.use(app.router);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

app.locals({
  version: moduleInfo.version
});

// Routes

app.get('/',  function(req, res) {
  res.render('index');
});

