const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true
  },
  verificationRoleId: {
    type: String,
    required: false
  }
});

module.exports = mongoose.model("Guilds", guildSchema);
