const { loginRequired } = require('./auth');

const {
    getUser
} = require('./utils');


module.exports = function (app) {
    app.get('/dashboard/', [loginRequired], async function (req, res, next) {
        return res.redirect('/dashboard/account/');

        const user = await getUser(req);

        return res.render('dashboard/index.html', { user });
    });


    app.get('/dashboard/account/', [loginRequired], async function (req, res, next) {

        const user = await getUser(req);

        return res.render('dashboard/account.html', { user });
    });

    app.get('/dashboard/delete/', [loginRequired], async function (req, res, next) {
        const user = await getUser(req);

        return res.render('dashboard/delete.html', { user });
    });

    app.post('/dashboard/delete/', [loginRequired], async function (req, res, next) {
        const user = await getUser(req);

        if (!user) {
            console.log('User not found!');
            return;
        }

        // Delete the user
        await user.destroy();

        return res.redirect('/account/logout/')
    });
}