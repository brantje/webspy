var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// main model
var TagMonthlyStat = new Schema({
  name           : String,
  timestamp      : Date,
  end            : Date, // end is stored because months have an uneven duration
  count          : Number,
  availability   : Number,
  responsiveness : Number,
  responseTime   : Number,
  downtime       : Number,
  outages        : Array,
  owner: { type: Schema.ObjectId, ref: 'Account' }
});
TagMonthlyStat.index({ name: 1, timestamp: -1 });
TagMonthlyStat.plugin(require('mongoose-lifecycle'));

module.exports = mongoose.model('TagMonthlyStat', TagMonthlyStat);