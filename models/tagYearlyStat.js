var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var TagYearlyStat = new Schema({
  name           : String,
  timestamp      : Date,
  end            : Date,
  count          : Number,
  availability   : Number,
  responsiveness : Number,
  responseTime   : Number,
  downtime       : Number,
  outages        : Array,
  owner: { type: Schema.ObjectId, ref: 'Account' }
});
TagYearlyStat.index({ name: 1, timestamp: -1 });
TagYearlyStat.plugin(require('mongoose-lifecycle'));

module.exports = mongoose.model('TagYearlyStat', TagYearlyStat);