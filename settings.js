// Use .env.example as a template for creating your own .env file 
// in the root directory of the project.
require('dotenv').config()

const ADMIN_EMAILS = ['kumailht@gmail.com']

// Is the app running in production?
const PRODUCTION = process.env.PRODUCTION.toLowerCase() === 'true' ? true : false;

// The APP_URL may be used for email authentication links, stripe redirect urls, etc.
const APP_URL = PRODUCTION ? 'https://expresswithfries.com' : 'http://localhost:8080';

// Used in the authentication process to sign JWTs and sessions
// Generate a random string for these values using the following command:
// node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

// The ACTIVE_DATABASE is used to determine which database to connect to
// This is useful for switching between development and production databases
// The database configuration is stored in /config/config.json
const databaseConfig = require('./config/config.json');
const ACTIVE_DATABASE = PRODUCTION ? databaseConfig.production : databaseConfig.development;

console.log(`
-------------------------------------------------------------------------------
- PRODUCTION:      ${PRODUCTION}
-------------------------------------------------------------------------------
- APP_URL:         ${APP_URL}
- ACTIVE_DATABASE: ${JSON.stringify(ACTIVE_DATABASE)}
-------------------------------------------------------------------------------
`)

module.exports = {
    JWT_SECRET,
    SESSION_SECRET,
    APP_URL,
    PRODUCTION,
    ACTIVE_DATABASE,
    ADMIN_EMAILS,
    RECAPTCHA_SECRET_KEY
}
