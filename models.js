const bcrypt = require('bcrypt');
const { Sequelize, Model, DataTypes } = require("sequelize");
const { ACTIVE_DATABASE } = require('./settings');

const sequelize = new Sequelize({
  ...ACTIVE_DATABASE,
  logging: false,
});

const User = sequelize.define("User", {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email_verified: DataTypes.BOOLEAN,
  hash: DataTypes.STRING,

  first_name: DataTypes.STRING,
  last_name: DataTypes.STRING,

  last_login: DataTypes.DATE,
});


const Session = sequelize.define("Session", {
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {});


// RESET DATABASE
// The following will drop any existing tables with the same name and then re-create them based on your models. 
// This effectively clears out the existing data in those tables and re-creates them from scratch.
// Very useful during development, but dangerous in production. You've been warned.

// (async () => {
//   // Automatically create all tables
//   await sequelize.sync({ force: true });

//   const user = await User.findOne({  });
//   if (!user) {
//     await User.create({
//       email: "kumailht@gmail.com",
//       email_verified: false,
//       first_name: "Admin",
//       last_name: "User",
//       hash: await bcrypt.hash('password', 10),
//       last_login: new Date(),
//     });
//   }
// })();


module.exports = {
  sequelize,
  User,
  Session,
};
