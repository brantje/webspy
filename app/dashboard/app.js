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
/*
 User routes
 */
require('./appUser')(app);

/*
Admin
 */
require('./appAdmin')(app);

//userMiddleware
var isAuthed = function(req,res,next){
  Account.isUserAuthed(req,function(user){
    if(user.status == 1){
      req.user = user;
      app.locals.user = user;
      next();
    } else if(user.status == 2) {
      res.render('banned');
    } else if(user.status == 0){
      res.redirect('/dashboard/signout');
    }
  },function(){
    app.locals.user = false;
    res.redirect('/dashboard/signout');
  });
};

/* End user routes */

// Routes

app.get('/', isAuthed, function(req, res) {
  res.render('dashboard');
});

app.get('/events', isAuthed, function(req, res) {
  res.render('events');
});

app.get('/status/:tag', isAuthed, function (req, res, next) {
  Check.find({tags: req.params.tag}).sort({isUp: 1, lastChanged: -1}).exec(function (err, checks) {
    if (err) return next(err);
    res.render('status', {layout: "status_layout.ejs", info: req.flash('info'), checks: checks, tag: req.params.tag});
  });
});


app.get('/checks',isAuthed, function(req, res, next) {
  Check.find({ owner: req.user._id }).sort({ isUp: 1, lastChanged: -1 }).exec(function(err, checks) {
    if (err) return next(err);
    res.render('checks', { info: req.flash('info'), checks: checks });
  });
});

app.get('/checks/new',isAuthed, function(req, res) {
  var check = new Check();
  check.notifiers = {};
  res.render('check_new', { check: check, pollerCollection: app.get('pollerCollection'), info: req.flash('info') });
});

app.post('/checks',isAuthed, function(req, res, next) {
  var check = new Check();

  try {
    var dirtyCheck = req.body.check;
    dirtyCheck.owner = req.user;
    check.populateFromDirtyCheck(dirtyCheck, app.get('pollerCollection'));
    app.emit('populateFromDirtyCheck', check, dirtyCheck, check.type);
  } catch (err) {
    return next(err);
  }
  check.owner = req.user._id;
  check.notifiers = req.param('notifiers');
  check.save(function(err) {
    if (err) return next(err);
    req.flash('info', 'New check has been created');
    res.redirect(app.route + (req.body.saveandadd ? '/checks/new' : ('/checks/' + check._id + '?type=hour&date=' + Date.now())));
  });
});

app.get('/checks/:id',isAuthed, function(req, res, next) {
  Check.findOne({ _id: req.params.id,owner: req.user._id }, function(err, check) {
    if (err) return next(err);
    if (!check) return res.send(404, 'failed to load check ' + req.params.id);
    res.render('check', { check: check, info: req.flash('info'), req: req });
  });
});

app.get('/checks/:id/edit',isAuthed, function(req, res, next) {
  Check.findOne({ _id: req.params.id,owner: req.user._id }, function(err, check) {
    if (err) return next(err);
    if (!check) return res.send(404, 'failed to load check ' + req.params.id);
    var pollerDetails = [];
    app.emit('checkEdit', check.type, check, pollerDetails);
    check.notifiers = check.notifiers || {};
    res.render('check_edit', { check: check, pollerCollection: app.get('pollerCollection'), pollerDetails: pollerDetails.join(''), info: req.flash('info'), req: req });
  });
});

app.get('/pollerPartial/:type',isAuthed, function(req, res, next) {
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

app.put('/checks/:id',isAuthed, function(req, res, next) {
  Check.findOne({ _id: req.params.id,owner: req.user._id }, function(err, check) {
    if (err) return next(err);
    try {
      var dirtyCheck = req.body.check;
      dirtyCheck.owner = req.user;
      check.populateFromDirtyCheck(dirtyCheck, app.get('pollerCollection'))
      app.emit('populateFromDirtyCheck', check, dirtyCheck, check.type);
    } catch (populationError) {
      return next(populationError);
    }
    /*if(check.owner != req.user._id){
     console.log('Illegal save detected');
     req.flash('info', 'Changes not saved');
     res.redirect(app.route + '/checks/' + req.params.id);
     }*/
    check.notifiers = req.param('check').notifiers;
    if(check.notifiers){
     if(check.notifiers.email){
       if(check.notifiers.email.value){
         var adresses = check.notifiers.email.value.split(',');
         if(adresses.indexOf(req.user.email) === -1){
           adresses.push(req.user.email);
         }
         if(adresses.indexOf('on') >= 0){
           adresses.splice(adresses.indexOf('on'), 1);
         }
         check.notifiers.email.value = adresses.join(',');
       }
     }
    }
    
    check.save(function(err2) {
      if (err2) return next(err2);
      req.flash('info', 'Changes have been saved');
      res.redirect(app.route + '/checks/' + req.params.id);
    });
  });
});


app.delete('/checks/:id',isAuthed, function(req, res, next) {
  Check.findOne({ _id: req.params.id, owner: req.user._id }, function(err, check) {
    if (err) return next(err);
    if (!check) return next(new Error('failed to load check ' + req.params.id));
    check.remove(function(err2) {
      if (err2) return next(err2);
      req.flash('info', 'Check has been deleted');
      res.redirect(app.route + '/checks');
    });
  });
});

app.get('/tags',isAuthed, function(req, res, next) {
  //{owner: req.user._id}
  Tag.find({owner: req.user._id}).sort({ name: 1 }).exec(function(err, tags) {
    if (err) return next(err);
    res.render('tags', { tags: tags });
  });
});

app.get('/tags/:name',isAuthed, function(req, res, next) {
  Tag.findOne({ name: req.params.name, owner: req.user._id }, function(err, tag) {
    if (err) {
      return next(err);
    }
    if (!tag) return next(new Error('failed to load tag ' + req.params.name));
    res.render('tag', { tag: tag, req: req });
  });
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
