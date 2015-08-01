var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var Setting = new Schema({
  name: String,
  value: String
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
Setting.statics.get = function (name,callback,defaultValue) {
  defaultValue = (defaultValue) ? defaultValue : '';
  this.find({name: name}, function(e,r){
      if(!e){
        if(r.length > 0){
          callback(r.value);
        } else {
          var r = (name == "allow_registrations") ? true : defaultValue;
          callback(r);
        }
      } else {
        var r = (name == 'allow_registrations') ? true : defaultValue;
        callback(defaultValue);
      }
  });
};

Setting.statics.getAll = function (callback) {
  this.db.collection('settings').find().toArray(function(err,docs){
    var settings = {};
    for(var i =0; i < docs.length; i++){
      settings[docs[i].name] = docs[i].value;
    }
    callback(settings);
  });
};

module.exports = mongoose.model('Setting', Setting);