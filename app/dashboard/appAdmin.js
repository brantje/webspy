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
var Setting = require('../../models/setting');


module.exports = function(app) {

  //userMiddleware
  var isAuthed = function(req,res,next){
    Account.isUserAuthed(req,function(user){
      req.user = user;
      app.locals.user = user;
      next();
    },function(){
      app.locals.user = false;
      res.redirect('/dashboard/signout');
    });
  };

  var isAdmin = function(req,res,next){
    if(req.user.isAdmin){
      next();
    } else {
      res.redirect('/dashboard');
    }
  };

  app.get('/admin/settings', isAuthed, isAdmin, function (req, res) {
    res.render('admin/settings');// {errors: [], user: o, sessions: sessions,curSession: req.session.sessionHash});
  });

  app.post('/admin/settings', isAuthed, isAdmin, function (req, res) {
    var setting = req.param('setting');
    for (var k in setting){
      if (setting.hasOwnProperty(k)) {
        Setting.save(k,setting[k]);
      }
    }

    res.render('admin/settings');// {errors: [], user: o, sessions: sessions,curSession: req.session.sessionHash});
  });

  app.get('/admin/users', isAuthed, isAdmin, function (req, res) {

    Account.getAll(function(e,users){
      console.log(users);
      res.render('admin/users',{users: users});
    });
  });

};