var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var TagDailyStat = new Schema({
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
TagDailyStat.index({ name: 1, timestamp: -1 });
TagDailyStat.index({ owner: 1 });
TagDailyStat.plugin(require('mongoose-lifecycle'));

module.exports = mongoose.model('TagDailyStat', TagDailyStat);