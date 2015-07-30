var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var TagHourlyStat = new Schema({
  name           : String,
  timestamp      : Date,
  count          : Number,
  availability   : Number,
  responsiveness : Number,
  responseTime   : Number,
  downtime       : Number,
  outages        : Array,
  owner: { type: Schema.ObjectId, ref: 'Account' }
});
TagHourlyStat.index({ name: 1, timestamp: -1 });
TagHourlyStat.plugin(require('mongoose-lifecycle'));

module.exports = mongoose.model('TagHourlyStat', TagHourlyStat);