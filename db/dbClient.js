const mysql = require('mysql2');
require('dotenv').config()

const param = {
    host: "127.0.0.1",
    user: process.env.DB_USER,
    database: process.env.DATABASE,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
};
const sesParams = {
  host: "localhost",
  user: "sessions",
  password: "1234",
  database: "widget",
};

function createConnection() {
  let con = mysql.createConnection(param);

  con.on("error", function (err) {
    console.log("cannot connect session", err);
  });

  return con;
}

function sessionConnection() {
  let con = mysql.createConnection(param);

  con.on("error", function (err) {
    console.log("cannot connect session", err);
  });

  return con;
}

module.exports = { createConnection, sessionConnection };
