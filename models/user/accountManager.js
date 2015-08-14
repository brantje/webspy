var crypto 		= require('crypto');
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var moment 		= require('moment');
var Session = require('./sessionManager');
var assert = require('assert');

// main model
var Account = new Schema({
  name        : String,
  email        : String,
  user         : String,
  pass         : String,
  date         : String,
  notificationSettings: Object,
  apiKeys: Array,
  isAdmin     : Boolean,
  status:  { type: Number, default: 1 } // 0 = Not yet activated, 1= active, 2 = banned
});
Account.plugin(require('mongoose-lifecycle'));


Account.statics.getAll = function(callback) {
  return this.db.model('Account').find({}, callback);
};

Account.statics.getById = function(id,callback) {
  return this.db.model('Account').find({_id: id}, callback);
};

Account.statics.userExist = function(user, callback) {
  return this.db.model('Account').findOne({user: user.user}, callback);
};

Account.statics.isAdmin = function(user, callback) {
  return this.db.model('Account').findOne({user: user.user}, function(e,user){
    if(!e){
      var user = user.toObject()
      if(user.isAdmin === true){
        return true;
      } else {
        return false;
      }
    }
  });
};

Account.statics.isUserAuthed =  function(req,loggedInCallback,errorCallback){
  if(req.query.apikey) {
    /**
     * Check for an api key:
     *
     */
    var _self = this;
    /**
     * @fixme: handle banned accounts
     */
    this.db.model('Account').find({apiKeys:{ $elemMatch: {apiKey: req.query.apikey } } },function(e,user){
      if(user === null){
        errorCallback(req);
      } else {
        var usr = user[0].toObject();
        var id = user[0]._id;
        delete usr._id;
        delete usr['_id'];
        for(var i=0;i < usr.apiKeys.length; i++){
          var key =usr.apiKeys[i].apiKey;
          if(key == req.query.apikey){
            usr.apiKeys[i].lastAccessed = new Date();
            _self.db.collection('accounts').update({_id: id},usr,{},function(e,r){
              loggedInCallback(user[0]);
            });
            /*user[0].save(function(e,r){

            });*/
            break;
          }
        };
      }
    });
  } else {

    if(req.session.sessionHash || req.headers.authorization) {
      var searchFor = (req.headers.authorization) ? {sessionHash: req.headers.authorization } : req.session.sessionHash;
      //delete searchFor.user;
      delete searchFor.ip;
      Session.getSessionFromUser(searchFor,function (storedSession) {
        if(storedSession !== null && storedSession.user){
          var now = new Date();
          Session.setLastAccessed(storedSession,now,req);
          loggedInCallback(storedSession.user);
        } else {
          errorCallback(req);
        }
      });
    } else {
      if (req.cookies.sessionHash) {
        var searchFor = req.cookies.sessionHash;
        //delete searchFor.user;
        delete searchFor.ip;
        if(searchFor instanceof Array){
          searchFor = searchFor[0];
        }
        Session.getSessionFromUser(searchFor, function (storedSession) {
          if (storedSession !== null && storedSession.user) {
            var now = new Date();
            Session.setLastAccessed(storedSession, now, req);
            req.session.sessionHash = req.cookies.sessionHash;
            loggedInCallback(storedSession.user);
          } else {
            errorCallback(req);
          }
        });
      } else {
        errorCallback(req);
      }
      return;
    }
  }
};

Account.statics.createApiKey =  function(name,user,cb) {
  //console.log('Creating a session for',user._id,ip,useragent);
  var apiKey = {
    name: name,
    apiKey: crypto.randomBytes(32).toString('hex'),
    created: new Date(),
    lastAccessed: 0
  };
  var usr = user.toObject();
  var id = user._id;

  delete usr._id;
  delete usr['_id'];

  usr.apiKeys.push(apiKey)
  this.db.collection('accounts').update({_id: id},usr,{},function(e,r){

  });
};

Account.statics.deleteApiKey =  function(apikeyHash,user,cb) {
  var usr = user.toObject();
  var id = user._id;
  delete usr._id;
  delete usr['_id'];
  for(var i=0; i < usr.apiKeys.length; i++){
    if(usr.apiKeys[i].apiKey == apikeyHash){
      if(i==0){
        return;
      }
      var ret = usr.apiKeys.splice(i,1);
      break;
    }
  }
  this.db.collection('accounts').update({_id: id},usr,{},function(e,r){
      cb(e,r);
  });
};

Account.statics.createUser = function(req,callback,session){
  session = (session == undefined) ? true : false;
  var newUser = {};
  var errors = [];
  var apiKey = [{
    name: 'General api key',
    description: 'For quick use',
    apiKey: crypto.randomBytes(32).toString('hex'),
    created: new Date(),
    lastAccessed: 0
  }];
  newUser.name = req.param('name');
  newUser.email = req.param('email');
  newUser.pass = req.param('pass');
  newUser.apiKeys = apiKey;
  newUser.user = req.param('user');
  newUser.notificationSettings = {
    email: {
      value: "",
      isDefault: false
    },
    pushbullet: {
      apikey: "",
      isDefault: false
    },
    statushub:{
      subdomains: "",
      apikey: "",
      isDefault: false
    }
  };
  /***/

  if(!newUser.name){
    errors.push('Fill in a username');
  }
  if(!newUser.pass){
    errors.push('Fill in a password');
  }
  if(!newUser.email){
    errors.push('Fill in a email address');
  }
  if(!newUser.name){
    errors.push('Fill in a name');
  }
  if(newUser.pass !== req.param('passr')){
    errors.push('Passwords do not match');
  }
  var _self = this;
  if(errors.length === 0) {
    _self.db.model('Account').findOne({user: newUser.user}, function (e, o) {
      if (o) {
        callback({errors: ['Sorry this username is taken']});
      } else {
        _self.db.model('Account').findOne({email: newUser.email}, function (e, o) {
          if (o) {
            callback({errors: ['Sorry this email address is already in use.']});
          } else {
            _self.db.model('Account').find({}, function (e, o) {
              //No user exists, create user as admin.
              newUser.isAdmin = o.length === 0;
              Account.statics.saltAndHash(newUser.pass, function (hash) {
                newUser.pass = hash;
                // append date stamp when record was created //
                newUser.date = moment().format('MMMM Do YYYY, h:mm:ss a');
                _self.db.collection('accounts').insert(newUser, function (e, r) {
                  if(session){
                    var userAgent = req.headers['user-agent'];
                    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                    Session.startSession(newUser, ip, userAgent, function (session) {
                      delete session[0].userAgent;
                      delete session[0].lastAction;
                      delete session[0].date;
                      req.session.sessionHash = session[0];
                      var returnObj = {
                        session: session[0],
                        user: newUser
                      };
                      callback(returnObj);
                    });
                  } else {
                    callback(r)
                  }
                });
              });
            })
          }
        });
      }
    });
  } else {
    callback({errors: errors});
  }
};


Account.statics.loginUser = function(req,callback){
  var user = req.param('user');
  var pass = req.param('pass');
  var _self = this;
  _self.db.model('Account').findOne({user:user}).populate('owner','-pass').exec( function(e, o) {
    if (o == null){
     callback({ errors: ['User not found'] } );
    }	else{
      Account.statics.validatePassword(pass, o.pass, function(err, r) {
        if (r){
          var userAgent = req.headers['user-agent'];
          var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
          Session.startSession(o, ip,userAgent,function(session){
            delete o.pass;
            session[0].user = o;
            delete session[0].userAgent;
            delete session[0].lastAction;
            delete session[0].date;
            req.session.sessionHash = session[0];
            callback({session: session[0 ]});
          });
        }	else{
          callback({ errors: ['Invalid password'] } );
        }
      });
    }
  });
};
/* login validation methods */
/*
Account.methods.autoLogin = function(user, pass, callback)
{
  Account.findOne({user:user}, function(e, o) {
    if (o){
      o.pass == pass ? callback(o) : callback(null);
    }	else{
      callback(null);
    }
  });
}

Account.methods.manualLogin = function(user, pass, callback)
{  Account.findOne({user:user}, function(e, o) {
    if (o == null){
      callback('user-not-found');
    }	else{
      validatePassword(pass, o.pass, function(err, res) {
        if (res){
          callback(null, o);
        }	else{
          callback('invalid-password');
        }
      });
    }
  });
}

/* record insertion, update & deletion methods
Account.methods.addNewAccount = function(newData, callback)
{
  /*Account.findOne({user:newData.user}, function(e, o) {
    if (o){
      callback('username-taken');
    }	else{
      Account.findOne({email:newData.email}, function(e, o) {
        if (o){
          callback('email-taken');
        }	else{
          saltAndHash(newData.pass, function(hash){
            newData.pass = hash;
            // append date stamp when record was created //
            newData.date = moment().format('MMMM Do YYYY, h:mm:ss a');
            Account.insert(newData, {safe: true}, callback);
          });
        }
      });
    }
  });
  console.log(newData);
  Account.findOne({user: newData.user},function(e,o){
    console.log(e,o)
  })
  console.log(Account);
}

Account.methods.updateAccount = function(newData, callback)
{
  Account.findOne({user:newData.user}, function(e, o){
    o.name 		= newData.name;
    o.email 	= newData.email;
    o.country 	= newData.country;
    if (newData.pass == ''){
      Account.save(o, {safe: true}, function(err) {
        if (err) callback(err);
        else callback(null, o);
      });
    }	else{
      saltAndHash(newData.pass, function(hash){
        o.pass = hash;
        Account.save(o, {safe: true}, function(err) {
          if (err) callback(err);
          else callback(null, o);
        });
      });
    }
  });
}

Account.methods.updatePassword = function(email, newPass, callback)
{
  Account.findOne({email:email}, function(e, o){
    if (e){
      callback(e, null);
    }	else{
      saltAndHash(newPass, function(hash){
        o.pass = hash;
        Account.save(o, {safe: true}, callback);
      });
    }
  });
}

/* account lookup methods

Account.methods.deleteAccount = function(id, callback)
{
  Account.remove({_id: getObjectId(id)}, callback);
}

Account.methods.getAccountByEmail = function(email, callback)
{
  Account.findOne({email:email}, function(e, o){ callback(o); });
}

Account.methods.validateResetLink = function(email, passHash, callback)
{
  Account.find({ $and: [{email:email, pass:passHash}] }, function(e, o){
    callback(o ? 'ok' : null);
  });
}

Account.methods.getAllRecords = function(callback)
{
  Account.find().toArray(
    function(e, res) {
      if (e) callback(e)
      else callback(null, res)
    });
};

Account.methods.delAllRecords = function(callback)
{
  Account.remove({}, callback); // reset accounts collection for testing //
}
*/
/* private encryption & validation methods */

var generateSalt = function()
{
  var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
  var salt = '';
  for (var i = 0; i < 10; i++) {
    var p = Math.floor(Math.random() * set.length);
    salt += set[p];
  }
  return salt;
}

var md5 = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

Account.statics.saltAndHash = function(pass, callback)
{
  var salt = generateSalt();
  callback(salt + md5(pass + salt));
}

Account.statics.validatePassword = function(plainPass, hashedPass, callback)
{
  var salt = hashedPass.substr(0, 10);
  var validHash = salt + md5(plainPass + salt);
  callback(null, hashedPass === validHash);
}

/* auxiliary methods */

var getObjectId = function(id)
{
  return Account.db.bson_serializer.ObjectID.createFromHexString(id)
}

var findById = function(id, callback)
{
  accounts.findOne({_id: getObjectId(id)},
    function(e, res) {
      if (e) callback(e)
      else callback(null, res)
    });
};


var findByMultipleFields = function(a, callback)
{
// this takes an array of name/val pairs to search against {fieldName : 'value'} //
  accounts.find( { $or : a } ).toArray(
    function(e, results) {
      if (e) callback(e)
      else callback(null, results)
    });
};

module.exports = mongoose.model('Account', Account);
