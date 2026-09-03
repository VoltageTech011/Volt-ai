const config = require('../utils/config');

const getHealth = (req, res) => {
  return res.status(200).json({
    status: 'ok',
    name: config.appName,
    version: config.version,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getHealth
};
