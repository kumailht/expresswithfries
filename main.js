const express = require('express');

// Plugins
const nunjucks = require('nunjucks');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const slashes = require("connect-slashes");

// Utils
const relativeDate = require('tiny-relative-date');
const { format } = require('date-fns');

// App
const { Session, User } = require('./models');
const { APP_URL, ADMIN_EMAILS } = require('./settings');
const { error500, getUser } = require('./views/utils');

// Increase stack trace limit
Error.stackTraceLimit = Infinity;

// Initialize Express
const app = express();

// Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Static files
app.use(express.static('public'));

// Configure Nunjucks
const env = nunjucks.configure('templates', {
    express: app,
    noCache: true,
});

// NUNJUCKS FILTERS
// These are custom filters that can be used in templates
// https://mozilla.github.io/nunjucks/cn/api.html#addfilter

// Relative date filter
// Usage: {{ date | relativeDate }}
env.addFilter('relativeDate', function (date) {
    return relativeDate(date);
});

// Format date filter
// Usage: {{ date | formatDate }}
env.addFilter('formatDate', function (date) {
    try {
        return format(new Date(date), 'do MMM yyyy');
    } catch (error) {
        return date;
    }
});

// cookie parser middleware
app.use(cookieParser());


// Always use trailing slashes for relative urls to work
// This middleware will append or remove a trailing slash to all request urls. 
// This includes filenames (/app.css => /app.css/), so it may break your static files. 
// Make sure to .use() this middleware only after the connect.static() middleware.
// Only GET, HEAD, and OPTIONS requests will be redirected (to avoid losing POST/PUT data)
app.use(slashes(true));


// Set the number of spaces for JSON responses
// Makes it easier to read JSON responses in the browser
app.set('json spaces', 4);


// Site-wide Middleware
// Set global variables for use in templates. For example:
app.use(async function (req, res, next) {
    const user = await getUser(req);

    // {% if isAuthenticated %} ... {% else %} ... {% endif %}
    res.locals.isAuthenticated = user ? true : false;
    res.locals.user = user;

    // check if user is admin
    res.locals.isAdmin = user && ADMIN_EMAILS.includes(user.email) ? true : false;

    // Set the APP_URL variable that is available in all templates
    res.locals.APP_URL = APP_URL;

    next();
});

const { views } = require('./views/auth');
views(app);
require('./views/app')(app);
require('./views/dashboard')(app);
require('./views/admin')(app);


//The 404 Route (ALWAYS Keep this as the last route)
app.get('*', function (req, res) {
    res.status(404).send(`
        <br><br>
        <center><code><b>Not found.</b> Please visit the <a href="/">homepage</a>.</code></center>
    `);
});

// Catch-all error handler
// Returns a 500 error for any uncaught errors
app.use(function (err, req, res, next) {
    console.error(err.stack);

    return error500(res);
});

app.listen(8080, () => {
    console.log(`Server is running on port 8080.`);
});
