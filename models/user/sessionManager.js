var crypto 		= require('crypto');
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var moment 		= require('moment');



// main model
var Session = new Schema({
  user        : { type: Schema.ObjectId, ref: 'Account' },
  sessionHash:  { type: String, index: true },
  ip        : String,
  userAgent         : String,
  date         : Date,
  lastAction: Date

});
Session.plugin(require('mongoose-lifecycle'));


/**
 *
 * @param user {object} User object
 * @param ip {string} The ip of the session
 * @param useragent {string} User agent of the session
 */
Session.statics.startSession =  function(user,ip,useragent,callback) {
  //console.log('Creating a session for',user._id,ip,useragent);

  var newSession = {
    user: user._id,
    sessionHash: crypto.randomBytes(32).toString('hex'),
    ip: ip,
    userAgent: useragent,
    date: new Date(),
    lastAction: new Date()
  };
  this.db.collection('sessions').insert(newSession, function (e, r) {
    if(r !== null){
      callback(r)
    }
  });
};
/**
 *
 * @param user {object} User object
 */
Session.statics.getSessionsFromUser =  function(user,callback) {
  this.db.model('Session').find({user: user._id }, function (e, r) {
    callback(r);
  });
};

/**
 *
 * @param user {object} User object
 */
Session.statics.getSessionById =  function(id,callback) {
  this.db.model('Session').find({_id: id }, function (e, r) {
    callback(r[0]);
  });
};
/**
 *
 * @param session {object} session object
 */
Session.statics.getSessionFromUser =  function(session,callback) {
  this.db.model('Session').findOne({sessionHash: session.sessionHash }).populate('user').exec(function (e, storedSession) {
    callback(storedSession);
  });
};

/**
 *
 * @param sessionHash {object} session object
 */
Session.statics.setLastAccessed =  function(sessionHash,time,req) {
  //sessionHash.user = sessionHash.user._id;
  this.db.model('Session').findOne({_id: sessionHash._id}, function (err, session) {
    if (err) {
      return;
    }
    session.lastAction = time;
    session.userAgent = req.headers['user-agent'];
    session.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    session.save(function (err) {
       if(err){
         console.log('Error updating session doc', err)
       }
    });
  });
};

Session.statics.endSession = function (session){
  this.db.model('Session').findOne({_id: session._id},function(e,r){
    if(r) r.remove();
  });
}
module.exports = mongoose.model('Session', Session);
