/**
 * Created by sander on 2/8/15.
 */
var express = require('express');
var async = require('async');
var partials = require('express-partials');
var flash = require('connect-flash');
var moment = require('moment');
var crypto = require('crypto');

var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');
var moduleInfo = require('../../package.json');
var Account = require('../../models/user/accountManager');
var Session = require('../../models/user/sessionManager');
var Setting = require('../../models/setting');

module.exports = function(app) {


  app.get('/signout', function (req, res) {
    if(req.session.sessionHash) {
      Session.getSessionById(req.session.sessionHash._id, function (session) {
        if (session) {
          Session.endSession(session);
        }
        req.session.sessionHash = {};
        delete req.session.sessionHash;
        app.locals.sessionHash = false;
        app.locals.user = false;
        //req.session = null;
        res.clearCookie('sessionHash');
        res.redirect('/dashboard/login');
      });
    } else {
      res.clearCookie('sessionHash');
      res.redirect('/dashboard/login');
    }
  });

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

  var redirectIfValidCookie = function(req,res,next){
    Account.isUserAuthed(req,function(user){
      req.user = user;
      app.locals.user = user;
      res.redirect('/dashboard');
    },function(){
      app.locals.user = false;
      next();
    });
  };

  app.get('/login',redirectIfValidCookie, function (req, res) {
    res.render('user/login',{errors: []});
  });

  app.post('/login', function (req, res) {
   Account.loginUser(req,function(result){
      if(result.errors){
        res.render('user/login',{ errors: result.errors } );
      } else {
        res.cookie('sessionHash', result.session, { maxAge:  24 * 60 * 60 * 1000 });
        if (req.param('remember-me') == 'on'){
          req.session.cookie.expires = false;
          res.cookie('sessionHash', result.session, { maxAge:  365 * 24 * 60 * 60 * 1000 });
        }
        res.redirect('/dashboard')
      }
   });
  });

  app.get('/signup', function (req, res) {
    Setting.get('allow_registrations',function(value){
      if(value == "true" || value == true){
        res.render('user/signup',{errors: []});
      } else {
        res.render('user/signup_disabled');
      }
    })
  });


  app.post('/signup', function (req, res) {
    Account.createUser(req,function(result){
      if(result.errors){
        res.render('user/signup',{errors: result.errors});
      } else {
        res.cookie('sessionHash', result.session, { maxAge:  24 * 60 * 60 * 1000 });
        res.redirect('/dashboard');
      }
    });
  });

  app.get('/settings', isAuthed, function (req, res) {
    Account.findOne({user: req.user.user}, function(e, o){
      Session.getSessionsFromUser(o,function(sessions){
        if(o) {
          res.render('user/settings', {errors: [], user: o, sessions: sessions,curSession: req.session.sessionHash});
        } else {
          res.redirect('/dashboard/login');
        }
      });
    })
  });

  app.post('/settings', isAuthed, function (req, res) {
    Account.findOne({user: req.user.user}, function(e, o) {
      var notificationSettings = req.param('notifications');
      var settings = req.param('settings');
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
        if (settings.newpw==="" && settings.newpwr==="") {
          Account.update({_id: o.id}, newData, {upsert: false}, function (err, r) {

          });
        } else {
          Account.saltAndHash(settings.newpw, function (hash) {
            newData.pass = hash;
            Account.update({_id: o.id}, newData, {upsert: false}, function (err, r) {
            });
          });
        }
      }
      res.redirect('/dashboard/settings');
    });
  });

  app.delete('/settings/endsession/:sessionId', function (req, res) {
    var result = {'test': 'hi'};
    Session.getSessionById(req.params.sessionId,function(session){
      if(session) {
        Session.endSession(session);
        result = 'success'
      } else {
        result = {'error': 'session not found'}
      }
    });
    res.json(result)
  });

  app.post('/settings/apikey', isAuthed, function (req, res) {
    var name = req.param('name');
    Account.createApiKey(name, req.user, function(user,newKey){
      res.json({
        user: user,
        newKey: newKey
      });
    });
  });

  app.delete('/settings/apikey/:hash', isAuthed, function (req, res) {
    var name = req.param('name');

    Account.deleteApiKey(req.params.hash, req.user, function(e,r){
      res.json({e: e,r:r});
    });
  });
}