const { loginRequired } = require('./auth');

module.exports = function (app) {
    app.get('/', async function (req, res) {
        res.render('home.html', {});
    });

    // This is an example of how to accept POST requests
    app.post('/submit', async function (req, res) {
        res.send('You submitted: ' + req.body.text);
    });

    // This is an example of how to use middleware in a route
    // The loginRequired middleware is defined in views/auth.js
    // It checks if the user is logged in and redirects to the login page if not
    // If the user is logged in, it continues to render the protected page
    app.get('/protected', [loginRequired], async function (req, res) {
        res.render('protected.html', {});
    });

    // This is an example of how to use the API
    app.get('/api/v1/example/', async function (req, res) {
        const exampleData = {
            message: 'Hello from the API!',
        };

        res.json(exampleData);
    });

    app.post('/api/v1/example/', async function (req, res) {
        const exampleData = {
            message: 'It can also accept POST requests!',
        };

        res.json(exampleData);
    });
};
