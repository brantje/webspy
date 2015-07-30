var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var CheckYearlyStat = new Schema({
  check          : { type: Schema.ObjectId, ref: 'Check' },
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
CheckYearlyStat.index({ check: 1, timestamp: -1 }, { unique: true });
CheckYearlyStat.plugin(require('mongoose-lifecycle'));

module.exports = mongoose.model('CheckYearlyStat', CheckYearlyStat);