/**
 * Module dependencies.
 */
var Account = require('../../../models/user/accountManager');
var Session = require('../../../models/user/sessionManager');

/**
 * User Routes
 */
module.exports = function(app) {

  //userMiddleware
  var isAuthed = function(req,res,next){
    Account.isUserAuthed(req,function(user){
      req.user = user;

      next();
    },function(){
      res.status(401)     // HTTP status 404: NotFound
      .send('Forbidden');
      console.log('Something is using an authed route',req.route.path);
    });
  };

  app.get('/user/logout', isAuthed, function(req, res, next) {
    var searchFor = (req.headers.authorization) ? {sessionHash: req.headers.authorization } : req.session.sessionHash;
    //delete searchFor.user;
    delete searchFor.ip;
    Session.getSessionFromUser(searchFor,function (storedSession) {
      Session.endSession(storedSession,function(){
        var r = {ok: true}
        res.json(r);
      });
    });
  });

  app.post('/user/login', function(req, res, next) {
    Account.loginUser(req,function(result){
      if(result.errors){
        res.json({ errors: result.errors } );
      } else {
        res.cookie('sessionHash', result.session, { maxAge:  24 * 60 * 60 * 1000 });
        if (req.param('remember-me') == 'on'){
          req.session.cookie.expires = false;
          res.cookie('sessionHash', result.session, { maxAge:  365 * 24 * 60 * 60 * 1000 });
        }
        res.json(result.session);
      }
    });
  });

  app.get('/user', isAuthed, function(req, res, next) {
      var user = req.user;
      user.pass = '';
      res.json(user);
  });

  app.get('/user/sessions', isAuthed, function(req, res, next) {
    Session.getSessionsFromUser(req.user,function(sessions){
      if(sessions) {
        res.json(sessions)
      } else {
        res.json({errors: ['Not authed']})
      }
    });
  });

  app.delete('/user/session/:sessionId', isAuthed, function (req, res) {
    var result = {};

    Session.getSessionById(req.params.sessionId,function(session){
      if(session) {
        Session.endSession(session);
        result = {result: 'success'};
      } else {
        result = {'error': 'session not found'}
      }
      res.json(result)
    });
  });

  app.post('/user/apikey', isAuthed, function (req, res) {
    var name = req.param('name');
    Account.createApiKey(name, req.user, function(user,newKey){
      res.json({
        user: user,
        newKey: newKey
      });
    });
  });

  app.delete('/user/apikey/:hash', isAuthed, function (req, res) {
    Account.deleteApiKey(req.params.hash, req.user, function(e,r){
      if(!e){
        res.json({e: e,r:r});
      } else {
        res.json({error: e})
      }
    });
  });

  app.post('/user', function(req, res, next) {
      Account.createUser(req,function(r){
        res.json(r);
      })
  });

  app.patch('/user', isAuthed, function (req, res) {
    Account.findOne({user: req.user.user}, function(e, o) {
      var settings = req.param('user');
      var notificationSettings = settings.notificationSettings;
      settings = settings || {};
      var newData = {};
      var errors = [];
      if (settings.newpw !== settings.newpwr) {
        errors.push('Passwords do not match');
      }
      if(settings.newpw && !settings.oldpw){
        errors.push('Please enter your old password');
      }
      if (errors.length === 0) {
        newData.name 		= settings.name;
        newData.email 	= settings.email;
        notificationSettings.email = notificationSettings.email || { value: ""};
        newData.notificationSettings = notificationSettings;
        if (!settings.newpw && !settings.newpwr) {
          Account.update({_id: o.id}, newData, {upsert: false}, function (err, r) {
            res.json({success: true});
          });
        } else {
          Account.validatePassword(settings.oldpw, o.pass, function(err, r) {
            if(r){
              Account.saltAndHash(settings.newpw, function (hash) {
                newData.pass = hash;
                Account.update({_id: o.id}, newData, {upsert: false}, function (err, r) {
                  res.json({success: true});
                });
              });
            } else {
              errors.push("You've entered a wrong password");
              res.json({errors: errors});
            }
          });
        }
      } else {
        res.json({errors: errors});
      }
    });
  });

};
