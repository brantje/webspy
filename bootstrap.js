var mongoose   = require('mongoose');
var config     = require('config');
var semver     = require('semver');

// configure mongodb

var userAuthStr = '';
if (config.mongodb.user) {
  userAuthStr = config.mongodb.user + ':' + config.mongodb.password + '@';
}
var connectWithRetry = function() {
  mongoose.connect(config.mongodb.connectionString || 'mongodb://' + userAuthStr + config.mongodb.server + '/' + config.mongodb.database,{server: { auto_reconnect: true}},function(err){
    if(err){
      console.error('Failed to connect to mongo on startup - retrying in 5 sec', err);
      connectWithRetry()
    } else {
      mongoose.connection.on('open', function (err) {
        mongoose.connection.db.admin().serverStatus(function (err, data) {
          if (err) {
            if (err.name === "MongoError" && (err.errmsg === 'need to login' || err.errmsg === 'unauthorized') && !config.mongodb.connectionString) {
              console.log('Forcing MongoDB authentication');
              mongoose.connection.db.authenticate(config.mongodb.user, config.mongodb.password, function (err) {
                if (!err) return;
                console.error(err);
                //process.exit(1);
              });
              return;
            } else {
              console.error(err);
              //process.exit(1);
            }
          }
          if (!semver.satisfies(data.version, '>=2.1.0')) {
            console.error('Error: Uptime requires MongoDB v2.1 minimum. The current MongoDB server uses only ' + data.version);
            //process.exit(1);
          }
        });
      });
    }
  });
};
connectWithRetry();
module.exports = mongoose;
