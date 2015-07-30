/**
 * Module dependencies.
 */
var Account = require('../../../models/user/accountManager');

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
      res.status(403)     // HTTP status 404: NotFound
      .send('Forbidden');
      console.log('Something is using an authed route',req.route.path);
    });
  };

  app.get('/user/logout', isAuthed, function(req, res, next) {

  });

  app.post('/user/login', function(req, res, next) {
    Account.loginUser(req,function(result){
      if(result.errors){
        res.render('user/login',{ errors: result.errors } );
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

  app.post('/user', function(req, res, next) {
      Account.createUser(req,function(r){
        res.json(r);
      })
  });

  app.patch('/user/:userId', function(req, res, next) {

  });

};
