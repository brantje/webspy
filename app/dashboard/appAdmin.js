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
var merge = require('merge');

module.exports = function(app) {

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

  var isAdmin = function(req,res,next){
    if(req.user.isAdmin){
      next();
    } else {
      res.redirect('/dashboard');
    }
  };

  app.get('/admin/settings', isAuthed, isAdmin, function (req, res) {
    Setting.getAll(function(settings){
      res.render('admin/settings',{settings: settings});// {errors: [], user: o, sessions: sessions,curSession: req.session.sessionHash});
    });

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

      res.render('admin/users',{users: users});
    });
  });

  app.get('/admin/user/edit/:id', isAuthed, isAdmin, function (req, res) {
      Account.getById(req.params.id,function(e,r){
        res.render('admin/editUser',{user: r[0]});
      });
  });

  app.post('/admin/user/edit/:id', isAuthed, isAdmin, function(req, res){
    var data = req.param('user');
    data.isAdmin = (data.isAdmin == 'true');
    Account.getById(req.params.id,function(e,r){
      var user = r[0];
      if (data.password==="") {
        delete data.password;
        Account.update({_id: user.id}, data, {upsert: false}, function (err, r) {
          res.redirect('admin/user/edit/'+req.params.id);
        });
      } else {
        Account.saltAndHash(data.password, function (hash) {
          data.pass = hash;
          Account.update({_id: user.id}, data, {upsert: false}, function (err, r) {
            res.redirect('admin/user/edit/'+req.params.id);
          });
        });
      }
    });
  });

  app.get('/admin/user/create', isAuthed, isAdmin, function (req, res) {
    res.render('admin/createUser',{errors:[]});
  });

  app.post('/admin/user/create', isAuthed, isAdmin, function(req, res){
    Account.createUser(req,function(result){
      if(result.errors){
        res.render('admin/createUser',{errors: result.errors});
      } else {
        res.redirect('admin/users');
      }
    },false);
  });


  app.post('/admin/user/:id/:action', isAuthed, isAdmin, function(req, res) {
    var data = req.param('user');
    if(req.params.action === 'ban'){
      Account.getById(req.params.id, function (e, r) {
        var user = r[0];
        var data = {
          status: 2
        };
        Account.update({_id: user.id}, data, {upsert: false}, function (err, r) {
          if(!err){
            res.json({ok: true});
          } else {
            res.json({ok: false});
          }
        });
      });
    }

    if(req.params.action === 'unban'){
      Account.getById(req.params.id, function (e, r) {
        var user = r[0];
        var data = {
          status: 1
        };
        Account.update({_id: user.id}, data, {upsert: false}, function (err, r) {
          if(!err){
            res.json({ok: true});
          } else {
            res.json({ok: false});
          }
        });
      });
    }

    if(req.params.action === 'delete'){
      Account.getById(req.params.id, function (e, r) {
        var user = r[0];
        var data = {
          status: 1
        };
        Account.remove({_id: user.id}, function (err, r) {
          if(!err){
            res.json({ok: true});
          } else {
            res.json({ok: false});
          }
        });
      });
    }
  });

};