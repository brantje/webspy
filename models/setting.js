var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var moment = require('moment');
var assert = require('assert');

// main model
var Setting = new Schema({
  name: String,
  value: String,
});
Setting.plugin(require('mongoose-lifecycle'));

Setting.statics.save = function (name, value, callback) {
  //console.log('Creating a session for',user._id,ip,useragent);
  var setting = {
    name: name,
    value: value
  };
  this.db.collection('settings').update({name: name}, setting, {upsert: true}, function (e, r) {

  });
};
Setting.statics.get = function (name,callback) {
  this.db.collection('settings').findOne({name: name}, function(e,r){
      if(!e){
        callback(r.value);
      } else {
        return null;
      }

  });
};

Setting.statics.getAll = function () {
  this.db.collection('settings').find({}, function(e,r){
      return r;
  });
};

module.exports = mongoose.model('Setting', Setting);